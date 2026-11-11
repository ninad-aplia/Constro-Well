# Data & Financial Integrity

## Invariants that hold today

- **Money:** all monetary columns are `Decimal(14,2)` (rates `Decimal(7,6)`); money
  crosses every API/UI boundary as exact strings; no float arithmetic
  (`app/src/lib/shop/pricing.ts`, FastAPI `f"{d:.2f}"`).
- **Stock:** decremented inside the order transaction with `SELECT … FOR UPDATE`;
  auto-pause at zero; cancel/reject restore stock exactly once.
- **Order snapshots:** `Order` totals and `OrderLine` name/unit/price/qty are
  point-in-time; detail views never re-read current product prices.
- **Idempotency:** deterministic `Order.id` prevents double placement.
- **Escrow:** entries are append-only in practice; held/released/refund/commission/
  penalty/withdrawn types exist but only `held`/`refund`(cancel/reject) are written
  today.
- **Audit:** `AuditEvent` append-only via DB triggers (UPDATE/DELETE/TRUNCATE
  rejected); admin reads are fail-closed transactional.

## Gaps & risks

1. **Settlement missing (legacy escrow model).** Under the now-superseded
   platform-custody model, nothing moved `review → settled`/`released`. The target
   is now the seller-collected COD domain (see
   `SELLER_COLLECTED_COD_ARCHITECTURE.md`): commission receivable, remittance and
   reconciliation, with no platform custody of COD proceeds.
2. **Inventory lost-update race.** `POST /api/seller/products/[offerId]/stock`
   sets stock; the documented concurrency decision (optimistic lock vs `FOR
   UPDATE`) is unresolved. Checkout itself locks correctly; only the seller stock
   edit path is at risk.
3. **Payout reconciliation** has no implementation to verify the ledger. The
   correct identities are per-shipment `held = commission + penalty + released +
   refund` and per-seller `available = released − withdrawn` (see
   `FINANCIAL_ARCHITECTURE_VALIDATION.md`) — nothing enforces them yet.
4. **No partial delivery/refund** beyond whole-shipment cancel/reject.
5. **ReviewEnds** has no expiry enforcement (D5 open: OTP/delivery deadline policy).

## Schema decisions required (owner)

- Settlement job trigger & timing (review window length).
- Commission/penalty exact rules (prototype implies 5% commission, 2% late
  penalty — needs approval as business rule).
- Whether withdrawals are manual (admin) or seller-initiated.
- KYC document/decision tables (required before any approval workflow).

## Concurrency matrix

| Operation | Locking | Status |
|---|---|---|
| Order placement | `FOR UPDATE` on offers | COMPLETE |
| Cancel / reject | shipment lock + stock restore | COMPLETE |
| Driver deliver | shipment lock, idempotent | COMPLETE |
| Seller stock edit | none | RISK (decision needed) |
| Settlement job | not implemented | MISSING |
