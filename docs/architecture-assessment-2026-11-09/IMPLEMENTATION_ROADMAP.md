# IMPLEMENTATION_ROADMAP.md

Principal Architect discovery phase — Deliverable 7 of 8. Work packages are deliberately small and independently verifiable, per instruction. Priority levels per the brief's own definitions (P0 critical / P1 high / P2 medium / P3 low).

---

## P0 — Critical

### WP-P0-1 — Shipment settlement and timeout scheduler
- **Objective**: Give the order lifecycle a real way to reach `settled` (releasing escrow to the seller's payable balance) and `missed` (accept-window timeout), which currently do not exist anywhere in production code (Deliverable 4 §2, directly verified absent).
- **Scope**: One scheduled task (framework-agnostic; a Next.js route hit by an external scheduler, or a `cron`-triggered script, is sufficient at current scale — no queue/worker infrastructure needed). Logic: find shipments in `review` whose `reviewEnds < now` with no open `ShipmentIssue`, write `commission`+`released` `EscrowEntry` rows (reusing the exact Decimal-exact math already proven in `prisma/seed.ts`'s settlement calculation) and flip `status:"settled"`; find shipments in `new` whose `acceptBy < now`, flip `status:"missed"` and restore reserved stock/refund held escrow (reusing the existing `restoreReservedStock`/`refundHeldEscrow` helpers already used by `rejectShipment`).
- **Relevant files/modules**: new `src/server/orders/settlement.ts` (or similar), reusing `src/server/orders/lifecycle.ts` helpers; a new thin route (e.g. `src/app/api/internal/settle/route.ts`) protected by a shared secret header (not a user session, since it's machine-invoked), triggered by an external scheduler (Render Cron Job, GCP Cloud Scheduler, or equivalent, once the deployment-target decision in Deliverable 8 is made).
- **Dependencies**: none technical; benefits from (but does not require) the deployment-target decision to pick the actual scheduler mechanism.
- **Risks**: money-math correctness (mitigate by reusing seed.ts's already-proven computation, and testing against the full enum of `EscrowEntryType`, including the currently-untested `penalty` case for late dispatch).
- **Expected result**: a real order, dispatched and delivered cleanly, reaches `settled` and a real, non-seeded `released` escrow entry appears for the seller, without any human intervention.
- **Acceptance criteria**: a new integration test creates an order, drives it through accept→pack→dispatch→deliver, advances the clock (or injects a past `reviewEnds`), runs the settlement task, and asserts `status==="settled"` plus the correct `commission`/`released` amounts; a second test does the same for an expired `acceptBy` → `missed` + stock/escrow restoration.
- **Required tests**: new Vitest DB-integration test file, following the existing `describe.skipIf(!hasDb)` pattern.
- **Sequence**: first — highest business-logic value, zero dependency on any other package.

### WP-P0-2 — Fix CI
- **Objective**: Make the one existing CI workflow actually run, and have it gate on more than a placeholder test.
- **Scope**: Move `app/.github/workflows/playwright.yml` content to a new workflow at the repo root `.github/workflows/ci.yml`; add `working-directory: app` to every step; add lint (`npm run lint`), a new `typecheck` script (`tsc --noEmit`, does not currently exist — add it to `package.json`), and `npm run test` (the DB-free subset, or the full suite against a CI-provisioned Postgres service container) as required jobs; keep Playwright as a separate, non-blocking job until WP-P1 work gives it something real to test.
- **Relevant files/modules**: `.github/workflows/ci.yml` (new, repo root), `app/package.json` (`typecheck` script).
- **Dependencies**: none.
- **Risks**: low — this is additive tooling, not application-logic change.
- **Expected result**: every PR against `feature/backend-mvp`/`main` is automatically lint/typecheck/test-gated.
- **Acceptance criteria**: a PR with a deliberate lint error or type error fails CI; a clean PR passes.
- **Sequence**: first alongside WP-P0-1 — both are prerequisites for safely iterating on everything below.

### WP-P0-3 — Resolve the deployment-target conflict (decision, minimal doc work)
- **Objective**: Eliminate the three-way conflict (D10: Docker · actual: Render · brief: GCP) with one explicit, dated decision recorded in `DECISIONS.md`, before any further deployment-specific work is done.
- **Scope**: A single new `DECISIONS.md` row (e.g. `D26`) stating the chosen target and explicitly superseding D10 if GCP is chosen.
- **Dependencies**: requires business/developer input — listed in Deliverable 8, not resolvable by engineering alone.
- **Risks**: none technical; the risk is *not* deciding, and continuing to accumulate artifacts for three different targets.
- **Expected result**: one unambiguous deployment target for all future work.
- **Acceptance criteria**: `DECISIONS.md` has a current, approved row; unused deployment artifacts for rejected targets are either removed or explicitly marked historical.
- **Sequence**: before any GCP-specific provisioning work begins; can run in parallel with WP-P0-1/2.

### WP-P0-4 — Fix the seller sidebar score mismatch (SELL-02)
- **Objective**: Stop the application visibly contradicting itself — the same seller, same session, sees a different "score" in the sidebar vs. the Performance page vs. the dashboard KPI tile.
- **Scope**: `src/components/seller/SellerSidebar.tsx` — replace its mock-data `computeScore(state.stats)` call with the already-fetched `useSellerLive().summary.score`.
- **Relevant files/modules**: `SellerSidebar.tsx` only; no backend change (the real score already exists and is already being fetched for other parts of the same page tree).
- **Dependencies**: none.
- **Risks**: minimal — pure data-source swap, same component.
- **Expected result**: sidebar score == Performance-page score == dashboard KPI-tile score, always, for the same seller.
- **Acceptance criteria**: manual or automated check across all three surfaces showing identical numbers.
- **Sequence**: trivial effort, highest visible-bug-fix value — do immediately, independent of everything else.

---

## P1 — High

### WP-P1-1 — Real file uploads: delivery photo-proof and seller KYC documents
- **Objective**: Replace the two fabricated "proof" affordances (DELV-04, SELL-06) with genuine capture-and-store behavior, fixing the single root cause (no file-upload capability anywhere) behind both.
- **Scope**: One object-storage integration (provider depends on WP-P0-3's outcome — Cloud Storage if GCP, S3-compatible otherwise); a new `Shipment.proofPhotoKey` (or similar) column **— this is the one package in this roadmap that requires a schema change**, flagged accordingly; a signed-URL upload endpoint; wire the existing (currently decorative) photo-confirm UI in `DeliveryJobDrawer.tsx` to actually upload before calling `deliverDriverJob`; add an admin-or-automated KYC-document upload+review path for `Seller.kycCheque`.
- **Dependencies**: WP-P0-3 (storage provider choice), and for the KYC half, ideally sequenced after WP-P1-5 (admin backend) so there's somewhere for a human to actually review the upload — if admin isn't ready yet, a minimal temporary "auto-approve on upload" is acceptable *if explicitly disclosed as such*, never silently claimed as "verified by an admin."
- **Risks**: schema change (coordinate via a proper Prisma migration, additive/nullable column, no data loss); ensure uploaded files are scoped/authorized the same way every other resource in this app already is (object keys namespaced by shipment/seller id, signed URLs short-lived, never a public bucket).
- **Expected result**: a real photo is stored and retrievable for a delivered shipment; a seller's KYC document upload is genuinely stored and has a real path to "Verified."
- **Acceptance criteria**: uploading a photo during delivery completion persists an object-storage key on the `Shipment` row, retrievable afterward; a KYC upload is stored and its status can change from `pending` to `verified` through a real, audited action.
- **Required tests**: integration test asserting the upload flow persists and is retrievable; ownership test asserting a driver/seller cannot read another's uploaded object via a guessed key.

### WP-P1-2 — Seller vehicle/driver CRUD
- **Objective**: Fix the dead end where a seller who adds a vehicle via Settings sees it nowhere real, and a seller with zero seeded vehicles can never dispatch anything (SELL-05).
- **Scope**: `POST`/`DELETE /api/seller/vehicles` and `/drivers`, backed by the already-existing `Vehicle`/`Driver` Prisma models (no schema change needed — these models already exist and are already read by the real dispatch flow); replace the mock `addVehicle`/`removeVehicle` in `SellerStoreProvider.tsx` with real calls; same validation rules already specified in the reference (vehicle-number regex, duplicate check, driver name/phone).
- **Relevant files/modules**: new `src/server/seller/fleet.ts` (mirroring the existing `src/server/seller/profile.ts`/`delivery.ts` pattern already established this codebase's own prior session), new API routes, `src/app/seller/delivery/page.tsx` + `SellerStoreProvider.tsx` updates.
- **Dependencies**: none.
- **Risks**: low — the ownership-scoping pattern to follow is already proven correct elsewhere in this exact codebase (`where: {..., sellerId}`).
- **Acceptance criteria**: a vehicle added via the Delivery page is immediately selectable in the real Dispatch dialog; a seller with zero vehicles can add one and then successfully dispatch an order.

### WP-P1-3 — Dashboard mock-data consolidation (SELL-01)
- **Objective**: Stop the "Needs your attention" dashboard list from linking to non-existent mock order IDs.
- **Scope**: Compute "Needs your attention" (new/late/disputed shipments) and "Top products" from already-fetched real data (a small additive query alongside the existing `sellerSummary()`), or, as a smaller interim fix, strip the dead "Open" deep-link from mock rows until the real version lands.
- **Relevant files/modules**: `src/server/orders/sellerService.ts` (extend `sellerSummary` or add a sibling query), `src/app/seller/page.tsx`.
- **Dependencies**: none.
- **Acceptance criteria**: every "Open" link on the dashboard opens a real order drawer; no link can silently no-op.

### WP-P1-4 — Admin backend MVP
- **Objective**: Build the first real slice of the admin portal — the one "principal user experience" named in this engagement's brief with zero current implementation.
- **Scope**: Deliberately small first slice, not the full 8-section reference: (a) a dispute-resolution action (partial/full refund/reject claim against an open `ShipmentIssue`, writing the corresponding `refund`/`released` escrow entries), since this is the one admin capability the current system has no other way to ever perform (today, a disputed shipment's payout stays frozen forever with no mechanism to unfreeze it — a real gap this audit did not have scope to re-verify in full depth but is implied by the confirmed absence of any admin/dispute-resolution code path); (b) a read-only overview (escrow KPIs, seller list, order list) to establish the auth boundary and basic navigation shell.
- **Relevant files/modules**: new `src/app/admin/**` (if staying in Next.js) or a new FastAPI service (if Backend Decision §3's conditions are met) + `requireAdmin()` (already defined, currently unreachable — this package is exactly what finally exercises it); a new `AdminAction`/activity-log model (schema change, additive).
- **Dependencies**: Backend Architecture Decision (Deliverable 5) must be settled first — this package's *location* depends on it, though its *scope* does not.
- **Risks**: this is the largest single package in this roadmap; keep the first slice small (dispute resolution + read-only overview only) and treat the remaining 6 reference sections (Approvals, full Payouts workflow, Users, Sellers scorecards, full Settings/business-rule-constants screen, full Activity log) as separate, later packages.
- **Acceptance criteria**: an authenticated admin user can resolve a real open dispute and see the escrow/order state change accordingly; a non-admin user is rejected (404/403, matching the existing project-wide convention) from every admin route.

### WP-P1-5 — Customer wishlist
- **Objective**: Implement CUST-02 — the `Wishlist`/`WishlistItem` model already exists in the schema; only the API and UI wiring are missing.
- **Scope**: `GET/POST/DELETE /api/wishlist`, wire the existing (currently permanently-disabled) heart-toggle buttons and the buy-box button, add a `/wishlist` route.
- **Dependencies**: none — the schema already supports this.
- **Acceptance criteria**: toggling the heart persists across reload for a signed-in customer; `/wishlist` lists and allows removing saved items.

### WP-P1-6 — Customer review authoring
- **Objective**: Implement CUST-07 — the read side (`listProductReviews`, rating histogram) is already real; only submission is missing.
- **Scope**: `POST /api/products/:id/reviews`, ideally gated to customers with a `settled`/`delivered` order containing that product (`verifiedPurchase`), wire the existing (currently disabled) review-submission dialog.
- **Dependencies**: none.
- **Acceptance criteria**: a signed-in customer can submit a star rating + text review; it appears in the list and affects the histogram on reload; a non-purchaser can still review but is correctly marked not-verified (matching the existing `verifiedPurchase` field's apparent intent).

---

## P2 — Medium

| ID | Objective | Scope summary |
|---|---|---|
| WP-P2-1 | Standalone customer account/address page (CUST-08) | New `/account` route rendering the already-real address CRUD API |
| WP-P2-2 | Home-page mock-to-real migration (CUST-03/04) | Swap `Hero`/`CategoryTiles` off `lib/api/catalog.ts` onto `catalogDb.ts`/`listCategories()` |
| WP-P2-3 | PDP seller-selection wiring (CUST-05) | Lift seller-table selection state into `BuyBox` |
| WP-P2-4 | Automatic guest-cart merge (CUST-11) | Trigger merge on first authenticated cart load; keep manual button as fallback |
| WP-P2-5 | Header category sub-nav + search suggestions (CUST-01/09) | New sub-nav from real `listCategories()`; lightweight `/api/products?q=` suggestion endpoint |
| WP-P2-6 | Notification delivery pipeline | `notify(event,payload)` helper per Target Architecture §6; email provider gated by real credential presence |
| WP-P2-7 | Documentation resync | Update `HANDOFF.md`'s stale "next action," the two stale `docs/*READINESS*.md` reports, and the 2+ stale in-code comments found (`RecentlyViewedRow.tsx`, the three "browser-local" order-page comments) |
| WP-P2-8 | Observability baseline | Structured logging for every `ApiError`; one Sentry (or equivalent) integration |
| WP-P2-9 | Dead-code removal | Remove orphaned `CartProvider`/`useCart`, `lib/api/orders.ts`, `PrimitiveShowcase.tsx`; consolidate the two `PreviewDisclosure` implementations into one shared `ui/` component |

## P3 — Low

| ID | Objective |
|---|---|
| WP-P3-1 | Add missing `EscrowEntry([sellerId])` index |
| WP-P3-2 | Consolidate client/server validation (share GSTIN/phone/pincode/password-length rules from one source instead of two independently-maintained copies) |
| WP-P3-3 | Confirmation step before removing a seller's service-area pincode with active orders in it |
| WP-P3-4 | Typecheck/coverage tooling polish (combined `npm run verify` script bundling lint+typecheck+test) |

---

## Suggested sequence

1. **WP-P0-2** (fix CI) and **WP-P0-4** (sidebar score) in parallel — both are near-zero-risk, same-day fixes that should land before anything else to establish a safety net and remove the most visible embarrassment.
2. **WP-P0-3** (deployment decision) — a conversation, not code; can happen in parallel with (1).
3. **WP-P0-1** (settlement scheduler) — the highest-value fix, do as soon as CI exists to protect it.
4. **WP-P1-2** (fleet CRUD) and **WP-P1-3** (dashboard consolidation) — both small, independent, high-visibility seller-portal fixes.
5. **Backend Architecture Decision** finalized (organizational input required) → unblocks **WP-P1-4** (admin MVP)'s implementation language.
6. **WP-P1-1** (file uploads) — sequence after the deployment decision (storage provider) and ideally after admin exists (somewhere to review KYC uploads), but the delivery-photo half can proceed independently.
7. **WP-P1-5, WP-P1-6** (wishlist, reviews) — independent, can run in parallel with the above at any point.
8. **P2 work** — proceed opportunistically once P0/P1 are stable; WP-P2-7 (documentation resync) specifically should happen as soon as practical given this audit's own repeated finding that stale docs actively mislead.
9. **P3 work** — ongoing hygiene, no urgency.
