# Feature Parity Matrix

Statuses: **COMPLETE** (implemented + verified with meaningful evidence),
**IMPLEMENTED_UNVERIFIED**, **PARTIAL**, **MISSING**, **BLOCKED** (owner
decision / external integration / schema change), **NOT_IN_SCOPE**.

Evidence key: `T` = automated tests, `B` = browser/HTTP verification, `S` = source
inspection, `R` = report/audit. "Read" vs "write" noted where they differ.

---

## A. Customer portal

| # | Capability | Status | Evidence | Notes / gap |
|---|---|---|---|---|
| A1 | Registration/login/logout/session | COMPLETE | T,S,B | bcrypt cost 12, SHA-256 session token, 7-day TTL, logout deletes row |
| A2 | Profile & account management | PARTIAL | S | Addresses CRUD API exists; no `/account` page, no profile edit |
| A3 | Homepage/categories/discovery | COMPLETE | T,S,B | DB-backed rows, deal tiles, recently viewed |
| A4 | Search/filters/sort/pagination | COMPLETE | T,S,B | Brand facets hidden until `Product.brand` seeded |
| A5 | Product detail + seller offers | COMPLETE | T,S,B | Real offers, seller table, bulk tiers |
| A6 | MOQ + bulk pricing | COMPLETE | T,S | Server-enforced min qty, bulk tiers |
| A7 | Cart qty/saved-for-later | COMPLETE | T,S,B | Server cart, per-seller groups, coupon |
| A7b | Guest cart + merge on login | MISSING | S | `requireCustomer` only; task 3.3 never done; owner decision open |
| A8 | Coupons + price calc | COMPLETE | T,S | Server coupon engine, GST/delivery exact |
| A9 | Checkout + order creation | COMPLETE | T,S,B | Idempotent, stock locked, COD enforced |
| A10 | Payment boundary/status | PARTIAL | S | COD-only; no gateway, no status webhook |
| A11 | Order history/detail | COMPLETE | T,S,B | Customer order list + detail |
| A12 | Tracking/delivery status | COMPLETE | T,S,B | Per-shipment status + OTP display |
| A13 | Cancellation/refund/dispute | PARTIAL | T,S | Cancel restores stock + refund escrow; customer dispute initiation missing |
| A14 | Wishlist | MISSING | S | `WishlistItem` model unused; heart disabled |
| A15 | Reviews/ratings | PARTIAL | T,S | Read-only reviews/histogram; submission + helpful votes missing |
| A16 | Notifications/support | MISSING | S | No notification writer, no support surface |
| A17 | Responsive/a11y/error states | PARTIAL | R,S | Largely done; audit flagged some contrast/tab-order gaps |

## B. Seller portal

| # | Capability | Status | Evidence | Notes / gap |
|---|---|---|---|---|
| B1 | Seller registration/onboarding | MISSING | S | Seed-only; no self-serve onboarding |
| B2 | Business profile / KYC submission | MISSING | S | No document upload/lifecycle |
| B3 | Verification status | PARTIAL | S | Stored `KycStatus` flags only; no decision workflow |
| B4 | Product creation/catalogue | COMPLETE | T,S,B | Seller products CRUD |
| B5 | Product images / document upload | MISSING | S | No storage abstraction |
| B6 | Inventory & stock management | COMPLETE | T,S | Stock endpoint; concurrency caveat (see Data doc) |
| B7 | Pricing & minimum quantity | COMPLETE | T,S | Price/min-qty persisted |
| B8 | Bulk pricing | PARTIAL | S | `Product.bulkFlag`; per-offer bulk edit not exposed |
| B9 | Incoming order management | COMPLETE | T,S,B | Seller order list scoped to own shipments |
| B10 | Accept/reject | COMPLETE | T,S | Reject restores stock + refunds escrow |
| B11 | Pack/dispatch | COMPLETE | T,S | Dispatch assigns owned driver, resets OTP |
| B12 | Delivery coordination | PARTIAL | S | Dispatch + service areas; no route/handover UI |
| B13 | Financial dashboard | PARTIAL | T,S | Payments/performance read; settlement missing |
| B14 | Escrow/settlement visibility | PARTIAL | T,S | Ledger read; no settlement transitions |
| B15 | Payout requests/history | MISSING | S | No withdrawal API/flow |
| B16 | Sales reports/analytics | PARTIAL | S | Preview charts only |
| B17 | Notifications/alerts | PARTIAL | S | Preview; `Notification` model orphaned |

## C. Delivery portal

| # | Capability | Status | Evidence | Notes / gap |
|---|---|---|---|---|
| C1 | Driver registration/profile | PARTIAL | S | Settings page read; no self-serve registration |
| C2 | Driver verification/KYC | MISSING | S | No document lifecycle |
| C3 | Job assignment | COMPLETE | T,S | Dispatch assigns driver; driver jobs list |
| C4 | Accept/reject job | PARTIAL | T,S | Accept idempotent; driver reject not implemented |
| C5 | Pickup confirmation | MISSING | S | No pickup transition in state machine |
| C6 | Delivery workflow | COMPLETE | T,S,B | Accept → deliver → review; failed-attempt side-branch now resolves via seller reassign-retry or mark-missed (2026-11-11, task 7.2b, T+S only, no browser check) — no automatic deadline-timeout transition (needs WP-5 background jobs) |
| C7 | OTP verification | COMPLETE | T,S,B | 3-try lockout, encrypted + hashed |
| C8 | Proof of delivery (persisted) | PARTIAL | S | `deliveredQty` + client-attested photo flag; no photo storage |
| C9 | Status/timestamps | COMPLETE | S | `deliveredAt`, `reviewEnds`, events |
| C10 | Delivery history | COMPLETE | T,S | Driver history page |
| C11 | Earnings/payout | MISSING | S | No driver earnings surface |
| C12 | Notifications | MISSING | S | No notification writer |

## D. Admin portal (reconciled to implementation)

| # | Capability | Status | Evidence | Notes / gap |
|---|---|---|---|---|
| D1 | Overview dashboard metrics | COMPLETE | T,S,B | Task 9.13; real aggregates only |
| D2 | User management | PARTIAL | T,S,B | Paginated list only; no actions |
| D3 | Seller listing/detail | COMPLETE | T,S,B | Tasks 9.9/9.10 |
| D4 | KYC review/approval | BLOCKED | S | No documents/decisions in schema |
| D5 | Order monitoring/detail | COMPLETE | T,S,B | Tasks 9.11/9.12 |
| D6 | Shipment/delivery oversight | COMPLETE | T,S | Dedicated `/admin/shipments` ("Deliveries" nav), cross-seller, paginated, status filter (2026-11-11) — read-only, no actions |
| D7 | Audit activity + filters | COMPLETE | T,S,B | Tasks 9.8/9.14 |
| D8 | Admin actor investigation | PARTIAL | S | Actor filter exists; no drill-down profile |
| D9 | Disputes/refunds/escalations | BLOCKED | S | `ShipmentIssue` readable, no resolution ops |
| D10 | Financial/escrow oversight | PARTIAL | T,S | Overview totals; no ledger operations |
| D11 | Payout/settlement operations | BLOCKED | S | No settlement job or payout API |
| D12 | Configuration/settings | MISSING | S | Prototype-only |
| D13 | Admin actions + audit coverage | PARTIAL | T,S | Reads audited; no write actions yet |
| D14 | Permissions/role separation | COMPLETE | T,S | `require_admin` everywhere |

## E. Shared platform & engineering

| # | Capability | Status | Evidence | Notes / gap |
|---|---|---|---|---|
| E1 | Authentication/authorization | COMPLETE | T,S | Four roles; object-scoped ownership |
| E2 | API ownership / coexistence | PARTIAL | S,R | FastAPI: foundation, auth read, catalogue/reviews read, admin; rest Next/Prisma |
| E3 | DB integrity & migrations | COMPLETE | S,R | Prisma sole authority; append-only audit triggers |
| E4 | Transactions/idempotency/concurrency | PARTIAL | T,S | Order placement strong; inventory lost-update race documented |
| E5 | Money precision | COMPLETE | T,S | Decimal(14,2), string serialization |
| E6 | Payment provider | BLOCKED | S | No gateway; COD-only by decision |
| E7 | File/document/image storage | BLOCKED | S | No storage abstraction |
| E8 | Notifications/email/SMS | BLOCKED | S | No provider configured |
| E9 | Background/scheduled work | MISSING | S | No settlement/timeout job |
| E10 | Logging/audit/monitoring | PARTIAL | S | FastAPI structured logs + admin audit; no APM/tracing |
| E11 | Security/rate-limit/CSRF/CORS | PARTIAL | S | Same-origin CSRF check; no rate limiting; CORS FastAPI-only |
| E12 | Error contracts/validation | COMPLETE | T,S | `{error:{code,message,field?}}` |
| E13 | Configuration/secrets | COMPLETE | S | `.env.example`, secrets gitignored |
| E14 | Performance/query efficiency | PARTIAL | S | Batched queries; no load testing |
| E15 | Backup & recovery | MISSING | S | No process/policy |
| E16 | Automated testing & CI | PARTIAL | T,S | Vitest + pytest; `app/.github` CI inert at monorepo root |
| E17 | Accessibility/SEO/responsive | PARTIAL | R,S | Mostly done; audit-flagged gaps |

---

## Count methodology

Every matrix row is one capability (A1–A17, B1–B17, C1–C12, D1–D14,
E1–E17 — 78 rows). Status is assigned to the **most complete meaningful state**
where a capability spans read/write (e.g. reviews = PARTIAL because read exists
but write is missing). `BLOCKED` = owner decision, external integration, or an
approved schema change; `MISSING` = no implementation and no external blocker.

**Tally (78 rows), updated 2026-11-11 (task 7.2b + D6):**

- COMPLETE: **32** (was 31 — D6 moved from PARTIAL: dedicated `/admin/shipments`
  cross-seller monitoring view shipped)
- PARTIAL: **26** (was 27 — D6 moved out)
- MISSING: **14** (A7b,14,16 · B1,2,5,15 · C2,5,11,12 · D12 · E9,15)
- BLOCKED: **6** (D4 KYC review, D9 disputes/refunds, D11 payout/settlement —
  owner rule/schema decisions; E6 payment provider, E7 file storage, E8
  notifications — external providers)
- IMPLEMENTED_UNVERIFIED: **0**
- NOT_IN_SCOPE: **0**

(P0/P1/P2/P3 severity per row is assigned in `IMPLEMENTATION_ROADMAP.md`.)
