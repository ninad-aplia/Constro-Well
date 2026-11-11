# BUSINESS_WORKFLOW_MIGRATION_PLAN.md

Phase 02 — Deliverable 7 of 10. Fourteen workflows, each with dependencies, migration risk, testing requirements, and acceptance criteria. Ordered roughly by increasing risk (also reflected in the Migration Roadmap's tranches). Workflows 1-11 migrate *existing* behavior; 12-14 are net-new builds with no existing equivalent (explicitly flagged as such — "migration risk" doesn't apply to them in the same sense, since there is nothing to regress).

---

## 1. Authentication and sessions
- **Dependencies**: none upstream (foundational); everything else depends on this.
- **Scope**: `POST /auth/login`, `/auth/register`, `/auth/logout`, `GET /auth/me`, plus the `require_user/customer/seller/driver/admin` dependency chain reused by every other domain.
- **Migration risk**: the single highest-leverage, must-get-right-first domain, but the *logic itself* is simple to port exactly (Authentication Migration Plan). Primary risk is a bcrypt-verification mismatch or a timezone-naive expiry check (both addressed with specific mitigations in that document).
- **Testing requirements**: cross-backend session validation test (session created by one backend validates in the other); bcrypt cross-verification smoke test against real seeded hashes; expiry-boundary test (session 1 second past `expires_at` is rejected by both).
- **Acceptance criteria**: see Authentication Migration Plan §5, reproduced as the gate for this workflow specifically.

## 2. Product catalogue and search
- **Dependencies**: none (read-only, public).
- **Scope**: `GET /categories`, `/products`, `/products/[id]`, `/products/[id]/offers` — **plus**, critically, rewriting `product/[id]/page.tsx`, `search/page.tsx`, and 4 home-row Server Components to call these routes via HTTP instead of importing `catalogDb.ts`/`catalog/service.ts` directly (Dependency Inventory §1a). This second part is a **frontend code change**, not purely a backend migration, and must be scoped and tested as such.
- **Migration risk**: low for the backend logic itself (read-only, no money, no concurrency); **medium** for the frontend-rewrite part, since it changes 6 files' data-fetching mechanism and could introduce a loading-state regression if not matched to the existing Server-Component-blocks-until-data-ready behavior (an `await fetch()` in a Server Component preserves this; a client-side `useEffect` fetch would not and must not be used here).
- **Testing requirements**: snapshot/visual-equivalence check that `/`, `/search`, `/product/[id]` render identical HTML before and after the data-source switch (same product data, same pagination, same sort order); existing Vitest coverage for the service layer itself carries over unchanged since the service layer's Python reimplementation is tested the same way the TypeScript one is.
- **Acceptance criteria**: all 4 routes byte-compatible per the Contract Matrix; all 6 frontend files fetch via HTTP with no regression in SSR blocking/loading behavior; home page and search results visually/structurally unchanged.

## 3. Customer addresses
- **Dependencies**: Authentication.
- **Scope**: `GET/POST /addresses`, `PATCH/DELETE /addresses/[id]`.
- **Migration risk**: low — simplest stateful domain in the system (no money, no concurrency beyond the single-default-address invariant).
- **Testing requirements**: default-address invariant test (setting a new default un-defaults all siblings, in the same transaction) ported directly from the existing Vitest suite's equivalent coverage.
- **Acceptance criteria**: CRUD + default-invariant behavior identical; ownership-scoping (`where: {id, userId}` equivalent) ported and tested for the cross-customer 404 case specifically (Phase 01 noted this exact case lacked an automated test anywhere in the current codebase — this migration is the opportunity to add it, not just preserve the status quo).

## 4. Cart and coupons
- **Dependencies**: Authentication, Catalog (reads `SellerOffer`/`Product` data), Addresses (indirectly, via checkout preview which is a separate workflow).
- **Scope**: `GET /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/[itemId]`, `POST/DELETE /cart/coupon`.
- **Migration risk**: **medium** — real concurrency control here (`lockOffer`, Database Migration Plan §4) that must be preserved exactly; coupon logic (`BUILD10`/`FIRST250`/`FREESHIP` hardcoded fallback alongside an empty `Coupon` table, per Phase 01's finding) has a documented, slightly unusual design (D22) that must be understood, not just transliterated, to avoid silently "fixing" a deliberate workaround into a behavior change.
- **Testing requirements**: the existing concurrent-add-serialization test (`cart/service.test.ts`, confirmed by Phase 01 to exist and pass) must have a directly equivalent pytest counterpart proving the same race is still prevented; coupon-cookie round-trip test.
- **Acceptance criteria**: cart pricing (bulk tiers, per-seller delivery fee, coupon discount, tax) byte-identical to existing Decimal-exact output for a fixed set of test scenarios; concurrent-add race test passes against the new implementation.

## 5. Checkout and order placement — **highest-risk workflow in this plan**
- **Dependencies**: Authentication, Addresses, Cart, Catalog/stock (SellerOffer).
- **Scope**: `POST /checkout/preview`, `POST /orders`, `GET /orders`, `GET /orders/[id]`, `POST /orders/[id]/cancel`.
- **Migration risk**: **critical**. This single workflow contains: the deterministic idempotency-key hashing scheme (must produce byte-identical order IDs to the existing scheme for the coexistence window to be safe — Database Migration Plan §7), the sorted-multi-offer locking order (deadlock prevention, §4), the conditional stock-decrement guard (§3), the COD-cap enforcement, the multi-seller order-splitting logic, and the escrow "held" entry creation — i.e., essentially every correctness property this entire assessment has repeatedly flagged as needing exact preservation, concentrated in one workflow.
- **Testing requirements**: every one of Phase 01's 6 existing `orders/service.test.ts` integration tests (multi-seller split with re-read pricing, address/order ownership, cancellation rules, mixed-delivery guard, idempotent concurrent submission, and the COD-cap enforcement) must have a line-for-line equivalent pytest test, run against the **same kind of real, disposable test Postgres** the existing suite uses — not mocked. Additionally: a dual-write verification test during the coexistence window (place an order via Next.js, verify FastAPI's read of it via `GET /orders/[id]` is byte-identical, and vice versa for a FastAPI-placed order read via the old Next.js route, if both routes are briefly live simultaneously during rollout).
- **Acceptance criteria**: 100% of the ported tests pass against real Postgres; a manual, recorded test of the full flow (browse → cart → checkout → place order → view in order history → cancel) via the FastAPI-backed routes with no visible behavior change; the idempotency-key hash function verified byte-identical via a direct unit test comparing both implementations' output for the same (user_id, key) input.
- **Sequencing note**: this workflow should be the **last** core-business workflow migrated (Migration Roadmap), specifically because every other workflow's migration builds confidence in the overall pattern (auth bridging, transaction/lock porting, DTO-shape fidelity) before this highest-consequence workflow is attempted.

## 6. Seller inventory and products
- **Dependencies**: Authentication (seller role), Catalog (products the seller lists against).
- **Scope**: `GET/POST /seller/products`, `PATCH /seller/products/[offerId]`, `PATCH /seller/products/[offerId]/stock`.
- **Migration risk**: **medium**, elevated specifically by the pre-existing, unlocked lost-update race found this phase (Database Migration Plan §5) — this is the one workflow where "faithfully preserve existing behavior" and "fix a known bug" are in tension, flagged for an explicit decision (Risks & Open Questions).
- **Testing requirements**: existing ownership-scoping tests (`inventory.test.ts`) ported directly; **new** test for the lost-update race, regardless of whether the fix decision is "preserve" or "fix" — if preserving, the test documents the known limitation explicitly rather than leaving it silently undiscovered in the new codebase too.
- **Acceptance criteria**: CRUD + auto-pause-at-zero-stock behavior identical; explicit, written decision recorded on the lost-update race (fix or preserve), not silently inherited either way.

## 7. Seller order processing
- **Dependencies**: Authentication (seller), Checkout/Orders (reads shipments created there), Catalog/stock (restores stock on reject).
- **Scope**: `GET /seller/orders`, `/orders/[shipmentId]`, `/accept`, `/pack`, `/reject`, `/dispatch`.
- **Migration risk**: **high** — the conditional-`updateMany`-with-expected-prior-status pattern (Database Migration Plan §3) is this workflow's core correctness property across all 4 transitions, plus the e-way/weighbridge validation logic and the vehicle/driver ownership re-check at dispatch.
- **Testing requirements**: the existing `sellerService.test.ts` lifecycle test ("lists only own shipments, accepts, packs, dispatches and blocks repeats") and the reject/refund test, both ported directly; an explicit **concurrent double-accept test** (two near-simultaneous accept requests for the same shipment — only one should succeed, the other should get `409 invalid_transition`) if not already covered identically by the existing suite (confirm before assuming).
- **Acceptance criteria**: all 4 transitions correctly guarded by sellerId + expected-prior-status; e-way/weighbridge/docs validation identical; stock-restore-on-reject and escrow-refund-on-reject both verified via a real database read, not just a mocked assertion.

## 8. Driver assignment and delivery
- **Dependencies**: Authentication (driver), Seller order processing (dispatch creates the job the driver sees).
- **Scope**: `GET /driver/jobs`, `/jobs/[shipmentId]`, `/accept`, `/issue` (the `/deliver` route is split out as workflow 9, given its outsized complexity/risk).
- **Migration risk**: **medium** — ownership scoping (the double-check pattern at `deliverDriverShipment`/`reportDriverIssue`, Phase 01's Deliverable 3 finding) must be preserved exactly, including the deliberate 404-not-403 choice for a foreign shipment.
- **Testing requirements**: existing driver-portal ownership tests ("shows only jobs assigned to the authenticated driver") ported directly.
- **Acceptance criteria**: cross-driver access attempts consistently 404, not 403, matching the existing deliberate design.

## 9. OTP verification and delivery issues
- **Dependencies**: Driver assignment, Seller order processing (OTP generated at dispatch).
- **Scope**: `POST /driver/jobs/[shipmentId]/deliver`, `/issue`; the OTP crypto chain (`security/otp.ts` equivalent).
- **Migration risk**: **high** — this is a security-sensitive crypto port (bcrypt hash for verification + AES-256-GCM for customer display), the 3-try lockout counter, the shortfall-dispute proration math (Decimal-exact), and the single-row lock serializing concurrent delivery attempts, all concentrated in one function.
- **Testing requirements**: every one of the existing `driverService.test.ts` suite's 7 cases (ownership scoping, idempotent accept, OTP lockout after 3 wrong tries, successful delivery, short-quantity dispute, issue reporting, concurrent-delivery-attempt guard) ported as line-for-line pytest equivalents; a dedicated test asserting FastAPI's AES-256-GCM implementation can decrypt an OTP that was encrypted by the **existing Node implementation** (and vice versa) using the same `OTP_ENCRYPTION_KEY` — critical for the coexistence window, since an order dispatched by (old or new) Next.js must have its OTP readable by whichever backend later serves the customer's order-detail view.
- **Acceptance criteria**: the cross-implementation AES-GCM compatibility test (above) passes; all 7 ported test cases pass; the 3-try lockout and its exact error messages (which vary per remaining-tries count, per the Contract Matrix) match exactly.

## 10. Escrow and financial records
- **Dependencies**: Checkout/orders (creates "held" entries), Seller order processing + Cancellation (creates "refund" entries), the new Settlement job (workflow not in this list of 14 but covered in Deliverable 9/Phase 01's roadmap — creates "commission"/"released" entries, currently missing entirely).
- **Scope**: no dedicated API routes of its own (escrow is read via `sellerPaymentsSummary`, workflow 11) — this entry covers the **write-side** ledger discipline: every `EscrowEntry.create` call site (exactly 2 found to exist in production code this phase — "held" at order placement, "refund" at cancel/reject) plus the entirely-missing "commission"/"released" creation (the confirmed settlement gap).
- **Migration risk**: **critical** for the same reason as workflow 5 — this is literally the ledger of money owed to sellers. Any arithmetic discrepancy here is a real financial-reporting defect, not a cosmetic one.
- **Testing requirements**: a complete-ledger-balance test: for a given order, sum of all `EscrowEntry` amounts across its lifecycle (held, then either refund-in-full, or commission+released summing back to the held amount minus commission) must reconcile exactly, tested with real `Decimal`/`Numeric` values, not floats, at every step.
- **Acceptance criteria**: ledger reconciliation test passes for every lifecycle path (full refund, full settlement, no path currently exists for "commission" alone without "released" accompanying it — confirm this pairing is preserved as atomic, not just usually-together).

## 11. Seller performance and payments
- **Dependencies**: Seller order processing (shipment history feeds performance stats), Escrow (ledger feeds payments summary).
- **Scope**: `GET /seller/payments`, `/performance`, `/summary`.
- **Migration risk**: **low-medium** — read-only aggregation, but **this phase found the two Decimal-precision display exceptions here specifically** (Database Migration Plan §6) — the FastAPI port is the natural point to fix these (sum as `Decimal` throughout), which this document recommends doing, flagged explicitly as a conscious, tested change, not a silent one.
- **Testing requirements**: port the existing `sellerPaymentsSummary`/`sellerPerformanceStats` Vitest tests (confirmed by Phase 01's Testing audit to exist and cover both functions) directly; add a new test asserting the balance/ledger totals are computed via exact Decimal arithmetic (would have caught the found display-precision issue had it existed before).
- **Acceptance criteria**: `score` and `balance` figures match the existing implementation's output for the same underlying data (within the precision-fix's intentional, documented improvement — i.e. should match to the displayed 2 decimal places, with the new version being the more-correct one in the rare case they'd have differed due to float-summation error).

## 12. Admin and dispute management — **NET NEW, no existing equivalent**
- **Dependencies**: Authentication (`requireAdmin`, already defined, currently unreachable — Phase 01), Escrow (dispute resolution writes refund/release entries), Seller order processing (disputes originate from shipment issues).
- **Scope**: build directly in FastAPI, per Phase 01's own roadmap recommendation (`WP-P1-4`) — a minimal first slice (dispute resolution against an open `ShipmentIssue`, writing the correct `refund`/`released` escrow entries; a read-only overview). "Migration risk" in the usual sense does not apply (nothing exists to regress), but the **logic itself must correctly reuse** the exact escrow/stock-restoration helpers already proven correct in the Next.js codebase (`restoreReservedStock`, `refundHeldEscrow` equivalents) rather than reinventing the math.
- **Testing requirements**: new pytest suite from scratch; must include a test that a non-admin role is correctly rejected (404/403 per the existing project-wide convention) from every admin route.
- **Acceptance criteria**: an admin can resolve a real open dispute end-to-end; the resulting escrow/stock state is correct and verified against a real test database.

## 13. Notifications — **NET NEW**
- **Dependencies**: every workflow that should trigger one (new order, dispute opened, payout released, etc.).
- **Scope**: the `notify(event, payload)` pattern proposed in Phase 01's Target Architecture §6 — gives the currently-orphaned `Notification` model a real writer, optionally calls an email provider if configured.
- **Migration risk**: n/a (net new); the only real risk is scope creep (do not build SMS — D5 remains open per Phase 01).
- **Testing requirements**: a notification row is created for each defined trigger event; email-sending is correctly no-op'd when no provider credential is configured (matching the project's own "no fake success" discipline already applied to OTP/SMS).
- **Acceptance criteria**: triggering a defined event (e.g. placing an order) produces exactly one `Notification` row, visible via whatever UI eventually reads it.

## 14. File uploads and KYC — **NET NEW**
- **Dependencies**: deployment-target decision (determines the object-storage provider), ideally Admin (workflow 12, for KYC review) though the delivery-photo half can proceed independently.
- **Scope**: signed-URL upload endpoint(s), a new (additive, Prisma-migrated) column for the photo-proof object key, wiring the existing-but-decorative photo-confirm UI to actually upload, and a real KYC-document upload + review path.
- **Migration risk**: n/a (net new) beyond the schema-change coordination already flagged in Phase 01's roadmap (`WP-P1-1`) and the ownership/authorization discipline that must be applied to object access exactly as rigorously as every other resource in this system (signed URLs short-lived, object keys namespaced by shipment/seller id, never a public bucket).
- **Testing requirements**: upload-then-retrieve round-trip test; an authorization test proving a driver/seller cannot access another's uploaded object via a guessed/enumerated key.
- **Acceptance criteria**: a real photo is captured and retrievable for a delivered shipment; a real KYC document upload has a genuine path to a "Verified" status change.

---

## Cross-workflow ordering constraint summary

Workflows 1 (auth) → 2 (catalog, incl. the frontend fetch-rewrite) → 3 (addresses) can proceed in roughly any order relative to each other once auth is proven. 4 (cart) depends on 1-2. 6-7 (seller inventory/orders) and 8-9 (driver/OTP) can proceed in parallel with each other once 1 is done, but **both must complete before 5 (checkout/orders) is attempted**, since 5 is the highest-risk workflow and benefits most from every other pattern (locking, Decimal math, DTO fidelity) having already been proven correct elsewhere first. 10-11 (escrow/payments) naturally follow 5/6/7. 12-14 (admin/notifications/uploads) have no ordering dependency on the others and can be built at any point — in practice, recommend building these **early**, in parallel with 1-4, specifically because they carry zero regression risk and give the team real FastAPI experience before the higher-risk workflows are attempted (this mirrors Phase 01's own "build net-new work in FastAPI first" recommendation).
