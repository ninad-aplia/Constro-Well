# AUTHENTICATION_MIGRATION_PLAN.md

Phase 02 — Deliverable 4 of 10. **This is one of the three domains explicitly flagged for extra scrutiny.** Every claim about the *existing* implementation below is VERIFIED by direct, fresh reading of `app/src/server/auth/session.ts` and `app/src/server/auth/current.ts` during this phase (re-confirming, not merely citing, Phase 01's findings — both files were re-read in full). Everything about the *target* FastAPI implementation is PROPOSED.

## 1. Existing implementation, exact facts (VERIFIED)

- **Password hashing**: `bcryptjs`, cost factor **12** (`session.ts:13` `const BCRYPT_COST = 12;`, used at `session.ts:99` `bcrypt.hash(input.password, BCRYPT_COST)`).
- **Session token**: opaque, `randomBytes(32).toString("base64url")` — 256 bits of entropy (`session.ts:34-36`).
- **What's persisted**: only `createHash("sha256").update(token).digest("hex")` (`session.ts:38-40`), stored in `Session.tokenHash` — **the raw token itself is never written to the database**, only sent to the browser via the cookie.
- **Session TTL**: `SESSION_TTL_SECONDS = 7 * 24 * 60 * 60` = 604,800 seconds / 7 days (`session.ts:11-12`).
- **Cookie**: name `cw_session` (`session.ts:10`), set via `current.ts:17-26` with `httpOnly: true`, `secure: process.env.NODE_ENV === "production"`, `sameSite: "lax"`, `path: "/"`, `maxAge: SESSION_TTL_SECONDS`. **No `domain` attribute is set** (defaults to the exact host serving the response) — directly relevant to §4 below.
- **Session validation**: `getSessionUserByToken(token)` (`session.ts:75-86`) re-hashes the presented token, looks up `Session` by `tokenHash` (unique), checks `isSessionActive(session.expiresAt, now)` (`session.ts:42-44`, a plain `expiresAt.getTime() > now.getTime()` comparison — no sliding-expiration/renewal logic exists today), and returns the joined `User` row or `null`.
- **Logout**: `destroySession` deletes the `Session` row by `tokenHash` (`session.ts:68-73`) **then** clears the cookie (`current.ts:82-86`) — a real, DB-backed revocation, not merely a client-side cookie clear. This is the exact property D21 chose a server-side session table specifically to get (`"JWT/stateless sessions (rejected: no revocation/logout)"`).
- **Role resolution**: `User.role` is a plain enum column (`customer|seller|driver|admin`) set once at creation; `resolveSellerForUser`/`resolveDriverForUser` (`session.ts:141-147,160-166`) look up `Seller`/`Driver` by `ownerUserId`/`userId` **equal to the already-authenticated user's own id** — never a client-supplied id, and never re-derived from a client-sent role claim.
- **CSRF**: `assertSameOrigin()` (`server/http.ts:63-94`, re-confirmed present and unchanged) rejects any non-GET/HEAD/OPTIONS request where `sec-fetch-site === "cross-site"`, or where a present `Origin` header doesn't match the request's own URL origin or the configured `APP_ORIGIN` env var or the `x-forwarded-host` header. A request with **no** `Origin` header (e.g. a non-browser client) is allowed through — a deliberate choice (non-browser clients can't carry cookies automatically, so they aren't CSRF-capable), re-confirmed, not merely restated.
- **CORS**: **confirmed, by direct grep this phase, to not exist anywhere** — no `Access-Control-*` header is ever set, no CORS middleware is configured in `next.config.ts` or anywhere in `src/`. The entire application today is single-origin by construction; there has never been a cross-origin request to defend against beyond the same-origin check above.
- **Public registration**: hard-restricted to `role: "customer"` at the data-write layer (`session.ts:108`, `role: "customer"` is a literal in the `create` call, not derived from any input) — there is no code path, anywhere, that can create a `seller`/`driver`/`admin` user via the public API. Those roles are provisioned only by `prisma/seed.ts` today (confirmed by Phase 01, not re-verified line-by-line again this phase since the Dependency Inventory agent covers it independently).
- **`requireAdmin()`** exists (`current.ts:77-79`) and is fully functional as a dependency (it would correctly gate a route if one existed) but is never imported by any route file — re-confirmed, unchanged from Phase 01.

## 2. Target: FastAPI must authenticate against the SAME session table, not a parallel one

**Non-negotiable design constraint, directly answering this phase's "do not introduce a second independent authentication system" instruction**: FastAPI will not have its own `User`/`Session` tables, its own password-hashing scheme, or its own token format. It will read and write the **exact same** `User`/`Session` Postgres tables the Next.js app already uses (via SQLAlchemy models mapped 1:1 onto the existing schema — Deliverable 5), using the **exact same** token/hash/cookie scheme described in §1. This is what makes "existing users must not be forced to register again or reset passwords" achievable: a user's `passwordHash` (bcrypt, cost 12) is portable as-is — `bcrypt` is a standard, language-agnostic algorithm; Python's `bcrypt`/`passlib[bcrypt]` libraries verify the exact same hash format Node's `bcryptjs` produces, with no re-hashing or migration step needed for passwords at all. A session token issued by the Next.js app today will validate correctly against a FastAPI endpoint tomorrow, and vice versa, **as long as both services compute `sha256(token)` the same way and query the same table** — both trivial, stdlib-level operations in Python (`hashlib.sha256`).

### Proposed FastAPI dependency chain (mirrors `current.ts` exactly)

```python
# core/security.py (proposed)
async def get_session_token(request: Request) -> str | None:
    return request.cookies.get(SESSION_COOKIE)  # "cw_session" — same name, same cookie

async def get_current_user(token: str | None = Depends(get_session_token), db: AsyncSession = Depends(get_db)) -> User | None:
    if not token:
        return None
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    session = await db.scalar(select(Session).where(Session.token_hash == token_hash).options(joinedload(Session.user)))
    if not session or session.expires_at <= datetime.now(timezone.utc):
        return None
    return session.user

async def require_user(user: User | None = Depends(get_current_user)) -> User:
    if not user:
        raise ApiError(401, "unauthenticated", "Sign in to continue")
    return user

async def require_seller(user: User = Depends(require_user), db: AsyncSession = Depends(get_db)) -> tuple[User, Seller]:
    seller = await db.scalar(select(Seller).where(Seller.owner_user_id == user.id))
    if not seller:
        raise ApiError(403, "seller_profile_missing", "No seller profile is linked to this account")
    return user, seller
# require_driver, require_admin follow the identical pattern
```

This is a direct, line-for-line conceptual port of `current.ts:47-79` — no redesign, no new concepts, which is exactly the point: the lowest-risk way to preserve authentication continuity is to **not** redesign authentication at all, only re-host the identical logic in a second language.

### Cookie-setting ownership during coexistence
Whichever service handles **login** (initially, this stays Next.js — see Deliverable 8 for sequencing) sets the `cw_session` cookie with the identical attributes (`httpOnly`, `secure` in production, `sameSite=lax`, `path=/`, `maxAge=604800`). Because both services are deployed same-origin (Deliverable 8 — reverse-proxied under one public domain), the cookie's lack of an explicit `domain` attribute means it is automatically sent to **both** the Next.js and FastAPI backends by the browser without any special configuration, **as long as same-origin deployment is maintained** (the recommended approach, §4). If same-origin deployment is ever abandoned in favor of a genuinely separate `api.` subdomain, the cookie would need an explicit `domain=.example.com` attribute added to be shared — a deliberate, flaggable change, not an accident.

## 3. Role-by-role continuity

| Role | Existing provisioning | FastAPI continuity plan |
|---|---|---|
| Customer | Public self-registration | FastAPI's `/auth/register`/`/auth/login` (once migrated, per Deliverable 8 sequencing) write/read the exact same `User`/`Session` tables; existing customers' bcrypt hashes and active sessions remain valid with zero migration step |
| Seller | `prisma/seed.ts` only, no public path (VERIFIED, both phases) | Same `Seller.owner_user_id` lookup; no change needed. If a self-serve seller-onboarding flow is ever built (Phase 01 roadmap item, not yet decided), it should be built once, in whichever backend owns identity at that time |
| Driver | Same pattern as Seller | Same lookup pattern via `Driver.user_id` |
| Admin | `prisma/seed.ts` only; `requireAdmin()` unreachable today (no routes) | FastAPI's new Admin router (Deliverable 1 — net-new domain) is the **first real consumer** of admin authentication; this is actually the lowest-risk place to prove the ported auth dependency chain works, since there is no existing admin traffic to regress |

## 4. CORS / cookie / deployment implications (cross-referenced in full in Deliverable 8)

Recommended: **same-origin, reverse-proxied deployment** (one public domain, a proxy layer routes `/api/*` paths that have been migrated to FastAPI there, and everything else to Next.js — Deliverable 8 §2). Under this model: **no CORS configuration is ever needed** (the browser only ever talks to one origin), the existing `assertSameOrigin()` CSRF check continues to work unmodified on the Next.js side, and an equivalent same-origin check should be added to FastAPI (reading the same `Origin`/`sec-fetch-site` headers, same logic) as a direct, simple port — not a new security model. This is the configuration this document recommends and assumes elsewhere unless stated otherwise.

If a separate-subdomain deployment is chosen instead (not recommended, but evaluated per instruction): CORS must be explicitly configured on the FastAPI side with an allowlist of the exact Next.js origin(s) (dev/preview/prod), `allow_credentials=True` (required for cookies to be sent cross-origin at all), and the cookie needs the shared `domain` attribute noted in §2 — a materially more complex and more risk-bearing configuration for zero functional benefit at this project's current scale, which is why it is not the recommendation.

## 5. Risks and acceptance criteria

- **Risk**: a subtle difference in how Python's `bcrypt` library and `bcryptjs` encode cost/salt could cause a false-negative password check. **Mitigation**: before any login traffic is routed to FastAPI, write a one-off verification script (not part of the application, a throwaway check) that reads a handful of real `passwordHash` values from the (local/dev) database and confirms Python's bcrypt library verifies them correctly against a known password — this is the single most important pre-migration smoke test for this entire domain, and should be the acceptance gate before Deliverable 8's "migrate login to FastAPI" step is considered done.
- **Risk**: expiry-comparison timezone mismatch (`isSessionActive` compares `Date` objects in Node's local/UTC handling; a naive Python `datetime.now()` without explicit UTC awareness could compare incorrectly). **Mitigation**: always use timezone-aware UTC datetimes in the FastAPI implementation, and add a test asserting a session with `expires_at` one second in the past is correctly rejected.
- **Acceptance criteria for this domain's migration being "done"**: (1) a session created by logging in through the *existing* Next.js `/api/auth/login` validates successfully against the *new* FastAPI `require_user` dependency, and vice versa, proven by an automated test, not a manual check; (2) logging out via either service invalidates the session for both (since they share one `Session` table, this should be automatic, but must be asserted, not assumed); (3) the bcrypt cross-verification smoke test above passes against real seeded password hashes.
