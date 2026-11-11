# Implementation Roadmap

Dependency-ordered work packages. Each package is a cohesive, testable increment.
Severity: P0 = financial/security/data-integrity blockers; P1 = required product
functionality; P2 = operational completeness/UX; P3 = polish.

---

## WP-1 — Commission receivable, remittance & reconciliation (P0)

> **STATUS: implemented 2026-11-11 (WP-1 + WP-1B).** Migration
> `20261110222135_add_seller_collected_cod_finance` + `20261111200000_relax_allocation_pair_index`,
> the FastAPI finance domain (`domains/finance`, `routers/finance.py`), the Next.js order
> cutover, and the Seller/Admin finance frontend are done and tested. Remaining: the open
> owner policy decisions (commission rate/basis, remittance method/frequency,
> refund/adjustment policy — none invented; `CommissionPolicy` is an empty configurable
> boundary) and a live-data browser walkthrough.

- **Scope:** seller-collected COD domain — collection confirmations, commission
  assessment (seller obligation), seller remittances, remittance
  allocation/reconciliation, seller statements, customer-refund adjustments,
  financial audit (`SELLER_COLLECTED_COD_ARCHITECTURE.md`).
- **Dependencies:** owner decisions (commission rate/basis, remittance frequency/
  method, refund/adjustment policy); schema addition via Prisma.
- **Schema:** new finance tables (`CodCollection`, `CommissionAssessment`,
  `Remittance`, `RemittanceAllocation`, `SellerAdjustment`) + `Order.financeModel`
  marker (future migration).
- **Domains:** FastAPI (new `domains/finance`), scheduled remittance reconciliation.
- **Tests:** accounting invariants (§4 of the architecture doc), idempotency
  (duplicate remittance, concurrent verification), statement correctness.
- **Done:** seller collects COD (agent-aware), commission is assessed and remitted,
  reconciliation is exact and audited; no platform custody is ever claimed.

## WP-2 — Dispute, refund & adjustment resolution (P0)

- **Scope:** admin dispute resolution (full/partial) and seller customer-refund
  adjustments, writing `SellerAdjustment`/`RemittanceAllocation` records per the
  seller-collected COD domain; customer dispute initiation.
- **Dependencies:** WP-1 (finance domain), owner refund/adjustment policy.

## WP-3 — KYC/document lifecycle + seller onboarding (P0 for marketplace trust)

- **Scope:** **schema addition (owner-approved)** for KYC documents/decisions; file
  storage abstraction (signed URLs); admin review/approve/reject (audited);
  seller self-serve application.
- **Dependencies:** owner decision (storage provider), WP-1 audit patterns.
- **Schema:** new tables via Prisma (migration authority).

## WP-4 — File storage + proof-of-delivery evidence (P1)

- **Scope:** object storage, signed upload, shipment photo POD persisted, KYC/doc
  reuse.
- **Dependencies:** owner decision (provider); WP-3 for KYC reuse.

## WP-5 — Notifications + background processing (P1)

- **Scope:** notification abstraction, `Notification` writer, triggers (order,
  dispute, payout), email/SMS boundary (no fake success), settlement job runner
  (shared with WP-1).
- **Dependencies:** WP-1 (scheduled work).

## WP-6 — Customer gaps (P1)

- **Scope:** wishlist (existing `WishlistItem`), review submission + helpful votes,
  account/profile page, guest cart (if approved — else explicit deviation).
- **Dependencies:** owner decisions (guest cart, wishlist scope).

## WP-7 — Seller/driver completeness (P1)

- **Scope:** bulk pricing edit, pickup confirmation, driver reject, driver
  earnings view, sales-report real data, payout request UI (with WP-1).

## WP-8 — Admin write operations (P1, follows WP-1/2/3)

- **Scope:** admin dispute/refund/KYC/payout screens with audited actions;
  dedicated shipment oversight; actor activity drill-down.

## WP-9 — Engineering hardening (P1/P2)

- **Scope:** rate limiting, CI (move Playwright workflow to repo root; add
  Vitest/pytest), monitoring/APM, backup/recovery policy, inventory stock-edit
  concurrency decision.

## WP-10 — Migration continuation (P2)

- **Scope:** migrate remaining Next.js domains to FastAPI per the approved
  incremental plan, prioritizing low-risk reads first; keep Prisma as schema
  authority until the deliberate cutover.

---

### Ordering rationale

WP-1 and WP-2 make the marketplace financially real and reuse the proven order/
escrow foundations; WP-3/WP-4 unlock trust workflows; WP-5 enables the jobs and
notifications the earlier packages need; customer/seller/driver gaps follow; WP-8
depends on the write backends; WP-9/WP-10 harden and migrate without changing
business behavior.
