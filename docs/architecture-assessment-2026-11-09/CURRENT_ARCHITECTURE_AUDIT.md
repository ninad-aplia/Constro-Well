# CURRENT_ARCHITECTURE_AUDIT.md

Principal Architect discovery phase — Deliverable 2 of 8. Strictly read-only audit, no application files were modified. All line numbers refer to files as committed at the HEAD inspected (see §0). Confidence labels: **VERIFIED** (directly read), **PARTIALLY VERIFIED** (inferred from adjacent evidence, not exhaustively traced), **UNVERIFIED** (naming/comment only).

Admin portal: per explicit instruction from the engagement owner, the admin portal is not compared against its reference in this document (no implementation exists to compare). It is covered briefly in Deliverable 3 (reference description only) and flagged as an open gap in §4/§8 here.

---

## 0. Repository baseline (Stage A)

- **Repository root:** `C:\Users\NINAD\MyWorkspace\Constro-Well`, single git repo, remote `origin = https://github.com/ninad-aplia/Constro-Well.git`. **VERIFIED**.
- **Branch:** `feature/backend-mvp`, up to date with `origin/feature/backend-mvp`. **VERIFIED**.
- **HEAD commit:** `1f0f61fe1aa16a93e5b79e634f18543708da391e`, `2026-11-08 06:49:10 +0530`, message "Complete customer and seller marketplace workflows". **VERIFIED**.
- **Working-tree condition at audit time:** clean except four untracked paths — `app/.github/`, `app/tests/`, `artifacts/`, `buildgrid-platform-admin.html` (the admin reference file itself is untracked in git, interesting given the other three prototype HTML files are tracked). No uncommitted modifications to tracked files were present. **VERIFIED** (`git status --short`).
- **Recent history** (last 15 commits, oldest shown last): task-scoped commits (`TASK 2.0`, `TASK 2.1`, `feat(customer): …`) through `feat: complete marketplace lifecycle and deployment readiness`, `fix: correct Next.js standalone deployment configuration`, `fix: share Prisma client across production chunks`, `chore: log production database health failures`, culminating in HEAD. This shows a working, iterative history, not a single dump. **VERIFIED**.
- **Package manager:** npm (`package-lock.json` present, 315 KB). **VERIFIED**.
- **Runtime stack** (from `app/package.json`, read in full): Next.js `16.4.5`, React `19.3.0` / React DOM `19.3.0`, `@prisma/client ^6` (resolved `6.19.3` per `allowScripts`), `zod ^3.25.76`, `bcryptjs ^3.0.3`. Dev: `@playwright/test ^1.65.0`, `@tailwindcss/postcss ^4`, `tailwindcss ^4`, `vitest ^3.2.7`, `jsdom ^31`, `typescript ^5`, `eslint ^9` + `eslint-config-next 16.4.5`. **VERIFIED**.
- **Build scripts:** `dev`, `build`, `start`, `lint` (`eslint src`), `test`/`test:watch` (Vitest with `--no-experimental-webstorage`), `db:migrate`, `db:migrate:deploy`, `db:seed`, `db:studio`. **No `typecheck` script and no combined "verify everything" script exist** — a developer must run 4–5 separate commands to fully validate a change. **VERIFIED**.
- **Database:** PostgreSQL (confirmed by `prisma/migrations/migration_lock.toml: provider = "postgresql"`), Prisma 6 schema-first with 2 migrations applied. **VERIFIED**.
- **ORM/migrations:** Prisma Migrate, two migrations: `20261107132953_init` (initial schema, single-seller-owned products) and `20261108090000_multi_seller_and_financial_snapshots` (introduces `SellerOffer`, order financial-snapshot columns). **VERIFIED** (§3).
- **Authentication:** hand-rolled server-side session (opaque 256-bit token, SHA-256 digest stored, bcrypt cost-12 passwords, httpOnly cookie) — no third-party auth library, no OAuth. **VERIFIED** (§5).
- **Hosting/deployment config found in-repo:** THREE different, partially-conflicting deployment stories coexist:
  1. `render.yaml` (repo root) — targets **Render.com**, free plan, Node runtime, `npm ci && npx prisma generate && npm run build`, standalone server start, health check at `/api/health`. **VERIFIED, and this is what is actually referenced in the most recent commits** (`fix: correct Next.js standalone deployment configuration`).
  2. `app/Dockerfile` + `app/docker-compose.yml` — a self-contained Docker image/compose setup. **VERIFIED present**, but no evidence in the repo that this is the path actually used for any real deployment (no CI step builds or pushes it).
  3. `DECISIONS.md` D10 (APPROVED 2026-11-05): "Deployment: local development first; prepare Docker-based deployment… Vercel option deferred." **VERIFIED as the formally approved decision**, which is itself a third story (Docker, not Render) relative to what is actually in use today (Render).
  This engagement's own brief additionally asks about a fourth target, Google Cloud (Cloud Run/Cloud SQL) — see Deliverable 6 §8 for the reconciliation. **This is a genuine, unresolved documentation/decision conflict, not an inference** — three artifacts in the same repository describe three different deployment targets, and a fourth is now being asked about.
- **Testing infrastructure:** Vitest (jsdom environment) for unit/integration, real-PostgreSQL-gated integration suites (`describe.skipIf(!hasDb)`), Playwright installed but never actually used against this application (scaffold only). See §6.
- **Documentation vs. source-code inconsistencies found:**
  - `HANDOFF.md`'s final "Exact next action" section describes a checkpoint asking the next engineer to create `app/.env`, run `db:migrate`/`db:seed` for the **first time**, and not to start "TASK 5.2 (server-side order creation)" without approval. This is dramatically stale: migrations, seed, and server-side order creation (and a great deal more — the entire seller portal, payments, performance, driver OTP flow) are long since built and committed. **VERIFIED** (tail of `HANDOFF.md` read directly) — the handoff document was not kept in sync with at least the last several phases of real work.
  - `docs/CLIENT_DEPLOYMENT_READINESS.md` and `docs/RELEASE_READINESS_REPORT.md` both describe the release as "a gated preview, not a live marketplace" where "no payment is taken and no order reaches a seller" and "everything is still uncommitted" — all three claims are now false relative to HEAD (COD orders are real and reach sellers; the tree is committed). **VERIFIED** (tails read directly). These documents appear to be point-in-time demo-readiness reports that were never revisited, not living documentation.
  - Several in-code comments are themselves stale relative to the code they sit beside — e.g. `RecentlyViewedRow.tsx:9-13` claims "there is currently no `/product/[id]` page" and "the list is always empty," which is false (the page exists and the feature works) — flagged independently by the Frontend and Customer-portal research passes. **VERIFIED**.
  - **Pattern, not an isolated incident:** this project has a recurring habit of writing thorough, evidence-quality documentation at a point in time, then not updating it as work continues. Any new engineer (or AI agent) who trusts `HANDOFF.md`/`TASKS.md`/the `docs/*READINESS*.md` reports without re-verifying against source will materially under- or mis-estimate what already works. This audit treated source code as ground truth throughout, per its own instructions, and recommends the same discipline going forward (§ Roadmap, process work package).

---

## 1. Frontend architecture (Stage B1)

### 1.1 Routing structure
Full route tree, 23 `page.tsx` + 3 `layout.tsx`, Server vs Client classification by `"use client"` presence:

```
/                                  Server   src/app/page.tsx
/login, /register                 Server
/search, /product/[id]             Server (data-heavy, small client islands)
/cart, /checkout, /orders,
  /orders/[id], /thanks/[id]       Server shell -> Client *View component

/seller  (layout: Server, auth+redirect)
  /seller                          Client   (dashboard — "fully interactive, no static shell")
  /seller/products, /seller/orders Server shell -> Client *View
  /seller/delivery, /settings,
    /payments, /performance        Client   (each page.tsx itself client)

/delivery (layout: Server, auth+redirect)
  /delivery                        Client
  /delivery/jobs, /history         Server shell -> Client *View
  /delivery/settings               Client
```
Root composition (`src/app/layout.tsx:40-48`): `ToastProvider > SessionProvider > RemoteCartProvider > CartProvider > PortalChrome`. **VERIFIED.**

A consistent idiom exists — async Server Component shell parses `searchParams`/does auth, renders one Client `*View` — but dashboard-style pages (seller Overview, Delivery Overview, Settings, Payments, Performance) skip this split and are client components top-to-bottom. Each carries a one-line justifying comment ("fully interactive, no meaningful static shell"), so this is a documented, deliberate inconsistency rather than an accidental one. **VERIFIED.**

### 1.2 Design system / component duplication
Shared primitives exist in `src/components/ui/**` (Button, Card, Dialog, Pill, Toast, Stepper, Stars) and are genuinely reused across all three built portals. However:
- `PreviewDisclosure` exists **twice**, independently, once per portal (`components/seller/PreviewDisclosure.tsx`, `components/delivery/PreviewDisclosure.tsx`) — same one-paragraph "this is mock data" banner concept, no shared base in `ui/`.
- `SellerIcon` (`components/seller/SellerIcon.tsx`) is imported into **four Delivery-portal files** as the de facto icon set for both portals — functioning as shared code while living under a portal-specific, misleadingly-named folder.
- Toggle switches, and the `loading/error` boilerplate (`LoadState` union + `messageOf()` + `useEffect`/`cancelled` pattern), are each hand-reimplemented in 6–7 separate files rather than factored into one shared component/hook.
**VERIFIED**, all examples read directly by the Frontend research pass.

### 1.3 State management & data fetching
Seven distinct React Contexts exist: `SessionProvider`, `Toast`, `CartProvider` (legacy, **orphaned**), `RemoteCartProvider` (real, actually used), `SellerStoreProvider` (in-memory mock, explicitly "lost on reload"), `SellerLiveProvider` (real, server-hydrated), `DeliveryStoreProvider` (real, "no local-only delivery state" by its own header comment). **VERIFIED.**

The Delivery portal has fully migrated off mock data. The Seller portal has **not** — `SellerStoreProvider` still backs vehicles/drivers/daily-sales/notifications/reviews/notification-preferences even though Products/Orders/Settings/Payments/Performance/Delivery-rules have all been migrated to real `/api/seller/**` calls. The two systems coexist **on the same page** in `src/app/seller/delivery/page.tsx` (mock vehicles table + real service-area/rules forms in one file). **VERIFIED.**

### 1.4 Mock-vs-real data inventory (selected, see Frontend agent output for the full table)
| Area | Status |
|---|---|
| `/search`, `/product/[id]`, home deal/bestseller/finishing-touches rows, checkout, orders, cart | **Real**, DB-backed |
| Home `Hero` slides, `CategoryTiles`, `BulkSaverTile` | **Mock** (`lib/api/catalog.ts`, explicitly commented "Still mock-backed today") |
| `lib/api/orders.ts` (localStorage preview-order store) | **Mock, zero importers — dead code** |
| `CartProvider`/`useCart` | **Mock, zero importers outside its own re-export — dead code**, yet still mounted in root layout on every page load |
| Seller Overview "Needs your attention"/"Top products"/sales chart, sidebar score, vehicles/drivers table, notification bell, notification preferences | **Mock** (`SellerStoreProvider` ← `data/seller.ts`) |
| Seller Products/Orders/Settings/Payments/Performance/Delivery-rules | **Real**, DB-backed |
| All Delivery-portal pages | **Real**, DB-backed |

This split is **mostly, but not universally, disclosed** to the end user via the `PreviewDisclosure` component — see Deliverable 3 for the exact pages where disclosure is present, missing, or stale.

### 1.5 Forms & validation
Client-side validation is ad hoc, duplicated regex per form, **not** sourced from the server's zod schemas even where the rule is identical: the register form's password-length bounds (8/72) and email shape independently re-implement `server/auth/validation.ts`'s `registerSchema`; the seller-settings GSTIN/phone regexes and the delivery-page pincode regex are each defined inline, duplicating (not importing) equivalent constraints that exist server-side. This is a real drift risk — the client and server checks are not provably the same rule, only coincidentally similar today. **VERIFIED.**

### 1.6 Loading/empty/error states
`CartView.tsx` is the strongest example in the codebase (distinct skeleton-loading, guest, wrong-role, error-with-retry, and empty states, all visually distinct). Most seller dashboard sub-pages (Settings, Payments, Performance, Delivery) use a much thinner pattern — bare `"Loading…"` / `"{error}"` text with **no retry button**. Home product rows have no per-row loading/error state at all (caught only by the route-level `error.tsx`/`loading.tsx`) and **silently render nothing** for an empty result set rather than showing an explicit empty message (inconsistent with `/search`'s explicit "No results found"). **VERIFIED.**

### 1.7 Accessibility
No `<img>` tags exist anywhere in the application — all product art is inline SVG, consistently `aria-hidden="true"`, so there is no missing-alt-text problem, but it also means **there are no real product photographs anywhere in this marketplace**, a structural fact worth surfacing for product planning. Icon-only buttons consistently carry `aria-label`. Status is consistently paired with text, not color alone, everywhere spot-checked. Minor inconsistency: `RegisterForm` uses explicit `htmlFor`/`id` label pairing while seller forms rely on implicit wrapping — both valid, just inconsistent technique. **VERIFIED** (spot-check, not exhaustive).

### 1.8 Client-side storage
Only `localStorage`, five keys, all non-sensitive (guest cart, coupon code, saved addresses sans payment data, the dead preview-order store, recently-viewed IDs). No auth token or session identifier is ever stored client-side — session state is a server-set httpOnly cookie. **VERIFIED — correct and safe usage.**

### 1.9 Dead code summary
`CartProvider`/`useCart` (mounted globally, zero real consumers), `lib/api/orders.ts` (zero importers), `components/ui/PrimitiveShowcase.tsx` (zero importers), plus the duplicated `PreviewDisclosure` and duplicated client-side validation constants already noted. None of these are harmful today, but they are confusing to a new engineer trying to understand "what's actually live," and the orphaned `CartProvider` specifically runs a wasted fetch/resolve effect on every single page load. **VERIFIED.**

---

## 2. Backend architecture (Stage B2)

Full inventory: **39 API route files**, all under `src/app/api/**/route.ts`, every one traced handler → service → Prisma `where` clause by direct code reading (not inferred). See the project's own prior per-route table (reproduced in full in the companion research transcript; summarized here).

### 2.1 Headline result: ownership scoping is consistently correct
Every customer/seller/driver-scoped mutation or query filters its Prisma `where` clause by an id resolved **server-side from the authenticated session** — never a client-supplied id:
- Customer routes: `where: { userId }` (addresses, cart, orders) — e.g. `server/orders/service.ts:412-413` (`getOrder`), `server/cart/service.ts:317,357` (cart item mutations).
- Seller routes: `where: { ..., sellerId }` — e.g. `server/orders/sellerService.ts:248-251` (`acceptShipment`), `:403-406` (`dispatchShipment`), `server/seller/inventory.ts:117-120,152-155` (offer/stock updates).
- Driver routes: `where: { ..., driverId }`, with `deliverDriverShipment` additionally re-checking `shipment.driverId !== driverId` **inside** the row lock as a second, belt-and-suspenders check (`server/orders/driverService.ts:196-201`).

A foreign row (another seller's offer, another driver's job, another customer's order) resolves to `404`, not `403` — deliberately making it "indistinguishable from missing" (explicit module comment, `driverService.ts:1-3`). **No IDOR-class finding was identified anywhere in the 39-route inventory. This is a genuine strength and should be explicitly preserved in any re-architecture.** **VERIFIED.**

### 2.2 Validation, errors, and CSRF
Every route uses a shared `handleApi()` wrapper (`server/http.ts:109-122`) which runs `assertSameOrigin()` (CSRF defence — rejects cross-site `sec-fetch-site`, validates `Origin` against the configured app origin, `server/http.ts:63-94`) before the handler executes, and funnels every thrown error through `errorResponse()` (`:21-56`), which maps `ApiError`/`ZodError` to structured `{error:{code,message,field?}}` JSON and logs only the error **name** (never message/stack/DB detail) for anything unrecognized. Input validation is zod-based, one schema file per domain (`server/*/validation.ts`), applied via `parseJson(req, schema)`. **VERIFIED — a sound, consistent pattern with no route found bypassing it.**

### 2.3 Supplementary capability findings
- **File uploads: none, anywhere.** No `formData()`/multipart parsing, no cloud-storage SDK. Dispatch "documents" (challan/invoice/e-way/weighbridge) are booleans/strings only — a seller asserts a document exists, nothing is ever actually captured or stored. This single gap is the root cause of two separate portal findings (Deliverable 3: DELV-04 photo-proof, SELL-06 KYC-cheque-never-verifiable).
- **Background jobs/queues/cron: none.** All time-based transitions (accept/dispatch/review deadlines, OTP lockout) are computed lazily by comparing stored deadline timestamps to `new Date()` at request time, not pushed by a scheduler. This is a reasonable, intentionally-simple design for current scale (explicitly the project's own decision: "background timers wrapped in a single module so a later phase can swap polling to a worker without touching domain code," per `ARCHITECTURE_PROPOSAL.md §1`) but means a shipment whose deadline passes with **no further user action on it** will never automatically flip to `missed`/`late` until someone next reads it.
- **Email/SMS delivery: none.** The `Notification` Prisma model exists but has **zero API route and zero server-side reader/writer** — it is referenced only by frontend mock components. A notification is never actually sent to anyone by any channel.
- **Admin API surface: does not exist.** `requireAdmin()` is defined (`server/auth/current.ts:77-79`) but is never imported by any route file — confirmed by a repository-wide grep. There is no `src/app/api/admin/**` directory at all. The `admin` role exists only as a `Role` enum value and in narrative UI copy ("payout is frozen until an admin decides"). This directly corresponds to `DECISIONS.md` D7's call for "backend admin APIs (role `admin`) + a temporary exception console," which was never built — not a partial implementation, a complete absence.

---

## 3. Database architecture (Stage B3)

20 Prisma models, 8 enums, 2 migrations, all read in full (see the project's own prior database-audit transcript for the complete model-by-model inventory; key findings summarized here with exact citations).

### 3.1 Money and rate precision (a real strength)
Every monetary column is `Decimal(14,2)`; every rate/percentage column is `Decimal(7,6)` (schema header, lines 4–12) — an explicit, documented, and consistently-applied decision (D16) to never use JavaScript floating point for money. Non-money metrics (`unitWeightKg`, `rating`) correctly remain `Float` per the same header's own carve-out. **VERIFIED, no exceptions found.**

### 3.2 Deletion policy
Stated two-tier policy (schema header lines 31–34: convenience/UI rows Cascade, financial/audit rows Restrict) is followed within its own vocabulary — no financial/audit row is ever Cascade-deleted. A third, **unstated** bucket (`SetNull`) is used for optional cross-links (`Driver.userId`, `Vehicle.driverId`, `Shipment.vehicleId/driverId`, `OrderLine.sellerOfferId/shipmentId`) — defensible, but the header's binary framing is incomplete documentation of the actual policy. `Review.userId` is Cascade while `Review.productId` is Restrict — an undocumented asymmetry (reviews aren't named in either bucket of the header comment). **VERIFIED.**

### 3.3 Missing index
`EscrowEntry` has indexes on `[type,createdAt]` and `[shipmentId]` but **not** on `sellerId` alone, despite `sellerPaymentsSummary()` (`server/orders/sellerService.ts:455`) querying `db.escrowEntry.findMany({ where: { sellerId } })` on every seller Payments-page load — a genuine, currently-small-but-real missing-index gap that will worsen as escrow history grows. **VERIFIED as a gap, not yet VERIFIED as a measured performance problem at current data volumes (seed data is small — see §3.6).**

### 3.4 Data-consistency risks
- **No soft-delete anywhere** (`grep "deletedAt"` → zero matches); every delete is hard, reinventing a boolean per model instead (`Seller.vacationMode`, `SellerOffer.status`, `Coupon.isActive`).
- **No actor-attribution (`createdBy`) field on any financial/audit row** — `EscrowEntry` and `ShipmentEvent` record a coarse `ShipmentActor` enum (vendor/driver/customer/system) but never a specific `User.id`.
- **No CHECK constraints on money** — nothing in either migration file prevents a negative `grossTotal`, `price`, or `fee` at the database layer; correctness depends entirely on application-level validation.
- **Dual lifecycle vocabularies**: `Order.stage` (5 values, customer-facing) and `Shipment.status` (12 values, seller/driver-facing) are two independently-updated state machines for conceptually one lifecycle, with no DB-level mechanism enforcing their consistency for a multi-seller order (one order, several shipments, several independent status values).
- **`ShipmentIssue.shipmentId` is `@unique`** — the model structurally permits at most one issue **ever** per shipment, not one-open-at-a-time, which could silently block recording a second, unrelated dispute on an already-once-disputed shipment.
- **OTP has no expiry column**, self-flagged as open in the schema's own header comment and tied to the still-open D5 decision (SMS channel) — but note D5 is specifically about the SMS channel; OTP expiry policy itself has never been logged as its own numbered decision (see Deliverable 8).
- **No admin/activity-log model exists** despite the admin-portal reference's "Activity log" being one of its 8 primary navigation sections and "entries cannot be changed or deleted" being an explicit design requirement in that reference.
**VERIFIED**, all by direct grep/read, not inference.

### 3.5 Marketplace entity coverage
All core marketplace entities exist as real models (User/Seller/Product/SellerOffer/Cart/Order/OrderLine/Shipment/Address/Review/Coupon/Wishlist). Two notable absences: **no dedicated `Payment` model** (only the `EscrowEntry` ledger and free-text `Order.paymentMethod`/`paymentLabel`, defaulting to `"COD"` — appropriate for the current COD-only scope, but would need a real model before any payment-gateway integration); and **`Dispute` is only a `ShipmentIssue` row plus two `ShipmentStatus` values**, not a dedicated model with its own resolution/audit lifecycle, which will matter once admin dispute-resolution is actually built (it needs partial/full-refund/reject-claim outcomes the current model doesn't structurally capture beyond `claim: Decimal?`).

### 3.6 Seed data realism
Small, hand-curated demo dataset: 7 sellers (1 fully fleshed-out "UltraBuild Co." with 16 orders/shipments/30 escrow entries; 6 "pool" sellers with catalogue listings but **zero** seeded orders/shipments/escrow activity), 48 products, 48 seller offers. The seed exercises most of `ShipmentStatus` and most of `EscrowEntryType` (held/commission/released/refund/withdrawn) but never produces a `penalty` escrow entry, so a fresh dev database has no example of that code path to test against. This is sufficient for UI/API smoke-testing and single-happy-path demoing, but is not representative of production scale or of every enum value. **VERIFIED.**

---

## 4. Authentication and authorization (Stage B4)

- **Password storage**: bcrypt, cost 12 (`server/auth/session.ts:13,99`). **VERIFIED.**
- **Session**: opaque 256-bit random token (`randomBytes(32)`, base64url), only its SHA-256 digest persisted (`Session.tokenHash`), 7-day TTL, httpOnly cookie (`Secure` in production, `SameSite=Lax`) — matches `DECISIONS.md` D21 exactly. **VERIFIED.**
- **Role resolution**: `resolveSellerForUser`/`resolveDriverForUser` look up the `Seller`/`Driver` row by the **authenticated user's own id** (`ownerUserId`/`userId`), never by a client-supplied id or role claim. Public registration is hard-restricted to `role: "customer"` (`session.ts:108`) — there is no code path anywhere that can produce a `seller`/`driver`/`admin` user from the public API; those are provisioned only via `prisma/seed.ts`. **VERIFIED — this is a sound, server-enforced authorization model; frontend restrictions (hiding seller/driver nav from a customer) are a UX convenience layered on top of, not a substitute for, this backend enforcement.**
- **Gap**: `requireAdmin()` exists but is unreachable (§2.3) — there is no live code path to audit for admin authorization correctness, because there is no admin feature to protect yet.
- **Gap**: no automated test specifically exercises the cross-tenant 404 case for every route (the Delivery-portal research pass noted this explicitly for driver routes; the same observation likely generalizes to seller routes) — the protection is code-verified correct by direct reading, but not regression-tested, so a future refactor could silently reintroduce an IDOR without a failing test to catch it.

---

## 5. Testing, CI, and observability (Stage B5)

- **19 Vitest test files**, no `.tsx` tests. A consistent, sound split: pure-function suites need no database (pricing, validation, localStorage cart logic — 11 files) and run unconditionally; DB-integration suites (8 files: auth, catalog, cart, seller inventory, seller profile/delivery, orders service, seller-order lifecycle, driver lifecycle) are correctly gated behind `describe.skipIf(!hasDb)` and only execute when `DATABASE_URL` is set. **Coverage of critical workflows is genuinely good at this layer**: registration/login, cart persistence/concurrency, checkout/order-placement (including idempotency and concurrent-submission races), seller product CRUD, full seller order lifecycle, full driver delivery lifecycle (including OTP lockout and short-quantity disputes), and the newer seller profile/delivery/payments/performance additions are **all** covered by at least one DB-backed test. **VERIFIED.**
- **Zero real end-to-end/browser coverage.** The sole Playwright spec (`app/tests/example.spec.ts`) is the unmodified `npm init playwright` scaffold, testing `playwright.dev`'s own marketing site — it has never been pointed at this application. **VERIFIED.**
- **No working CI exists.** The one GitHub Actions workflow found lives at `app/.github/workflows/playwright.yml` — GitHub Actions only discovers workflows under `<repo-root>/.github/workflows/`, and there is no such directory at the actual repo root. Even if relocated, the workflow has no `working-directory: app` and the repo root has no `package.json`, so `npm ci` would fail immediately; it also only ever runs the placeholder Playwright test, never lint/typecheck/unit-test/build. **This is a hard, verifiable fact (file location + GitHub's own discovery rule), not a severity judgment call: there is currently no automated gate on any pull request or push.**
- **No coverage reporting** configured in `vitest.config.ts`.
- **Lint/typecheck are strict and unmodified**: `tsconfig.json` has `strict: true` with no relaxed sub-flags; `eslint.config.mjs` extends Next's default preset with no disabled rules. Good baseline hygiene; it is simply never enforced automatically because there is no working CI to run it (and no `npm run typecheck` script to run it even manually in one step).
- **Observability**: no APM/structured logging of any kind (grepped for Sentry/Datadog/OpenTelemetry/winston/pino — zero matches). Error logging is limited to two ad hoc `console.error` call sites in the entire `src/server/**` tree, one of which (the health check) deliberately redacts `DATABASE_URL` before logging. Everything else that throws an `ApiError` produces **no log entry at all** by design (to avoid leaking internals to the client, which is correct), meaning there is currently no way to see, in production, how often a given `ApiError` code is actually being hit.

---

## 6. Technical debt summary (cross-cutting)

Ranked by how directly each explains "the delivered implementation does not fully match the supplied UI references and some features are incomplete or non-functional" (the stated client feedback that motivated this engagement):

1. **No file-upload capability anywhere** → delivery photo-proof is fake (client-only, stripped before the API call) and seller KYC documents can never be verified. One missing capability, two separate visible "broken feature" symptoms.
2. **Seller sidebar score vs. real Performance score mismatch** (SELL-02) → the single most visible, easiest-to-notice "this app contradicts itself" bug, present on every seller page.
3. **No admin implementation at all**, despite being one of the four named "principal user experiences" in this very engagement's own brief, and despite `DECISIONS.md` D7 having approved at minimum a stopgap exception console.
4. **No working CI** → nothing has been mechanically preventing regressions from reaching `main`/the deployed branch since this repository's inception.
5. **Mid-migration mock/real split**, mostly but not 100% disclosed, across both the customer home page and the seller dashboard — exactly the kind of thing that reads as "some features are incomplete" to an end client clicking around.
6. **Stale project documentation** (`HANDOFF.md`, two `docs/*READINESS*.md` reports, several in-code comments) that actively misdescribes the current state of the system, which if trusted uncritically compounds every other finding above.

This concludes the Current Architecture Audit. See Deliverable 3 for the per-portal, per-screen UI gap registers; Deliverable 5 for the backend-framework decision; Deliverable 7 for how these findings map into a prioritized roadmap.
