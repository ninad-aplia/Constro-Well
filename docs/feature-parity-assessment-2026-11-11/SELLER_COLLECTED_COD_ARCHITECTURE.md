# Seller-Collected COD — Financial Architecture

Authoritative business decision (owner-confirmed, 2026-11-11): the customer pays
the **seller** directly. An assigned delivery driver may collect cash as the
seller's authorized agent. **Constro-Well does not collect or custody COD
proceeds.** This replaces the earlier assumption of platform-held COD escrow and
seller payouts.

This document is design only — no schema change, migration, or code.

---

## 1. Authoritative money-flow semantics

1. **COD collected by the seller is not Constro-Well's money.** It never enters a
   platform account; it is seller cash on the seller's own books.
2. **An assigned driver collecting cash acts as the seller's agent.** The
   collection is attributed to the seller, not to the driver.
3. **OTP verification proves delivery, not cash collection.** A delivery OTP and a
   "collected cash" event are different facts and must be recorded separately.
4. **Collection confirmation is a distinct financial event**, performed by the
   seller (or the seller's agent), with evidence, and is not implied by delivery.
5. **Commission owed to Constro-Well is a seller obligation** (a receivable from
   seller to platform), independent of whether the seller has collected COD.
6. **A remittance becomes platform cash only when receipt is verified.** An
   initiated/pending remittance is not cash.
7. **Seller refunds to customers are seller actions**, not platform payouts and not
   platform refunds.
8. Delivery completion, collection confirmation, commission assessment, remittance
   and reconciliation are **five distinct states** — never collapsed.
9. **No UI or API may render virtual accounting entries as "cash held by
   Constro-Well."** Labels must reflect seller cash vs platform receivables.

---

## 2. Legacy EscrowEntry — retain, do not repurpose

`EscrowEntry` (`held`, `commission`, `penalty`, `refund`, `released`, `withdrawn`)
encodes the **old platform-custody escrow model**. Today only `held` (order
placement) and `refund` (cancel/reject) are written at runtime; the rest exist in
seed/demo data.

- **Keep readable:** `sellerPaymentsSummary` and Admin order-detail/overview keep
  reading `EscrowEntry` and are relabelled **"legacy escrow (pre-cutover)"**.
- **Relying surfaces:** `sellerService.ts` (balance/ledger), Admin order detail
  (`financialRecords`), Admin overview (`escrowByType`), seed/demo previews.
- **Transition:** new orders stop writing `held`; the old fields become historical
  only. No historical record is modified.
- **New domain:** a separate append-only finance domain (below) rather than
  overloading `EscrowEntry` with new meanings.
- **Distinguish historical vs new:** a nullable marker on `Order` (e.g.
  `financeModel: escrow | seller_collected`, default `escrow`) — a **future Prisma
  migration**; alternatively infer from the presence of a `CodCollection` row.
  Recommend the explicit marker for clarity.

---

## 3. Target financial domain (proposed records)

All amounts are `Decimal(14,2)`; all rows are append-only; every row carries
`actorUserId` (authorization) + `createdAt` + an idempotency reference; financial
admin actions are additionally mirrored to `AuditEvent`.

### 3.1 `CodCollection` (per shipment, seller cash)
- **Fields:** id, shipmentId (unique), sellerId, collectedBy (`seller` | `agent`),
  agentUserId? (driver), expectedAmount, collectedAmount?, status
  (`pending` | `confirmed` | `disputed`), evidenceRef?, confirmedAt?, note.
- **Actor/authz:** seller, or the seller's assigned driver (as agent) — both
  scoped to the seller's shipment.
- **Lifecycle:** `pending` → `confirmed` (seller/agent) → optionally `disputed`
  (admin).
- **Idempotency:** unique `shipmentId`; confirm is a status transition, so repeated
  confirmation is a no-op or 409.
- **Transaction:** single shipment row update + `ShipmentEvent` + optional
  `AuditEvent`.
- **Evidence:** seller-supplied reference (e.g. cash receipt no.) — no fabricated
  success.

### 3.2 `CommissionAssessment` (platform receivable)
- **Fields:** id, sellerId, shipmentId?, basisAmount, rate, commissionAmount,
  status (`assessed` | `partially_remitted` | `remitted` | `waived`), assessedAt.
- **Actor:** system (derived from order), admin for waivers.
- **Lifecycle:** `assessed` at order placement or collection confirmation
  (owner decides basis); `remitted` as allocations cover it; `waived` by admin.
- **Idempotency:** unique `shipmentId` (one assessment per shipment).
- **Transaction:** created alongside order/collection; waiver is a guarded status
  transition.

### 3.3 `Remittance` (seller → platform)
- **Fields:** id, sellerId, amount, method, reference, status
  (`initiated` | `received` | `allocated` | `failed` | `returned`), receivedAt?,
  verifiedBy?.
- **Actor/authz:** seller initiates; **admin verifies receipt** (platform cash only
  on `received`).
- **Lifecycle:** initiated → received (verified) → allocated → (closed); failed →
  returned on refund of a failed remittance.
- **Idempotency:** seller-supplied reference must be unique per seller to prevent
  duplicate submissions.
- **Transaction:** initiation is a single row; verification is a guarded
  `initiated → received` transition.

### 3.4 `RemittanceAllocation` (split a remittance across assessments)
- **Fields:** id, remittanceId, assessmentId, amount.
- **Invariant:** Σ allocations ≤ remittance.amount; a remittance with remainder is
  **unallocated** (credit to seller, flagged for reconciliation).
- **Supports:** partial remittance, overpayment (unallocated remainder),
  allocation across multiple assessments.
- **Transaction:** allocation batch in one transaction with the unallocated check.

### 3.5 `SellerAdjustment` (refunds & corrections)
- **Fields:** id, sellerId, shipmentId?, type (`customer_refund` | `adjustment` |
  `reversal`), amount, evidenceRef?, status (`open` | `applied`), appliedBy?.
- **Actor:** seller records a customer refund with evidence; admin applies
  adjustments/reversals.
- **Semantics:** reduces the seller's outstanding commission basis only where
  policy allows; never a platform payout.

### 3.6 Statements & audit
- **Statement:** a computed read (no table) aggregating, per seller:
  expected COD, confirmed COD, outstanding commission, remitted, unallocated.
- **Audit:** admin financial actions write `AuditEvent` (existing append-only
  table); each financial row also carries its own immutable actor/timestamp.

---

## 4. Accounting invariants (testable)

Define per shipment/seller, all Decimal:

1. **Expected vs collected:** `confirmedCollection(s) ≤ expectedCollection(s)` in
   normal flow; a confirmed amount > expected is an over-collection flag.
2. **Commission assessed vs remitted:** `outstandingCommission(seller) =
   Σ commission − Σ allocation`.
3. **Seller outstanding balance:** `outstanding(seller) = Σ assessed commission −
   Σ allocations − Σ waived` (≥ 0).
4. **Refunds/adjustments:** reduce the *basis* per policy; a customer refund is a
   seller-side reduction, never platform cash.
5. **Unallocated remittance:** `unallocated(r) = remittance.amount − Σ
   allocations(r)` (≥ 0); an unallocated remainder is a seller credit awaiting
   reconciliation, not lost cash.
6. **Platform cash:** `platformCash = Σ remittances(status ∈ received|allocated)`.
7. **Collection mismatch:** `expected − confirmed > 0` ⇒ dispute flag; require
   admin resolution before the seller is considered settled.

Partial remittance, overpayment, failed remittance (returned), duplicate
submission (unique reference), and concurrent verification (guarded status
transition) are all addressed by the designs above.

The **old escrow conservation formula is not reused** for the new ledger — the two
models are disjoint (legacy escrow is read-only; the new domain has its own
identities above).

---

## 5. Workflows

**A. COD order → seller/agent collection → delivery confirmation.**
Order places expectation; delivery sets `review` (OTP) but not collection; seller/
agent separately confirms `CodCollection`. OTP ≠ cash.

**B. Collection confirmation → commission assessment → statement.**
Confirm collection; system (or on collection, per owner basis) writes
`CommissionAssessment`; statement reflects outstanding commission.

**C. Seller remittance → receipt verification → allocation → reconciliation.**
Seller initiates `Remittance` (reference); admin verifies receipt
(`initiated → received`); allocations split across assessments; remainder is
unallocated; reconciliation closes it.

**D. Customer refund by seller → evidence → adjustment.**
Seller records `SellerAdjustment(type=customer_refund)` with evidence; admin applies
it against the commission basis per policy.

**E. Collection mismatch/dispute → admin investigation → resolution.**
`expected ≠ confirmed` or a customer dispute → admin reviews evidence, resolves via
adjustment/reversal, audited.

**F. Seller financial history & Admin oversight.**
Seller statement + remittance/allocation history; Admin sees receivables,
remittances, allocations, adjustments, and the audit trail.

---

## 6. Owner decisions

**Confirmed:**
- COD is collected by the seller directly.
- An assigned driver may collect as the seller's agent.
- Constro-Well does not collect or custody COD proceeds.

**Outstanding (do not invent):**
1. Commission rate and calculation basis (order value vs collected COD vs net).
2. Remittance frequency and deadline.
3. Permitted remittance methods (bank transfer, UPI, etc.) and evidence required.
4. Refund and adjustment policy (who may adjust, under what evidence).
5. Penalty policy (if any).
6. Collection-confirmation evidence requirements.
7. Whether online payments are in the next product scope (they would need a
   gateway and a separate custody model).

---

## 7. Transition plan

> **Progress (2026-11-11):** steps 1–3 are implemented and tested (schema + migration,
> the order-placement cutover, and the Seller/Admin finance surfaces) — see
> `IMPLEMENTATION_ROADMAP.md` WP-1. Steps 4–5 (seed, docs) remain.

1. **Schema (future, Prisma):** finance tables above + `Order.financeModel` marker
   (or infer via `CodCollection`).
2. **Cutover:** new orders write expectations + assessments (no `held` escrow);
   legacy orders remain on the escrow model, read-only.
3. **Surfaces:** relabel legacy escrow reads; add statement/remittance/admin
   surfaces for the new model.
4. **Seed:** regenerate demo data to illustrate seller-collected COD; preserve
   historical escrow rows as history.
5. **Docs/tests:** accounting-invariant tests and reconciliation tests per §4.

---

## 8. Evidence register

- `app/prisma/schema.prisma` — `EscrowEntry`/`EscrowEntryType` (verified).
- `app/src/server/orders/service.ts` — `held` creation + cancel refund (verified).
- `app/src/server/orders/sellerService.ts` — balance/ledger read of escrow (verified).
- `app/src/server/orders/driverService.ts` — `review`/`reviewEnds`, no collection
  event (verified).
- `app/src/app/api/seller/payments/route.ts` — read-only summary (verified).
- Admin overview (`escrowByType`) and order detail (`financialRecords`) read
  escrow (verified).
