# PROJECT_CONTEXT.md — Constro Well project reference

> Status: **Phase 1 complete** (audit + foundation docs). No application code exists yet.

## 1. Product overview
Constro Well is a planned e-commerce marketplace for **construction materials in India** (INR throughout, prices GST-inclusive in the prototypes). Model:

- Customers buy by **unit** (bag, bar, tonne, box, pack) with **bulk tier discounts** (10+ units −3%, 50+ −6%, 200+ −10%).
- Orders are paid into **escrow**, split **per vendor** into shipments.
- Vendors accept within 4 h, dispatch within 24 h (late = −2% penalty), deliver with their **own vehicles** under mandatory documents (challan + GST invoice, e-way bill ≥ ₹50,000, weighbridge slip for bulk goods).
- Driver records OTP + photo + delivered quantity; a shortfall auto-opens a dispute and freezes the payout.
- 24 h customer review window, then payout releases minus **5% commission**.
- Admin resolves disputes/rejections/timeouts; vendor score (30% accept + 40% on-time + 30% issue-free) drives search tier (≥90 boosted, 80–89 normal, <80 reduced).

Platform commission 5% · delivery free ≥ ₹5,000 else ₹199 · COD cap ₹50,000 (prototype rule).

## 2. Confirmed requirements
- Working MVP in ~48 h: storefront, frontend app, backend APIs, DB + migrations, auth + role authorization, catalogue + inventory, cart + checkout, order management, seller portal, delivery workflow, admin, tests, setup docs.
- The **actual admin portal is a separate product being built elsewhere** — the prior lead stated the seller dashboard is NOT the admin portal. Admin-facing exception workflows exist in the delivery prototype and must be covered, but do not conflate the two.
- Existing prototypes must not be discarded or blindly rebranded (see `DECISIONS.md` D1, D9).

## 3. User roles
| Role | Capabilities |
|---|---|
| customer | browse/search/filter, product pages, cart + save-for-later, wishlist, coupons, multi-address checkout, order tracking + cancel (before stage 2), reviews, account |
| seller (vendor) | store profile (GSTIN validation), KYC checklist, product CRUD incl. stock adjustments + auto-pause at 0 stock, order accept/reject (with reason counting), pack/dispatch (vehicle + driver + mandatory docs), service-area pincodes, delivery rules (free threshold, fee, slots per day), vehicles + drivers, payouts (escrow/pending/frozen), CSV payout statement, vacation mode, notifications, performance score + reviews |
| driver | mobile-driver view: assigned deliveries, 4-digit customer OTP (3 tries → failed attempt), photo proof, recorded delivered quantity, customer-unavailable marking |
| admin | exception queue: disputes (partial/full refund / reject claim), rejected + timeout reassignment to another vendor, late-dispatch chasing, failed attempts; escrow ledger KPIs (held / paid to vendors / commission / refunds); vendor scorecards + search-tier ranking; activity log |

## 4. Existing prototypes (source UIs — audit details in `docs/PROTOTYPE_AUDIT.md`)
| File | Role | Size | Persistence |
|---|---|---|---|
| `buildgrid-shop.html` | customer storefront (SPA, hash router, 10 views) | 788 lines, 114 KB | `localStorage` `buildgrid_shop_v1` |
| `buildgrid-seller-dashboard.html` | Seller Hub (7 sections, order drawer, dialogs, CSV export) | 470 lines, 81 KB | `localStorage` `buildgrid_seller_dash_v1` |
| `buildgrid-delivery-workflow.html` | multi-role delivery demo (5 tabs: flow / customer / vendor / driver / admin) | 433 lines, 65 KB | `localStorage` `buildgrid_delivery_demo_v1` |
| `buildgrid-platform-admin.html` | admin portal design reference — **owner will deliver after the 3 portals are built**; audit reserved | – | – |

All reachable prototypes are self-contained vanilla JS SPAs with realistic seeded demo state, **no backend calls**. The shop prototype contains a hand-rolled SHA-256 password hashing demo — the real implementation must be server-side bcrypt/argon, not this.

**Prototype fidelity (D13, APPROVED):** the prototypes are the primary visual/UX references for every portal. Preserve palette, typography, identity, navigation, layouts, journeys; improve responsiveness/a11y/states/polish; never genericize or drop features pending backend. Verification steps per UI task are in `AGENTS.md`.

## 5. Technology stack — **APPROVED 2026-11-05 (D2)**
- **Next.js (App Router, TypeScript) full-stack monolith** in `app/`: storefront + seller + driver + admin surfaces as route groups, API routes as backend. One language, one deployable; matches developer's React/Next familiarity.
- **PostgreSQL + Prisma** (schema-first, migrations via Prisma)
- **Auth**: server-side session cookie, bcrypt password hashes, sessions table, role checks in API layer. No OAuth.
- **Validation**: Zod at every API boundary; no business rules duplicated in components.
- **Testing**: Vitest — unit (money/pricing/state math) + API integration + critical end-to-end workflow tests (D12).
- **Styling**: Tailwind CSS with design tokens lifted from the storefront prototype (see `docs/PROTOTYPE_AUDIT.md`).
- **Payments (D3/D4)**: COD only, ₹50,000 max order value, enforced server-side. No simulated online payments.
- **Deployment (D10)**: local dev first; Docker-based deployment prepared in Phase 8.

## 6. Architecture
Monolith, three layers, no shared types shortcuts across trust boundaries:
- `src/app/**` — UI per role (route groups: `(storefront)`, `seller`, `driver`, `admin`)
- `src/server/**` — API handlers + domain services; **all validation, authorization, money math, stock/deadline state transitions live here**
- `prisma/` — schema + migrations
- Escrow/payout state transitions mirror the prototype state machines (see `docs/PROTOTYPE_AUDIT.md` §4): `new → accepted → packed → dispatched → failed → review → disputed → settled`, side states `rejected | timeout(=missed) | cancelled | refunded`.

## 7. Database entities (minimum viable)
- `User` (role, email, passwordHash, name, phone) · `Session`
- `Seller` (store name, owner, GSTIN, phone, city, pickup address, bank account ref, KYC status, vacation flag) · `SellerPincode` · `Vehicle` · `Driver`
- `Product` (canonical catalogue: category, name, brand, unit, mrp, unitWeightKg, bulkFlag, specs json, imageUrl) · **`SellerOffer`** (seller-specific listing: product, seller, price, stock, minOrderQty, status active/paused, reorderLevel, soldCount, leadTimeDays, verified, rating)
- `Cart` + `CartItem` (per user; references the selected `SellerOffer`; savedForLater flag) · `WishlistItem`
- `Address` (per user: name, phone, line1, city, state, pin, label, default flag) · `Review` (product, stars, title, body; verified purchase) · `Coupon` (code, percent/flat discount, maxDiscount, minSubtotal, firstOrderOnly, freeDelivery)
- `Order` (id BG-######, user, address snapshot, payment method + label, subtotal/discount/coupon/GST/delivery/total snapshots, status)
  → `OrderLine` (product + seller + offer references, plus name/unit/unitPrice/qty/lineValue snapshots)
  → **`Shipment`** (one per seller per order: status machine, acceptBy/dispatchBy deadlines, slot, vehicle, driver docs json, bcrypt OTP hash + AES-GCM encrypted customer copy, deliveredAt, deliveredQty, reviewEnds, issue json, payout json, events)
  → `ShipmentEvent` (who, message, at)
- `EscrowEntry` / payout ledger (held, commission, penalty, refund, released, withdrawn)
- `Notification` (seller) · `NotImplementedYet`: chat/returns workflow

## 8. API conventions (proposed)
- REST JSON under `/api/v1`, snake-free camelCase bodies, numeric money in **paise (integers)** or `Decimal` strings — decide once, document, never floats.
- Auth via httpOnly cookie session; role check middleware per route group; seller routes additionally scoped by ownership (sellerId on every row).
- Errors: `{ error: { code, message, field? } }` with correct HTTP codes.
- Price totals, discounts, commission, penalties, GST, delivery fee computed **server-side only**; client totals are display hints.
- Seed/demo data: separate seed script, never in runtime paths.

## 9. Frontend conventions
- Reuse the prototypes' interaction patterns and visual language; treat them as the spec, not as legacy to redesign.
- Every list view: loading, empty, and error states. Toasts for actions. Mobile: the shop prototype is fully responsive down to 640 px, seller hub shown at 1100/760 breakpoints, driver UI is phone-first.
- Money formatting `₹` + Indian grouping (`en-IN`); dates `en-IN`.

## 10. Integrations
- **Payments: APPROVED (D3/D4).** COD-only MVP, ₹50,000 max order value, enforced server-side. No simulated online payment flows; gateway UI deferred until an approved decision provides real keys.
- **Delivery OTP channel (D5 — still OPEN):** OTP generated server-side and shown in the customer order view; **no SMS provider** until user supplies one. Do not fake "SMS sent".
- No shipping-provider integration — vendors self-deliver with own trucks (per prototypes; confirm as D6).
- File uploads (KYC cheque, product photos, driver photo proof) — "demo file" checkboxes in prototype; real uploads deferred unless decided.

## 11. Known limitations / risks
- Prototype hashing is client-side and not portable — replace fully; do not import demo users' records.
- Prototype order IDs/seller IDs are generated client-side with `Math.random` — replace server-side.
- The shop's sellers-per-product are synthesized from the brand + a name pool, not real seller rows. Resolved by D11 (products belong to individual vendors); product detail offers become real seller-backed rows.
- **Admin portal UI is a separate product being developed elsewhere (D7 APPROVED):** backend admin endpoints must exist (role admin) so the external portal can consume them; our admin UI is a stopgap exception console only.
- Legal/tax: GST-inclusive display approved for MVP (D8); e-way bill thresholds are configurable business rules — confirm with the user before anything beyond demo.
- **Branding (D1 APPROVED):** new app is Constro Well; prototypes remain BuildGrid byte-identically; no final logo invented — use a neutral wordmark placeholder.
