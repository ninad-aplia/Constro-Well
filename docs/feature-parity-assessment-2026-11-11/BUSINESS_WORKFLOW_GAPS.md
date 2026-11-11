# Business Workflow Gaps

Nine end-to-end workflows, each with actors, state transitions, APIs, records,
transaction boundaries, authorization, failure paths and missing states.

---

## 1. Customer purchase → multi-seller checkout

- **Actors:** customer.
- **Path:** catalogue → cart (per-seller groups) → checkout preview →
  `POST /api/orders`.
- **Records:** `Order`, `OrderLine` (snapshots), `Shipment` (one per seller),
  `ShipmentEvent`, `EscrowEntry(held)`.
- **Transactions:** single Prisma transaction: re-validate offers, `FOR UPDATE`
  lock, stock decrement + auto-pause, re-price bulk/coupon/GST/delivery, idempotency
  key `Order.id`.
- **Authz:** `requireCustomer`.
- **Gaps:** guest cart (no anonymous checkout); payment is COD-only; no post-order
  payment state beyond `paymentMethod`.
- **Test need:** contract + concurrency already covered; add guest-cart e2e if
  guest checkout is chosen.

## 2. Seller order acceptance & dispatch

- **Actors:** seller.
- **Path:** list own shipments → accept → pack → dispatch.
- **Records:** `Shipment.status`, `ShipmentEvent`, `otpHash/otpEncrypted` reset at
  dispatch.
- **Authz:** `requireSeller` + ownership (`shipment.sellerId`).
- **Gaps:** no deadline timers (`acceptBy`/`dispatchBy` stored but nothing
  transitions missed/late); no handover/slot UI.
- **Test need:** deadline timeout (needs scheduled work, see §9).

## 3. Driver assignment → successful delivery

- **Actors:** seller (assign), driver (accept/deliver).
- **Path:** dispatch assigns `vehicleId/driverId` → driver accepts → OTP → deliver.
- **Records:** `Shipment.driverId/status/deliveredAt/deliveredQty`,
  `ShipmentEvent`, parent `Order.stage` derived.
- **Authz:** `requireDriver` + cross-driver 404.
- **Gaps:** pickup confirmation missing; POD evidence is a boolean + quantity
  only (no photo storage).
- **Test need:** covered; add POD storage when storage lands.

## 4. Failed delivery, reassignment & retry

> **Partially resolved 2026-11-11 (task 7.2b).** The logistics-failure branch
> (`status: "failed"`, from 3 wrong OTP tries or a driver's "failed attempt"
> report) now has two seller-initiated resolutions. The goods-condition branch
> (`status: "disputed"`: short quantity / damaged goods) is unchanged — its
> resolution is an admin refund-policy decision (WP-2), not a logistics retry,
> and is intentionally out of this fix's scope.

- **Path:** driver `issue` (customer unavailable / damaged / short quantity /
  address/serviceability) → `Shipment.status` side-branch.
- **Records:** `ShipmentIssue`, `ShipmentEvent`.
- **Gaps (resolved for `failed`):** ~~no reassignment operation; no retry state
  machine~~ `POST /api/seller/orders/[shipmentId]/redispatch` (reassign a
  vehicle/driver, fresh OTP, `failed → dispatched`) and `/missed` (give up,
  restore stock, cancel the COD expectation, `failed → missed`) — the
  previously-unreachable `missed` enum value is now reachable.
- **Gaps (still open):** no *automatic* timeout/retry (needs a scheduled job,
  WP-5); `disputed` has no resolution operation (WP-2, gated on the refund/
  adjustment policy decision); no cross-seller reassignment (a different
  seller entirely fulfilling the order — a larger, separate task, see
  `TASKS.md` 7.4's "reassign rejected/timeout to another vendor").
- **Test need:** ~~reassignment + retry transitions once defined~~ covered —
  `app/src/server/orders/sellerService.test.ts` (reassign: cross-seller 404,
  OTP reset, issue cleared, re-reassign 409; missed: cross-seller 404, stock
  restored, COD collection cancelled, re-mark 409).

## 5. Order cancellation & refund

- **Actors:** customer.
- **Path:** `POST /api/orders/[id]/cancel` before any dispatch.
- **Records:** shipment → `cancelled`, `restoreReservedStock`, refund escrow
  entries, `Order.cancelled`.
- **Authz:** `requireCustomer` + ownership.
- **Gaps:** partial-cancel not modeled; post-dispatch returns 409 (intended).
- **Test need:** covered.

## 6. Escrow hold → settlement → withdrawal → refund

> **Superseded.** The platform-custody escrow lifecycle below is replaced by the
> seller-collected COD domain (collection → commission receivable → remittance →
> reconciliation). Retained for the legacy (pre-cutover) `EscrowEntry` records.
> See `SELLER_COLLECTED_COD_ARCHITECTURE.md` for the target workflows A–F.

- **Actors:** system (settlement), seller (withdraw), admin (refund).
- **Path:** held → (review window) → released; commission/penalty derived;
  seller-level `withdrawn` entries.
- **Records:** `EscrowEntry(type ∈ held/commission/penalty/refund/released/withdrawn)`.
- **Gaps:** **no settlement job** moves `review → settled`/`released`; no
  withdrawal API; no admin refund op; `reviewEnds` stored but unused.
- **Test need:** full-ledger reconciliation + settlement job tests (see
  `DATA_AND_FINANCIAL_INTEGRITY.md`).

## 7. Seller onboarding & KYC approval

- **Actors:** seller (apply), admin (review).
- **Records:** `Seller` + `KycStatus` flags.
- **Gaps:** no onboarding/application flow, no document upload, no review/decision
  records, no approval transition. **Blocked on schema addition.**

## 8. Dispute initiation & resolution

- **Actors:** driver (open short-quantity), customer (reports), admin (resolve).
- **Records:** `ShipmentIssue` (type, note, claim, auto), `EscrowEntry`.
- **Gaps:** driver can open; customer/admin cannot act; no resolution writes
  refund/release escrow entries.

## 9. Admin intervention & audit history

- **Actors:** admin.
- **Records:** `AuditEvent` (append-only, trigger-guarded).
- **Path:** all admin reads audit transactionally (fail-closed).
- **Gaps:** only read operations exist; write interventions (dispute/refund/KYC/
  payout) are missing and would need their own audited actions.

---

### Cross-record consistency note

`Order.stage` is derived from shipments, never independently mutated;
`Shipment.status` is the source of truth per seller; `EscrowEntry` is append-only
in practice and must never be treated as settlement without a `released`/`settled`
transition. No workflow currently synthesizes these into a false "done" state —
this is correct and must be preserved.
