# Security & Reliability Gaps

## Present

- **AuthN:** bcrypt cost 12, opaque 256-bit session tokens stored as SHA-256
  digests, 7-day expiry, logout deletes the row.
- **AuthZ:** role checks server-side (`requireUser/Role/Customer/Seller/Driver/
  Admin`) with object ownership scoping; FastAPI mirrors it.
- **CSRF:** `assertSameOrigin` rejects cross-site state-changing requests in
  Next.js (same-origin single-domain model).
- **OTP:** CSPRNG 4-digit, bcrypt-digested + AES-256-GCM encrypted, 3-try lockout,
  cross-driver 404.
- **Secrets:** `.env` gitignored; `.env.example` committed; no secrets in logs.
- **Error envelope:** `{error:{code,message,field?}}` consistently.

## Gaps

1. **Rate limiting** — none on login/register/OTP/checkout (brute-force, OTP
   guessing throttling missing beyond the 3-try lockout).
2. **CORS** — Next.js has none (single-origin by design); FastAPI allows configured
   origins. Same-origin deployment is the assumption; a separate `api.` subdomain
   would need explicit CORS + cookie domain.
3. **File upload security** — no storage; when added, need signed URLs, size/type
   validation, and namespaced object keys.
4. **Backup/recovery** — no policy, no automated backups, no restore drill.
5. **Monitoring/APM** — FastAPI has structured JSON logs; Next.js logs are
   unstructured; no error tracking, no health alerting.
6. **CI** — `app/.github/workflows/playwright.yml` is inert at the monorepo root
   (GitHub won't run `app/.github`); no Vitest/pytest CI gate.
7. **Secrets rotation** — `SESSION_SECRET` documented but no rotation story;
   `OTP_ENCRYPTION_KEY` required at dispatch but no expiry.
8. **Audit coverage** — Admin reads are audited; Next.js customer/seller/driver
   mutations are not in `AuditEvent` (separate `ShipmentEvent` trail only).

## Reliability

- Idempotency and row-locking are strong in orders/delivery; the missing
  settlement job and lack of background retry mean financial closure and deadline
  enforcement are absent.
- No load/perf testing; batched queries are used throughout but unproven at scale.
