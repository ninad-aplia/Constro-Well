# TARGET_SYSTEM_ARCHITECTURE.md

Principal Architect discovery phase — Deliverable 6 of 8. Covers Stage G (target architecture) and Stage H (deployment/cloud readiness). This is a **proposal**, not an implementation — nothing here has been built or provisioned.

## 1. Guiding principle: modular monolith, preserve what works

Per the engagement brief's own stated preference and this audit's findings (Deliverable 2 §2.1: the existing backend is correct and well-scoped), the target architecture is a **modular monolith with one narrowly-scoped satellite service**, not microservices:

```
                         ┌─────────────────────────────┐
                         │        Browser clients       │
                         │  Customer · Seller · Driver   │
                         │   (+ future: Admin, Mobile)    │
                         └───────────────┬───────────────┘
                                         │ HTTPS
                    ┌────────────────────┼─────────────────────┐
                    │                    │                     │
           ┌────────▼────────┐  ┌────────▼─────────┐  ┌────────▼────────┐
           │   Next.js app     │  │  FastAPI service  │  │  (future) other  │
           │ (frontend + the    │  │  (net-new surfaces │  │  clients reuse   │
           │  existing, proven  │  │  only — starts     │  │  the same OpenAPI│
           │  Customer/Seller/  │  │  with Admin)        │  │  contract        │
           │  Driver business    │  │                     │  │                  │
           │  logic, UNCHANGED)  │  │                     │  │                  │
           └────────┬────────┘  └────────┬──────────┘  └──────────────────┘
                    │                    │
                    │ Prisma            │ SQLAlchemy (read-mostly,
                    │ (schema owner)     │  writes only to new admin tables)
                    └────────┬───────────┘
                             │
                    ┌────────▼─────────┐
                    │   PostgreSQL       │
                    │ (single database,  │
                    │  one schema owner) │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐        ┌───────────────────┐
                    │  Object storage    │        │  Scheduled task     │
                    │ (NEW — KYC docs,   │        │ (NEW — review-     │
                    │  delivery photos)  │        │  window settlement, │
                    │                    │        │  accept-window      │
                    │                    │        │  timeout → missed)  │
                    └────────────────────┘        └───────────────────┘
```

This directly addresses §3 of the Backend Architecture Decision: the existing, verified-correct Next.js business logic is **not** touched; FastAPI is additive, scoped to admin (and future net-new surfaces), reading the existing schema but owning only its own new tables, so there is exactly one schema-migration authority (Prisma) to avoid the two-ORM, two-migration-system conflict risk named in that document.

## 2. Domain boundaries

Evaluating the brief's nine proposed domains against what this audit actually found:

| Domain | Current state | Target owner | Notes |
|---|---|---|---|
| 1. Identity & Access | Real, sound (session auth, bcrypt, role resolution) | **Next.js, unchanged** | The one domain most expensive and riskiest to move (auth-model change risk, Backend Decision §2) |
| 2. Catalog & Search | Real, mostly migrated off mock data (2 home-page sections still mock) | **Next.js, unchanged** + a small cleanup task (Roadmap) | |
| 3. Cart & Checkout | Real, transactionally sound, the strongest part of the codebase | **Next.js, unchanged** | |
| 4. Orders & Fulfilment | Real, except the confirmed `review→settled`/timeout gap | **Next.js, unchanged**, plus the new scheduled-settlement task (same stack) | Do not let this domain's one real bug become a reason to move the whole domain |
| 5. Seller Management | Real for products/orders/payments-read/delivery-rules; the mock-data seam (sidebar score, dead link, fleet dead-end) needs fixing, not moving | **Next.js, unchanged**, bug-fixed | |
| 6. Delivery & Logistics | Real except fabricated photo-proof; needs genuine file-upload capability | **Next.js, unchanged**, plus new object-storage integration | |
| 7. Payments & Ledger | Real escrow read-path, honestly disclosed no-withdrawal; needs the settlement job (domain 4) and, eventually, a real `Payment`/`Settlement` model if a gateway is ever added | **Next.js, unchanged** for now | A dedicated `Payment` model is a future, gateway-triggered need, not a today need (COD-only by D3/D4) |
| 8. Administration & Governance | **Does not exist in either language today** | **New build, in FastAPI** (if Python is confirmed as the organizational target — Backend Decision §3) | The one domain with zero existing investment to protect, making it the lowest-risk place to start a FastAPI presence |
| 9. Notifications | Schema-only, no API surface, no delivery transport | **New build**, framework-agnostic (small enough to build in either stack; recommend Next.js for consistency unless it's folded into the Admin/FastAPI build as "admin broadcasts a notification") | |

## 3. What runs where

- **Frontend (browser)**: all portal UI, exactly as today — React Server/Client Components, Tailwind, the existing design-token system. No change to the rendering model is proposed.
- **Backend — existing (Next.js API routes)**: all of domains 1–7 above, unchanged. Continues to own the Prisma schema and all migrations.
- **Backend — new (FastAPI, conditional)**: domain 8 (Administration), reading the shared Postgres database (ideally via a reflected/mirrored SQLAlchemy model set, kept in sync by a documented process, not by letting two ORMs independently "own" the same tables) and writing only to its own new tables (an admin activity-log table, approval-queue state, payout-batch/second-check records — i.e., real equivalents of the reference admin portal's own data needs, per Deliverable 3 §4).
- **Database**: single PostgreSQL instance, single schema, single migration authority (Prisma). FastAPI's SQLAlchemy models are schema-compatible consumers, not a second source of truth.
- **Background processing (new)**: one scheduled task (cron-style, framework-agnostic — a Next.js route hit by an external scheduler is sufficient at current scale; no Celery/queue infrastructure is justified) that (a) advances shipments past their `reviewEnds` to `settled` and emits the corresponding `commission`/`released` escrow entries using the exact same Decimal-exact math already proven correct in `prisma/seed.ts`'s own settlement calculation, and (b) advances shipments past their `acceptBy` deadline to `missed`. This is the single highest-value piece of new backend work identified by this entire audit (Deliverable 4 §2) and should not wait on any FastAPI decision.
- **File storage (new)**: one object-storage integration (Cloud Storage, if GCP is confirmed — §8) for exactly two real needs found in this audit: delivery proof-of-delivery photos (fixing DELV-04) and seller KYC documents (fixing SELL-06). A signed-URL upload pattern (client requests a signed PUT URL from the backend, uploads directly to storage, backend then records only the resulting object key) keeps large binary traffic off the application server, which matters on a constrained hosting tier (§8).
- **Notifications (new)**: a thin email (and/or push, if later justified) sender triggered at existing event points (new order, dispute opened, payout released) — writes to the existing `Notification` model (finally giving it a real producer) and, only if a transport is actually wanted, calls a provider (Resend/SendGrid/SES) — explicitly **not** SMS, since the SMS channel (D5) remains an open business decision, not a technical one, and should not be preempted by this architecture work.
- **How each portal consumes backend services**: unchanged for Customer/Seller/Driver (direct Next.js API routes, same-origin, cookie session). The new Admin surface would be consumed either (a) via its own Next.js page(s) proxying to FastAPI, keeping one browser-facing origin and one cookie-session story for the human admin user, or (b) as a fully separate admin frontend if organizational preference wants Admin cleanly isolated — both are viable; (a) is simpler and recommended unless there's a specific reason to split origins.
- **How a future mobile app could reuse the backend**: this is FastAPI's single clearest, most genuine advantage (Backend Decision §2) — a mobile client would consume the auto-generated OpenAPI contract from the FastAPI admin/new-surfaces service directly, and would need a small, deliberate addition to the *existing* Next.js auth layer (a token-based auth path alongside the existing cookie session, e.g. a mobile-specific login endpoint issuing a long-lived API key or JWT scoped only to mobile clients) to consume the existing Customer/Seller/Driver domains without forcing a cookie-session model onto a native app. This is a real, scoped, future task — not something to build speculatively now.

## 4. API design principles (carried forward, not reinvented)

The existing Next.js API already follows sound principles worth preserving verbatim in any new (FastAPI or otherwise) surface:
- Every mutating endpoint resolves the acting principal (user/seller/driver) from the server-side session, never from a client-supplied id.
- Every ownership-scoped query/mutation filters by that resolved id in the same database call that performs the action (not a separate "check, then act" pair, which would be a TOCTOU risk).
- A foreign/absent resource returns 404, not 403, to avoid confirming existence to an unauthorized caller.
- Input validation at every boundary (Zod today; Pydantic in FastAPI) with `.strict()`-style rejection of unexpected fields.
- Errors are a structured `{error:{code,message,field?}}` shape; internal details (stack traces, DB errors) are never serialized to the client, and are logged (by name/code, not full message) only for truly unexpected failures.
- Money is never represented as a JavaScript/Python float at any boundary — exact decimal strings in, exact decimal types in the database, exact decimal strings out.

## 5. Logging and monitoring (addressing a confirmed current gap)

Deliverable 2 §5 found zero structured logging and zero APM anywhere. For the target architecture, recommend (proportionate to scale, not over-engineered):
- Structured, leveled logging (even a minimal `pino`/`structlog`-style JSON logger is a large improvement over two ad hoc `console.error` calls) for every `ApiError` occurrence, including its code, at minimum in a non-production environment, so recurring failure patterns are visible before they reach a client complaint.
- One error-tracking integration (Sentry's free/low tier is sufficient at this scale) wired into both the Next.js app and, if built, the FastAPI service — this is the single highest-leverage, lowest-cost observability improvement available and should not wait for any larger architecture decision.
- Cloud Logging (if GCP is adopted, §8) is a reasonable sink for both, but the structured-logging discipline above is the prerequisite, not Cloud Logging itself.

## 6. Notifications architecture detail

Minimal, proportionate design: a single `notify(event, payload)` server-side function (co-located with whichever service raises the event — e.g. called from `placeOrder()`, from `reportDriverIssue()`, from the new settlement job) that (a) always writes a `Notification` row (finally giving the existing, currently-orphaned model a real writer) and (b) optionally calls an email provider if `EMAIL_PROVIDER_API_KEY` is configured, no-op otherwise — mirroring the project's own existing, sound pattern of "feature gated by presence of a real credential, never a fake success" (the same discipline already correctly applied to OTP/SMS, D5).

## 7. Explicitly rejected additions

Per the brief's own instruction and this audit's own findings of current scale (a handful of sellers, tens of seeded orders): **no Redis, no Celery/queue broker, no Kubernetes, no microservices split beyond the one narrow FastAPI/admin satellite above.** Every confirmed gap in this audit (settlement job, admin surface, file uploads, notifications) is addressed above with a single scheduled task, one new router group, one storage integration, and one notification function — none of which requires this additional infrastructure at today's scale. Revisit only if real traffic/data volume materializes that the current design can't handle, with evidence, not preemptively.

---

## 8. Deployment and cloud readiness (Stage H)

### 8.1 The three-way conflict (recap from Deliverable 2 §0)
`DECISIONS.md` D10 approved Docker-based deployment. The actual, currently-deployed artifact targets **Render.com** (`render.yaml`, matching the most recent deployment-fix commits in the git history). This engagement's brief asks about **Google Cloud** (Cloud Run/Cloud SQL/Cloud Storage/Secret Manager). All three are real, present-tense facts about this project, not historical artifacts — this needs an explicit decision, not a default (listed in Deliverable 8).

### 8.2 GCP service suitability, evaluated against actual current needs
- **Cloud Run**: a strong fit for the Next.js app's existing `output: "standalone"` build (already containerizable — `app/Dockerfile` exists and was evidently built for exactly this kind of target) and, if built, the FastAPI admin service as a second, independent Cloud Run service. Scales to zero, which suits this project's current (low, demo-scale) traffic and cost-consciousness.
- **Cloud SQL for PostgreSQL**: a direct, suitable replacement for whatever Postgres instance backs the current `DATABASE_URL` (confirmed local at `127.0.0.1` during this project's own prior development/testing phases, production target unconfirmed in this read-only audit — see Deliverable 8). Needs a connection-pooling story (Cloud SQL Auth Proxy, or a pooler like PgBouncer/Cloud SQL's built-in pooling) given Cloud Run's scale-to-zero, many-small-instances model, which is a real operational detail to get right, not a checkbox.
- **Cloud Storage**: the right home for the new file-upload need (§3) — KYC documents and delivery photos. Both are relatively low-volume, making Cloud Storage's standard tier more than sufficient; no need for multi-region or lifecycle-management complexity at this scale.
- **Secret Manager**: appropriate replacement for whatever `.env`-based secret handling exists today (`DATABASE_URL`, `APP_ORIGIN`, `OTP_ENCRYPTION_KEY`, and a future email-provider key) — low-cost, directly addresses "never commit secrets," which is already a stated project norm (`render.yaml`'s own comments).
- **Cloud Logging and Monitoring**: reasonable sink given the structured-logging recommendation (§5); do not adopt this as a substitute for adding structured logging in the application first — an unstructured `console.error` shipped to Cloud Logging is only marginally more useful than today's status quo.
- **CI/CD**: this is the one area with a **confirmed, unconditional defect today** (Deliverable 2 §5 — the only CI workflow file is in the wrong directory and would never run even if correctly located). Recommend Cloud Build or GitHub Actions (correctly placed at the repo root this time) running lint + typecheck + Vitest unit tests + a build, on every PR, as a release-blocking gate — independent of which cloud provider is ultimately chosen, and higher priority than the cloud migration itself (Roadmap, P0).

### 8.3 Frontend independent deployability while backend development continues
- **API base URLs**: the Next.js app today calls its own API routes same-origin (`apiFetch` with `credentials:"include"`, no configurable base URL found — `src/lib/api/client.ts`). Introducing a separate FastAPI service means introducing a real, configurable `ADMIN_API_BASE_URL` (or similar) for the first time — currently there is nothing to configure because everything is same-origin.
- **CORS**: not currently a concern (same-origin). Becomes one the moment FastAPI is a separate origin — needs an explicit allowlist of the Next.js app's real origin(s) (dev/preview/prod), mirroring the existing `assertSameOrigin()` CSRF discipline rather than a permissive wildcard.
- **Authentication cookies**: the existing session cookie is scoped to the Next.js app's own domain. If the admin UI is served from Next.js and merely proxies to FastAPI server-side (recommended, §3), this is a non-issue — the browser never talks to FastAPI directly, so no cross-origin cookie question arises. If FastAPI is ever exposed directly to a browser, cookie domain/`SameSite` policy needs explicit, careful design — recommend avoiding this entirely by keeping FastAPI as a server-to-server-only service behind the Next.js app, at least for the human Admin UI (a future mobile client, by contrast, would use its own token-based auth, not cookies, per §3).
- **Domain/subdomain strategy**: a single public domain for the customer/seller/driver/admin experience (served by Next.js, which internally proxies admin calls to FastAPI) is simplest and avoids the CORS/cookie complexity above; a separate `api.` subdomain is only needed if FastAPI must be reachable directly by a non-Next.js client (e.g. the future mobile app).
- **Environment separation**: preview vs. production already has some precedent in this repo's own tooling context (this audit itself was conducted via a preview/production-aware platform) — recommend the same preview/production split for whichever hosting target is chosen, with distinct databases (never share a database between preview and production, to avoid exactly the kind of "is this safe to run against" uncertainty this audit itself had to carefully navigate).
- **Database connectivity, rollback, deployment sequencing**: deploy database migrations (Prisma) before deploying new application code that depends on them, as is already the existing convention (`db:migrate:deploy` as a distinct script from `db:migrate`); never let the FastAPI service apply its own competing migration against the same schema.

### 8.4 Minimal, maintainable, cost-conscious recommendation
Given the current actual scale (a demo/early-stage dataset, not production traffic), the single most proportionate next deployment step is **not** a full GCP migration — it is **fixing CI** (§8.2, a confirmed defect, near-zero cost to fix) and **resolving the three-way deployment-target conflict explicitly** (Deliverable 8) before investing further in any one target's specific tooling. Once that decision is made, the GCP services evaluated above are all genuinely appropriate choices, not over-engineering, for this system's near-term needs (Cloud Run + Cloud SQL + Cloud Storage + Secret Manager, nothing more).
