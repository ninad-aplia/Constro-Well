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

All three are self-contained vanilla JS SPAs with realistic seeded demo state, **no backend calls**. The shop prototype contains a hand-rolled SHA-256 password hashing demo — the real implementation must be server-side bcrypt/argon, not this.

## 5. Technology stack — PROPOSED, awaiting approval (D2)
- **Next.js (App Router, TypeScript) full-stack monolith**: storefront + seller + driver + admin surfaces as route groups, API routes / server actions as backend. One language, one deployable, fastest to a coherent MVP; matches the developer's React/Next familiarity.
- **PostgreSQL + Prisma** (migrations first-class; Prisma chosen over raw SQL for speed)
- **Auth**: server-side sessions — bcrypt (or argon2) hashes, httpOnly session cookie, sessions table. No OAuth (not needed for MVP).
- **Testing**: light-weight — backend route/service tests with a runner already in the Next.js ecosystem (e.g. Vitest); one e2e smoke script optional.
- Styling: **Tailwind CSS** (design tokens extracted from the prototypes) or plain CSS tokens — final call at Phase 2 start.
- Deployment target: a single Node host or Vercel + managed Postgres (e.g. Neon/Supabase) — decision pending (D10).

## 6. Architecture
Monolith, three layers, no shared types shortcuts across trust boundaries:
- `src/app/**` — UI per role (route groups: `(storefront)`, `seller`, `driver`, `admin`)
- `src/server/**` — API handlers + domain services; **all validation, authorization, money math, stock/deadline state transitions live here**
- `prisma/` — schema + migrations
- Escrow/payout state transitions mirror the prototype state machines (see `docs/PROTOTYPE_AUDIT.md` §4): `new → accepted → packed → dispatched → failed → review → disputed → settled`, side states `rejected | timeout(=missed) | cancelled | refunded`.

## 7. Database entities (minimum viable)
- `User` (role, email, passwordHash, name, phone) · `Session`
- `Seller` (store name, owner, GSTIN, phone, city, pickup address, bank account ref, KYC status, vacation flag) · `SellerPincode` · `Vehicle` · `Driver`
- `Product` (seller, category, name, unit, mrp, price, stock, minOrderQty, unitWeightKg, bulkFlag, reorderLevel, status active/paused, specs json, imageUrl(s))
- `Cart` + `CartItem` (per user; savedForLater flag) · `WishlistItem`
- `Address` (per user, default flag) · `Review` (product, stars, title, body; verified purchase) · `Coupon`
- `Order` (id BG-######, user, address snapshot, payment method + label, totals snapshot incl. GST, status)
  → `OrderLine` (product snapshot: name, unit price applied, qty, seller)
  → **`Shipment`** (one per seller per order: status machine, acceptBy/dispatchBy deadlines, slot, vehicle, driver docs json, otp, deliveredAt, deliveredQty, reviewEnds, issue json, payout json, events)
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
- **Payments: UNRESOLVED (D3/D4 — blocked).** Prototype shows UPI/card/netbanking/COD forms but no gateway. No fake success responses allowed. Do not build checkout payment endpoints until decided; COD-only is the recommended MVP fallback (real order still places).
- SMS for OTP (delivery OTP currently shown in UI, no channel): needs decision D5.
- No shipping-provider integration — vendors self-deliver with own trucks (per prototypes; confirm as D6).
- File uploads (KYC cheque, product photos, driver photo proof) — "demo file" checkboxes in prototype; real uploads deferred unless decided.

## 11. Known limitations / risks
- Prototype hashing is client-side and not portable — replace fully; do not import demo users' records.
- Prototype order IDs/seller IDs are generated client-side with `Math.random` — replace server-side.
- The shop's sellers-per-product are synthesized from the brand + a name pool, not real seller rows. Real model must connect products to `Seller` rows with per-seller price/stock. This is the biggest data-model gap between the shop and seller prototypes.
- The shop has no seller-scoped view of "other sellers" backed by data (fake offers).
- The actual admin portal is being developed separately: backend admin endpoints must exist (role admin) so the future portal can consume them; any admin UI we build is a stopgap exception console.
- Legal/tax: GST-inclusive display, e-way bill thresholds are prototype rules — confirm with the user before shipping beyond demo.
