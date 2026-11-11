# FUNCTIONAL_WORKFLOW_AUDIT.md

Principal Architect discovery phase — Deliverable 4 of 8. Strictly read-only. This document traces complete user journeys end-to-end rather than individual screens (Deliverable 3 covers screens); it exists to catch broken *transitions* that a screen-by-screen review can miss. State-transition tables are derived directly from `prisma/schema.prisma` enums and the service-layer code that mutates them — no transition is listed that isn't backed by an actual `where`-guarded `updateMany`/`update` call I traced.

---

## 1. Customer workflow

**Registration → Login → Product discovery → Product selection → Cart → Checkout → Order creation → Payment → Order tracking → Delivery completion.**

| Step | Implemented? | Evidence | Notes |
|---|---|---|---|
| Registration | **Real** | `POST /api/auth/register` → `registerCustomer()`, bcrypt cost 12, hard-restricted to `role:"customer"` | Public signup cannot create seller/driver/admin accounts — correct by design |
| Login | **Real** (PARTIALLY VERIFIED — shares the same validated session primitives as registration; the login route itself was not re-read line-by-line) | `authenticateUser()`, same bcrypt/session module | |
| Product discovery | **Real**, with 2 mock home-page sections | Search/PDP/deal-rows query Postgres; Hero slides + featured category tiles still read the mock catalogue facade | See CUST-03/04 |
| Product selection | **Real**, one deferred feature | PDP fully DB-backed; seller-selection-on-PDP not wired (CUST-05) | Customer always buys the cheapest active offer |
| Cart | **Real**, transactionally sound | Server recomputes all pricing on every read, row-locks stock before mutating | |
| Checkout | **Real** | Re-validates stock/serviceability/COD-cap at preview *and* again inside the placement transaction | |
| Order creation | **Real, idempotent** | Deterministic key from `userId + Idempotency-Key` prevents duplicate orders on retry/double-click | |
| Payment | **COD only, by design** | No gateway integration exists or is claimed; `paymentMethod`/`paymentLabel` hardcoded server-side | D3/D4, not a gap |
| Order tracking | **Real** | Per-shipment status, time-boxed OTP decrypted server-side only to the owning customer | |
| Delivery completion (customer side) | **Real** | Reflected via `Order.stage` recomputed from shipment statuses after every driver-side mutation | |

**State-transition table — `Order.stage`** (`ordered → packed → shipped → out_for_delivery → delivered`, enum `prisma/schema.prisma` `OrderStage`): recomputed by a shared helper (`refreshOrderStage`, referenced from every seller/driver mutation) as a function of all child `Shipment.status` values. **Risk, already flagged in Deliverable 2 §3.4**: this derivation is application logic, not DB-enforced — a bug in the shared helper (or a future direct `Shipment` write that forgets to call it) could leave `Order.stage` out of sync with reality, and nothing in the schema would catch it.

**Cancellation**: allowed only while every shipment is `new`/`accepted`/`packed` (server-enforced, `cancelOrder()`), correctly restoring stock and refunding held escrow. A mixed order (some shipments already dispatched, others not) is **correctly never marked cancellable or fully delivered** — verified by a dedicated test case (`orders/service.test.ts`, "does not mark a mixed multi-seller order delivered").

**No broken transition was found in the customer workflow.** The gaps here are deferred features (Deliverable 3), not state-machine defects.

---

## 2. Seller workflow

**Seller registration → Approval → Product creation → Product publication → Inventory management → Order reception → Order processing → Delivery handoff → Payment settlement.**

| Step | Implemented? | Evidence | Notes |
|---|---|---|---|
| Seller registration | **Does not exist as a self-serve flow** | No API path can produce `role:"seller"`; `Seller` rows exist only via `prisma/seed.ts` | Matches the product's own UI copy; this is a deliberate current-state limitation, not a bug — but it is a real gap relative to the reference's implied seller-onboarding flow and relative to the Admin reference's "Approvals" screen, which presumes a queue of sellers to approve that can never fill up because no one can apply |
| Approval | **Does not exist** | No `Approvals`-equivalent model/route anywhere (ties to the admin-absence finding) | |
| Product creation | **Real**, scoped to existing catalogue | `createSellerProduct()`, 404 on unknown product, 409 on duplicate seller/product pair | See SELL-04 — narrower than reference implies |
| Product publication | **Real** | `status: active/paused`, auto-paused at zero stock | |
| Inventory management | **Real, ownership-scoped** | `updateSellerProduct`/`updateSellerStock`, both `where: {id, sellerId}` | |
| Order reception | **Real** | `listSellerOrders()`, `where: {sellerId}` | |
| Order processing | **Real, transaction-guarded** | accept/pack/dispatch/reject all require the expected prior status in the same `updateMany` as the ownership check — a stale/concurrent double-click is rejected with `409`, not silently reapplied | Exceeds the reference, which has no concurrency guard |
| Delivery handoff | **Real, with one dead-end** | Dispatch requires a real `Vehicle`+`Driver`; **no UI path exists to create one** (SELL-05) | |
| Payment settlement | **Real read, no write** | `sellerPaymentsSummary()` aggregates real escrow entries; withdrawal is correctly, honestly disabled (not faked) | |

**State-transition table — `ShipmentStatus`** (`new → accepted → packed → dispatched → (failed) → review → (disputed) → settled`, side states `rejected | missed | cancelled | refunded`):

| Transition | Guard (service function, `where` clause) | Verified |
|---|---|---|
| `new → accepted` | `acceptShipment`: `{id, sellerId, status:"new"}` | ✓ |
| `accepted → packed` | `packShipment`: `{id, sellerId, status:"accepted"}` | ✓ |
| `packed/accepted → dispatched` | `dispatchShipment`: `{id, sellerId, status:{in:["accepted","packed"]}}`, plus e-way/weighbridge/docs server-side checks | ✓ |
| `new → rejected` | `rejectShipment`: `{id, sellerId}` (status implicitly must allow rejection); restores stock, refunds escrow | ✓ |
| `dispatched → review` | `deliverDriverShipment` (driver-side, full quantity) | ✓ (Deliverable 3 §3) |
| `dispatched → disputed` | `deliverDriverShipment` (driver-side, short quantity, auto-prorated claim) | ✓ |
| `dispatched → failed` | `deliverDriverShipment` (3 wrong OTP tries) | ✓ |
| `review → settled` | **Confirmed absent.** Directly grepped every reference to `reviewEnds` across `src/server/orders/*.ts`: it is written once, at delivery time (`driverService.ts:271,278`), and read for display in three DTOs (`driverService.ts:79`, `sellerService.ts:105`, `service.ts:97`) — **never compared against the current time to trigger any transition.** A repo-wide grep for any `.update`/`.updateMany` writing `status:"settled"`, or creating a `commission`/`released` `EscrowEntry` outside `prisma/seed.ts`, returns zero matches. | **VERIFIED absent** |
| `new → missed` (accept-window timeout) | Same method: `acceptBy` is written at dispatch-acceptance time and read for `late`/countdown display, but no code path writes `status:"missed"` for an expired accept window | **VERIFIED absent** |

**This is the single most important functional-workflow finding in this audit, not previously called out at this level of specificity by any of the per-portal research passes, and it is now directly confirmed rather than inferred**: the project has no background job infrastructure (confirmed, Deliverable 2 §2.3) and no code path exists for either transition above. In the reference prototypes, both are driven by a client-side `runTimers()`/demo-clock simulation — which was explicitly never meant to be ported as-is (it is a demo convenience). But that means the *production equivalent* (a scheduled job, or at minimum an on-read lazy-evaluation, the same technique already used for `late`/review-window display logic) was **never built for these two specific transitions**. Practically: a real order, once dispatched and delivered without incident, has no automatic way to reach `settled` and release its escrow to the seller's payable balance — **nothing in this codebase can ever do it**, not an admin action (admin doesn't exist either, §4 below) and not a scheduled process (none exists). This explains why the seed data's `settled`/`withdrawn` escrow entries look real in the demo (they were inserted directly, by hand, by the seed script) while the live, request-driven code has no path to produce new ones in a fresh environment. Recommend this be elevated to a P0 engineering task (Deliverable 7) — it is a missing core settlement mechanism, not a UI polish item.

---

## 3. Delivery/driver workflow

**Assignment → Acceptance → Pickup → In-transit → Delivery attempt → Proof of delivery → Completion or Exception.**

Covered in full detail with file:line citations in Deliverable 3 §3. Summary table:

| Transition | Guard | Verified |
|---|---|---|
| Assignment | Implicit at seller dispatch, via `vehicle.driverId` copy | ✓ |
| Acceptance | Audit-event only, does **not** gate the next step (DELV-02) | ✓ (gap confirmed) |
| Pickup/in-transit | No discrete transition exists in either reference or implementation (static display only) | ✓ (parity) |
| Delivery attempt / OTP | Row-locked, bcrypt-verified, 3-try lockout → `failed` | ✓ |
| Proof of delivery (photo) | **Fabricated** — client boolean stripped before the API call, no schema column exists (DELV-04) | ✓ (gap confirmed, highest severity in this audit) |
| Completion (full qty) | → `review`, 24h window starts | ✓ |
| Exception (short qty) | → `disputed`, auto-prorated claim | ✓ |
| Exception (explicit issue report) | → `failed_attempt`/`damaged_goods`/`short_quantity` `ShipmentIssue` row | ✓ |

**Open item carried over from Deliverable 3**: no server-side OTP expiry exists; release of escrowed payouts depends on OTP integrity with no time-bound on a generated code beyond the shipment remaining in `dispatched` status.

---

## 4. Admin workflow

**Authentication → Dashboard → User/seller governance → Product governance → Order oversight → Dispute handling → Administrative actions.**

**None of this exists.** `requireAdmin()` is defined and reachable in principle (the `admin` role resolves correctly through the same session machinery as every other role) but is never imported by any route. There is, consequently:
- No admin authentication boundary to audit beyond the generic one (sound, per Deliverable 2 §4).
- No dashboard, no user/seller governance UI or API, no product governance, no order-oversight surface, no dispute-resolution action, and — critically, tying back to §2 above — **no administrative mechanism of any kind to advance a `review`-status shipment to `settled`,** since the reference's admin console is also where payout *approval* and exception *resolution* were meant to live.

This is not a workflow with broken transitions; it is a workflow with **zero transitions implemented**, which is itself the finding.

---

## 5. Cross-workflow data-consistency risks

- **Dual lifecycle vocabularies** (`Order.stage` vs `Shipment.status`, Deliverable 2 §3.4) — risk of drift for any multi-seller order, no DB-level enforcement.
- **The `review → settled` and timeout-to-`missed` gaps (§2 above)** mean the *only* currently-working way for the full happy-path lifecycle to reach a financially-settled state in a fresh (non-seeded) environment is... nowhere — a real customer's order, once delivered cleanly, has no mechanism to ever pay the seller out, beyond what a human would have to do by hand against the raw database. This is the most material functional gap uncovered by this entire audit and should be treated as a release blocker for any claim that the order lifecycle is "complete."
- **`ShipmentIssue.shipmentId` unique constraint** (Deliverable 2 §3.4) means a second, unrelated dispute on an already-once-disputed shipment has no schema-level home.

This concludes the Functional Workflow Audit. See Deliverable 7 for how the `review → settled` / timeout gap specifically should be sequenced as a release-blocking (P0) work package.
