# Financial Architecture Validation

> **Superseded assumption note (2026-11-11):** the platform-custody COD escrow
> model analyzed below has been replaced by the owner's decision that **COD is
> collected by the seller** (see `SELLER_COLLECTED_COD_ARCHITECTURE.md`). The
> `EscrowEntry` semantics documented here remain accurate for the **legacy**
> (pre-cutover) model and are retained read-only; they are no longer the target
> financial architecture.

Validated 2026-11-11 against live schema and code (no schema changes, no
business-data changes). Sources: `app/prisma/schema.prisma`,
`app/src/server/orders/{service,lifecycle,sellerService,driverService}.ts`,
`app/src/app/api/seller/payments/route.ts`, `app/src/lib/seller/rules.ts`,
`app/src/data/seller.ts`, `prisma/seed.ts`, and their tests.

## 1. EscrowEntry types and sign convention

`enum EscrowEntryType { held commission penalty refund released withdrawn }`.

**Convention: every `amount` is a positive `Decimal(14,2)`; the `type` carries
direction.** There are no negative entries.

| Type | Meaning | Written by (runtime) |
|---|---|---|
| `held` | gross owed to a seller, held in escrow | order placement (`service.ts:359-366`) |
| `commission` | platform fee deducted at settlement | **none** (seed/test only) |
| `penalty` | late penalty deducted at settlement | **none** |
| `refund` | reverses a held amount to the customer | cancel (`service.ts:464`) + reject (`sellerService.ts:331`) |
| `released` | held amount moved to the seller's withdrawable balance | **none** (seed/test only) |
| `withdrawn` | seller-level bank transfer out (no order/shipment) | **none** (test only) |

## 2. How held amounts are calculated

One `held` entry per seller-shipment at order placement:
`held = groupSubtotal − groupDiscount + groupDeliveryFee` (the COD gross payable
to that seller). Multi-seller orders produce one held entry per seller.
(`service.ts:365`.)

## 3. Commission representation

Commission is a **separate positive entry** deducted from held at settlement —
not a negative entry and not subtracted from `released`. Today no runtime code
writes it; the seller payments summary only *reads* it (seed/test populate it).
The prototype implies 5% commission and 2% late penalty, but no code enforces a
rate — **these are owner decisions, not implemented rules.**

## 4. Refund / penalty / release / withdrawal balance effects

- **Refund:** appends a `refund` entry equal to the original `held` (the `held`
  entry is kept as history). Per-shipment closure: `held = commission + penalty +
  released + refund`.
- **Penalty:** not accounted in `sellerPaymentsSummary` (`sellerService.ts:470-496`
  buckets only `held/commission/released/refund`; `unresolved = held − commission −
  released − refund`). **If `penalty` were ever written, pending-release would be
  overstated.** This is a latent bug, not yet reachable.
- **Release:** increases `totalReleased`.
- **Withdrawal:** `withdrawn` entry (seller-level); `available = totalReleased −
  totalWithdrawn` (`sellerService.ts:514`). No code writes withdrawals.

## 5. Partial delivery / partial refund

Not representable. `Shipment.deliveredQty` and `ShipmentIssue.claim` exist, and a
short-quantity dispute opens, but escrow stays `held`; there is no partial release
or partial refund path. Full-shipment refund only (cancel/reject).

## 6. Settlement idempotency & concurrency

- `deliver` sets `status = review` and `reviewEnds = now + REVIEW_WINDOW_HOURS`
  (`driverService.ts:271-278`); disputed deliveries set `reviewEnds = null`.
- **No runtime settlement exists.** `status = settled` and the `released`/
  `commission` writes live only in `seed.ts` and tests.
- A naive "find review, write settled + released" worker could double-release if
  two workers race (both read `review`). **The safe guard is a compare-and-set
  transition**: `UPDATE "Shipment" SET status='settled' WHERE id=? AND
  status='review'`; the worker that affects 0 rows must abort. `settled`/`refunded`
  are terminal enum values, so the status column itself can serve as the
  idempotency guard — **no new column is strictly required** for correctness,
  though a unique settlement reference would aid auditing.

## 7. Can a seller over-withdraw?

No withdrawal API exists, so the question is moot today. The derived
`available = released − withdrawn` is only enforced as arithmetic, not by any
constraint. A future withdrawal must re-read `available` **in the same transaction**
and reject when `amount > available` (or enforce a DB-level invariant); because
entries are append-only positives, nothing currently prevents an overdraw.

## 8. Ledger reconciliation identity

The identity stated in the earlier assessment
(`held + commission + penalty + refund + released + withdrawn = 0`) is **wrong**
for this representation — amounts are all positive and signed by type. The correct
identities are:

- Per shipment (fully closed): `held = commission + penalty + released + refund`
  (the original held is conserved; refund is a separate reversal entry).
- Per seller: `available = released − withdrawn ≥ 0`, and
  `pendingRelease + frozen = Σ (held − commission − released − refund)` over open
  shipments (excluding `penalty` until it is also bucketed).

## 9. WP-1 design recommendation (no schema change)

1. **Eligibility:** scan `Shipment` where `status='review' AND reviewEnds < now()`
   (disputed/`reviewEnds IS NULL` are excluded automatically).
2. **Settlement transaction (per shipment):**
   - compare-and-set `status review → settled` (single winner);
   - write `commission` (owner-approved rate) and `released` = `held − commission`
     (plus `penalty` if approved);
   - write a `ShipmentEvent`.
   - All in one transaction; the CAS prevents double settlement.
3. **Withdrawal transaction (per seller):** read `available`, reject if
   `amount > available`, append a `withdrawn` entry with an idempotency reference
   in `note` (or a later dedicated table). Owner decision on request-vs-immediate.
4. **Durable worker:** a scheduled tick (cron/apscheduler) + re-scan on startup.
   Because settlement is idempotent via CAS, at-most-once delivery is sufficient;
   no durable job queue is strictly required.
5. **Independent transactions:** yes — each shipment settles in its own
   transaction; withdrawals are independent per seller. No cross-shipment lock is
   needed given the CAS.

Trade-offs: relying on the status column for idempotency couples settlement to the
shipment state machine (acceptable; it already encodes terminal states); a
dedicated settlement reference would be cleaner but requires a schema change.

## 10. Unresolved contradictions / risks to flag

- `penalty` is an enum type with no writer and no balance accounting — a trap for
  the settlement feature.
- `refunded` and `missed` shipment statuses exist but no runtime path writes them.
- The seller payments summary uses `Number()` (float) internally for display
  bucketing; values are re-serialized to strings, so precision is preserved for
  API output but any *arithmetic* done on those floats (e.g. future payout logic)
  must use Decimal, not Number.
- `available` is derived, not enforced; withdrawals must be made transactional and
  overdraw-guarded.
