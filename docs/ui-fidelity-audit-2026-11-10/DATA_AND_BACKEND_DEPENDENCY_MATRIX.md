# DATA_AND_BACKEND_DEPENDENCY_MATRIX.md

Phase 04A — Deliverable 8 of 11. Stage 6 (data-source verification).

For every visible metric, table, chart and action: where the number comes from, whether it is real, whether it can go stale, whether it is authorized, and whether the UI is honest about it.

Legend for **Source**: `DB` = PostgreSQL via Prisma · `PREVIEW` = client-side mock store or hardcoded fixture · `COMPUTED` = derived server-side from DB rows · `NONE` = element has no data.
**Honest?** = does the screen tell the user when data is preview/limited.

---

## 1. Seller portal

| Screen | Element | Source | Real? | Stale risk | Authorized? | Persists? | Honest? |
|---|---|---|---|---|---|---|---|
| Overview | 4 attention counts (new orders, ready to dispatch, open disputes, low stock) | `DB` via `sellerSummary(seller.id)` | ✅ | Low — recomputed per request | ✅ `requireSeller` scope in `seller/layout.tsx:26-35` | n/a (read) | ✅ disclosure names live vs preview |
| Overview | Delivery score ring, sales/orders/AOV? | `COMPUTED` from shipments | ✅ score; sales/orders numbers live | Low | ✅ | n/a | ✅ |
| Overview | Sales bar chart, Top products, Needs-attention list | `PREVIEW` (`SellerStoreProvider`) | ❌ | High — does not move with DB | n/a | ❌ | ✅ explicit in the banner (`seller/page.tsx:77`) |
| Overview | Payout balances (available / pending / frozen) | `COMPUTED` from `EscrowEntry` | ✅ arithmetic | Low | ✅ | n/a | ⚠️ arithmetic can be negative (see Payments) |
| Orders | Order rows, buyer, value, status, deadlines | `DB` (`Shipment` + relations) | ✅ | **Yes** — `acceptBy`/`dispatchBy` are fixed timestamps; all seeded rows now read "overdue" | ✅ seller-scoped, other sellers' shipments indistinguishable from missing | n/a | ✅ |
| Orders | Buyer name | `DB.addressSnapshot.name` | ❌ **blank** for seeded orders (`seed.ts:334`) | n/a | ✅ | n/a | ❌ renders empty, no fallback |
| Orders | Accept / reject / pack / dispatch | `DB` mutations | ✅ | n/a | ✅ ownership re-checked in `sellerService` | ✅ | ✅ |
| Products | Product rows, price, MRP, stock, status, sold-30d | `DB` (`SellerOffer`→`Product`) | ✅ | Low | ✅ seller-scoped | ✅ | ✅ |
| Products | Stock stepper / status toggle | `DB` write | ✅ | n/a | ✅ | ✅ | ✅ (lost-update risk documented in the P0 spec) |
| Delivery | Service-area pincodes | `DB` (`SellerPincode`) | ✅ | Low | ✅ | ✅ | ✅ |
| Delivery | Free-above, fee, slot capacity | `DB` (`Seller`) | ✅ | Low | ✅ | ✅ | ✅ |
| Delivery | Vehicles and drivers table | `PREVIEW` | ❌ | High | n/a | ❌ | ✅ "isn't connected to the database yet" |
| Payments | Summary cards | `COMPUTED` from `EscrowEntry` | ✅ arithmetic | Low | ✅ | n/a | ✅ banner explains withdrawal is not implemented |
| Payments | Available-to-withdraw figure | `COMPUTED` | ⚠️ **−₹32,947** — transfers seeded above released escrow | n/a | ✅ | n/a | ❌ a negative payable is nonsensical even with a caveat |
| Payments | Escrow ledger | `DB` (`EscrowEntry`) | ✅ | Low | ✅ | n/a | ✅ |
| Payments | "Released to payable balance" rows | `DB` — **seeded only**; no production path writes `settled` or `released` | ⚠️ real rows, unreachable state | n/a | ✅ | n/a | ❌ implies settlement is running |
| Payments | Statement CSV | client-side export | ✅ | n/a | ✅ | n/a | ✅ |
| Performance | Score, acceptance, on-time, issue-free rates | `COMPUTED` from shipments | ✅ | Low | ✅ | n/a | ✅ |
| Performance | Review histogram and review cards | `PREVIEW` | ❌ | High | n/a | ❌ | ✅ "reviews shown here are preview data" |
| Settings | Store name, GSTIN, phone, city, pickup, vacation mode | `DB` (`Seller`) | ✅ | Low | ✅ ownership via resolved seller id | ✅ | ✅ |
| Settings | KYC statuses | `DB` (`Seller.kyc*`) | ✅ | Low | ✅ | read-only | ✅ |
| Settings | Alert toggles | session-local | ❌ | n/a | n/a | ❌ | ✅ "only apply to this browser session" |
| Top bar | Bell count | `DB` summary | ✅ | Low | ✅ | n/a | ⚠️ opens nothing |

---

## 2. Delivery portal

| Screen | Element | Source | Real? | Stale risk | Authorized? | Persists? | Honest? |
|---|---|---|---|---|---|---|---|
| Deliveries | Assigned jobs, status, vehicle, slot | `DB` (`Shipment` where `driverId`) | ✅ | Low | ✅ `resolveDriverForUser` (`delivery/layout.tsx:23-26`) | n/a | ✅ |
| Deliveries | Buyer name / drop-off | `DB.addressSnapshot.name` | ❌ blank for seeded rows | n/a | ✅ | n/a | ❌ |
| Deliveries | Search | client filter | ✅ | n/a | ✅ | n/a | ✅ |
| Deliveries | Accept job | `DB` write | ✅ (source) | n/a | ✅ | ✅ | ⚠️ completion not gated (`DEL-03`) |
| Complete delivery | OTP verification | `DB` (`Shipment` OTP hash, attempt counter) | ✅ | n/a | ✅ driver-scoped | ✅ | ✅ |
| Complete delivery | Photo | `NONE` | ❌ | n/a | n/a | ❌ | ✅ "photo stays on the driver's phone" |
| Complete delivery | Quantity delivered → dispute | `DB` (`OrderLine`/`ShipmentIssue`) | ✅ | n/a | ✅ | ✅ | ✅ |
| Complete delivery | Issue reason | `DB` (`ShipmentIssue`) | ✅ | n/a | ✅ | ✅ | ✅ |
| History | Delivered rows, review/disputed/paid | `DB` | ✅ | Low | ✅ | n/a | ✅ |
| Settings | Vehicles and drivers | `DB` (`Vehicle`,`Driver`) | ✅ | Low | ✅ seller-owned | read-only here | ✅ |
| Settings | Rules panel | static copy matching real rules | ✅ | Low | n/a | n/a | ✅ |
| Banner | "no real GPS tracking or SMS/WhatsApp" | static | n/a | n/a | n/a | n/a | ✅ |

---

## 3. Customer portal

| Screen | Element | Source | Real? | Stale risk | Authorized? | Persists? | Honest? |
|---|---|---|---|---|---|---|---|
| Home | Hero slides | `PREVIEW` | ❌ | High | n/a | ❌ | ⚠️ not disclosed |
| Home | Category tiles | `PREVIEW`/static art | ❌ (art) | Medium | n/a | n/a | ⚠️ not disclosed |
| Home | Product rows | `DB` (`catalogDb`) | ✅ | Low | public | n/a | ✅ "Catalogue data from the marketplace database" |
| Search | Results, facets, counts | `DB` | ✅ | Low | public | n/a | ✅ |
| Search | Rating + review count on cards | `DB` (`Review` aggregate, raw count) | ✅ but sparse (0–2) | Low | public | n/a | ⚠️ reads as "no reviews" rather than "not yet reviewed" |
| PDP | Price, MRP, off, stock, seller offers | `DB` | ✅ | Low | public | n/a | ✅ |
| PDP | Frequently-bought-together | `PREVIEW` | ❌ | High | n/a | ❌ | ✅ "Sample catalogue data for preview" |
| PDP | Add to cart (buy box) | `DB` (`CartItem`) | ✅ | n/a | ✅ user session | ✅ | ✅ |
| Cards | Add to cart, heart | `NONE` (disabled) | ❌ | n/a | n/a | ❌ | ✅ title explains, but reads as broken |
| Cart | Lines, totals, coupon | `DB` | ✅ | Low | ✅ owner-scoped | ✅ | ✅ |
| Cart | Guest access | redirect | n/a | n/a | ✅ | n/a | ✅ |
| Checkout | Address, COD, totals | `DB` + server recalculation | ✅ | Low | ✅ | ✅ | ✅ |
| Checkout | ₹50,000 COD cap | `COMPUTED` (`COD_CAP`) | ✅ | n/a | ✅ | n/a | ✅ |
| Orders | Order list, totals, ETA | `DB` | ✅ | Low | ✅ `userId` scoped | n/a | ✅ |
| Orders | SHIP TO | `DB.addressSnapshot.name` | ❌ blank (seed) | n/a | ✅ | n/a | ❌ |
| Orders | Track package | `DB` (`fetchOrder`) | ✅ | Low | ✅ | n/a | ✅ |
| Order detail | 5-stage tracker | `COMPUTED` from shipment timestamps | ✅ | Low | ✅ | n/a | ✅ |
| Order detail | Cancel | `DB` write + stock restore | ✅ | n/a | ✅ | ✅ | ✅ |
| Order detail | Review authoring | `NONE` | ❌ | n/a | n/a | ❌ | ✅ absent (no fake UI) |
| Wishlist | — | `NONE` | ❌ | n/a | n/a | ❌ | ✅ 404 rather than fake |
| Account | — | `NONE` | ❌ | n/a | n/a | ❌ | ✅ 404 |

---

## 4. Admin portal

No elements exist. Every metric in `buildgrid-platform-admin.html` (`:343-436`) is **NONE** — including platform sales, commission earnings, order counts, held escrow, health targets, category share, approval queue, payout queue, activity log. This is not a preview-data problem; there is no screen.

---

## 5. Backend dependency classification

The brief requires distinguishing work that is UI-only from work that needs backend changes.

### 5.1 Frontend-only (no backend change)

| Item | Gap IDs | Why |
|---|---|---|
| Two-row customer header, category strip, deliver-to control, account menu | CUST-01 | Category and serviceability data already exist (`Category`, `SellerPincode`, `service.ts`) |
| Four-column footer | CUST-07 | Static |
| Product card density, best-seller tag, delivery promise line | CUST-05 | Fields already on `Seller`/`SellerOffer` |
| Restore card "Add to cart" by wiring the existing cart API | CUST-09 | `addCartItem` already exists; only the component is disabled |
| Mobile stat-card grid, top-bar toggle, sidebar identity-card clip | SELL-03/04/DEL-06 | Layout only |
| Products default sort, pill placement, wording | SELL-05 | Data present |
| Payments screen restructured into settled-orders table | SELL-02 | `EscrowEntry` + `Shipment` already carry the data |
| Seed snapshot backfill | SELL-01/DEL-01/CUST-10 | `prisma/seed.ts` only — not a schema change |
| Seed time windows relative to `now()` | SELL-08 | Seed only |
| Reviews section attribution copy | SELL-09 | Copy, pending the aggregate |

### 5.2 Needs small read-only backend work (no schema change)

| Item | Gap IDs | Why |
|---|---|---|
| Sales chart + top products from real orders | SELL-07 | Aggregation over `Order`/`OrderLine` |
| Seller-scoped review aggregate | SELL-09 | Join `Review → Product → SellerOffer` |
| Brand facet, delivery facet | CUST-06 | Query extension over existing catalogue |
| Review counts / rating display normalised | CUST-05 | Aggregate exists |
| Wishlist API | CUST-03 | `WishlistItem` model exists, no service |
| Account/address API surface | CUST-04 | `Address` model + create path exist |

### 5.3 Needs new backend capability or schema

| Item | Gap IDs | Why |
|---|---|---|
| Review authoring + helpful votes | CUST review gap | `Review` exists; no create endpoint, no helpful-vote model |
| Guest cart | CUST-02 | No anonymous cart persistence |
| Proof-of-delivery photo | DEL-02 | No file storage of any kind |
| Vehicle/driver CRUD | SELL-06 | Models exist; no endpoints |
| Notification panel | SELL-10 | `Notification` is seller-only and has no service |
| Payout withdrawal | SELL-02 | No payout/batch entity, no bank integration |
| Settlement + timeout scheduler | (cross-cutting) | Verified absent; blocks real "settled" data |
| **Entire admin portal** | ADM-01..04 | Needs 5 new tables (payout batch, dispute, platform settings, audit log, KYC documents) + ~20 endpoints |

---

## 6. Honesty assessment

The application is unusually honest: nearly every preview-backed element is labelled in place, and unimplemented affordances are disabled or replaced with a truthful status rather than fake success. The exceptions found are:

1. **Payments** — a negative payable, and `released` ledger rows that production code can never create, imply a live settlement process.
2. **Buyer/ship-to names** — blank fields with no fallback read as a rendering bug.
3. **Home hero/category tiles** — preview content with no disclosure (the only undisclosed preview data found).
4. **Customer card rating** — "0" reviews for products with no reviews, rather than "No reviews yet".
5. **Delivery "Accept job"** — an enabled completion path that the stated rule says should require acceptance first.

This honesty is an asset for the client conversation: it means the distance to the prototype is mostly *unbuilt surface*, not *misrepresented surface*.
