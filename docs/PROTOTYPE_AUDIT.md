# PROTOTYPE_AUDIT.md — findings from actual inspection of the prototype files

Audit method: full read of every line of the three delivered files (788 / 470 / 433 lines). Everything below is taken from the code, not assumptions.

> **`buildgrid-platform-admin.html` (admin portal design reference)** — named by the product owner, **deliberately deferred: they will add it only after the customer / seller / delivery portals are built**. Until it arrives, the stopgap admin console (TASK 7.4) follows the delivery prototype's Admin tab at D13 fidelity; when the file lands, re-verify that console against it and document deviations. Its audit section is reserved here.

## 1. `buildgrid-shop.html` — customer storefront (788 lines)

### Tech shape
- Single-file vanilla-JS SPA, hash router with 10 registered views: `home, search, product, cart, checkout, thanks, orders, order, wishlist, account` (+ aliases `cat/`, `deals`, `brand/` rewritten into search state).
- State in `localStorage` under key `buildgrid_shop_v1` (users, session, carts per owner incl. `guest`, wishlist, orders, addresses, recently viewed, reviews, helpful votes, pincode, coupon). Graceful in-memory fallback when storage is blocked.
- Fully hand-rolled `sha256` + 1500-round key-stretching "hashPw" for demo accounts — **must not be reused**; server-side bcrypt instead.
- Accessibility is unusually careful: skip link, aria labels/pressed/current, sr-only, focus management, keyboard nav for suggestions/OTP, prefers-reduced-motion + dark-mode tokens. Keep these behaviors in the port.

### Catalogue data model `RAW` → `PRODUCTS`
- 12 categories × 4 products = 48 products: `{id, cat, name, brand, mrp, price, unit, rating, reviews, stock, days, specs[], off, best}`.
- Category art = inline SVG per category (`ART`, `HUE` color map) — reusable as image placeholders.
- "Best seller" = highest-review product per category.

### Business rules implemented client-side (must move server-side, verbatim)
- **Sellers per product**: synthesized 3 offers from brand + name pool `{name, price(+3% or −3%), days(+2 slower for cheapest), verified, rating}` — not real sellers (gap D11).
- **Bulk tiers**: `BULK=[[10,3],[50,6],[200,10]]` — 10+ units −3%, 50+ −6%, 200+ −10%, applied per line via `unitPrice(p,s,q)`.
- **Delivery/ETA**: pincode→city map (9 city prefixes); zone +1 day outside match list; `etaText(days)`.
- **Totals `calc()`**: free delivery ≥ ₹5,000 else ₹199; GST display `(sub−disc)*18/118` (inclusive); coupon engine `couponCheck()`:
  - `BUILD10`: min ₹2,000, 10% off capped ₹5,000
  - `FIRST250`: first-order only, min ₹1,500, flat ₹250
  - `FREESHIP`: min ₹500, free delivery
- Sales ("deals") = products with ≥15% discount; countdown timer to midnight; recently-viewed capped 12.

### Flows
- **Auth**: register (name>=2, valid email, pw≥8, unique email), login (hash+salt compare), demo account `demo@buildgrid.shop` / `demo1234` with seeded Bengaluru address. Guest cart (`owner()="guest"`) merges into user cart on login.
- **Search**: tokenized text match over name/brand/cat/specs; filters category, brand (checkbox), price bands, rating ≥4/≥3, "fast: delivery by tomorrow", deals-only; sorts featured/price-low/price-high/rating/biggest-discount; pager 12/page; suggestions dropdown.
- **Product**: 3-image gallery (art/spec-sheet SVG/site scene), real + synthesized seller offers radio, bulk tier box, qty stepper clamped to stock, "Buy now" and "Add to cart", FBT (frequently-bought-together = product + top-rated of 2 paired categories, priced sum), spec table, generated reviews (seeded RNG per product id, 6 per product, 72/20/8 positive/mid/negative split) + user reviews + "helpful" counters, similar products row, review dialog (rating 1–5, title, body ≥5 chars).
- **Cart**: per-offer line keys `id:selIdx`; qty steppers (max = stock), delete, save-for-later (attach to seller+product key, reversible); free-delivery meter; coupon apply/remove; cross-sell row.
- **Checkout**: requires session (auth prompt w/ redirect-back); address selection or new-address form (validation: name≥2, mobile `^[6-9]\d{9}$`, pincode `^\d{6}$`, city≥2, line≥5; default-address handling); payment methods UI (upi regex, card Luhn + 13–19 digits + expiry check + CVV, netbanking bank select, COD cap ₹50,000) — display/validation only, no real charge.
- **Order placement**: ID `BG-XXXXXX` (random w/ uniqueness check), totals snapshot, items snapshot incl. seller, address snapshot, pay label, ETA = max line days; **stock decremented line-by-line**; cart emptied (not saved items); coupon cleared; order status `stage 0..4` (`Ordered,Packed,Shipped,Out for delivery,Delivered`) with timestamps.
- **Orders**: list w/ big cards, order detail w/ stepper timeline, **"Simulate next update (demo)"** button advancing stage, cancel allowed while stage<2 → stock restored + "Refund initiated" toast, reorder ("Buy it again", adds original qty, seller 0), review buttons post-delivery.
- **Account**: addresses CRUD (add dialog w/ same validation; set-default; delete), wishlist grid page, orders count.

## 2. `buildgrid-seller-dashboard.html` — Seller Hub (470 lines)

### Tech shape
- Vanilla-JS stateful dashboard, sidebar nav (Overview, Orders, Products, Delivery, Payments, Performance, Settings) + fixed mobile bottom tab bar; localStorage key `buildgrid_seller_dash_v1`, seeded via `seed()` (~10 orders across all statuses, 8 products, 180-day daily sales series, notifications, transfers).
- "Demo controls" bar: New order arrives / +1h / +4h / +24h / Reset (time-travel simulation).
- Rules constants: `COMM=.05, LATE=.02, ACCEPT_H=4, DISP_H=24, REVIEW_H=24, EWAY=50000`, `SLOTS=["Today, 2 to 6 pm", "Tomorrow, 8 am to 12", "Tomorrow, 2 to 6 pm"]`.

### Product model (PG): `{id, name, cat, unit, w(kg/unit), mrp, price, stock, min(MOQ), reorder, status(active|paused), bulk(heavy goods flag), sold}`.
### Order status machine `ST`: `new → accepted → packed → dispatched → failed → review → disputed → settled`, side states `rejected, missed(accept-expired), cancelled`.
### Automated timer logic `runTimers()`:
- `new` + past `acceptBy` → `missed` (acceptance rate drops; order "goes to admin")
- `accepted|packed` past `dispatchBy` → flag `late` (2% penalty at payout)
- `review` past `reviewEnds` → `settled`, payout released (escrow → available)
- Notifications generated on each; 30 s background tick.

### Views
- **Overview**: vacation banner mode toggle, 4 attention tiles (new orders w/ countdown, ready-to-dispatch, disputes w/ frozen amount, low stock), date-range KPIs (7/30/90), sales bar chart w/ tooltip + sparkline deltas, payouts panel (available/pending/frozen + withdraw), needs-attention list, top products, improvement tips.
- **Orders**: 7 filter tabs (All/New/To dispatch/On the road/In review/Issues/Paid) + text search; per-row actions Accept / Dispatch / Details; order drawer (side panel): product, kg math, accept/deadline warnings, buyer, vehicle/driver/docs, **payout math breakdown** (items + delivery − commission − late penalty = net; "held in escrow" status), timeline, reject dialog (reasons: out of stock, vehicle booked, pincode, price changed) — rejection noted as lowering acceptance rate, order "goes to admin to reassign".
- **Accept guard**: rejects accept if product stock < order qty with instructive toast; accept decrements product stock.
- **Dispatch dialog validation** (all client-side, must become server-side): vehicle number pattern `^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$`, driver name, mobile pattern, **mandatory challan + GST invoice checkboxes**, e-way 12 digits when order ≥ ₹50,000, weighbridge slip for bulk goods; late warning noted.
- **Products**: table w/ stock stepper (−10/+10 + direct edit), auto-pause when stock hits 0, paused/active toggle with "add stock before activating" guard, low-stock tab, add/edit product dialog (name≥4, MRP>0, 0<price≤MRP, stock≥0, min≥1, w>0, unit≥2; bulk flag; includes rule explainer text).
- **Delivery setup**: service-area pincodes (add/remove, `^[1-9]\d{5}$`), free-above/fee, trucks-per-slot for 3 slots, vehicles+drivers table (add vehicle dialog: reg pattern, dup check, driver name+phone).
- **Payments**: available/pending/frozen balances, next weekly payout date, settled orders table (items/delivery/commission/penalty/net/withdrawn), bank transfers list, **CSV statement export** (client-side blob), withdraw dialog (min ₹1,000; marks settled orders withdrawn; creates transfer record).
- **Performance**: score ring = `0.3*acceptance + 0.4*onTime + 0.3*(1−issues/delivered)` clamped 0–100; tier labels 90+/80–89/<80 (boosted/normal/reduced); metric bars w/ weights; review histogram + list.
- **Settings**: store profile edit (GSTIN pattern `^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$`, phone pattern), pickup address; KYC checklist (GST/PAN verified, cancelled cheque pending → demo mark-verified), payout hold while cheque unverified; 4 notification preference toggles.
- Escrow checks: `new` orders log "Order paid by customer, amount held in escrow".

## 3. `buildgrid-delivery-workflow.html` — vendor-fulfilled delivery demo (433 lines)

### Tech shape
- 5 tabs (`flow, customer, vendor, driver, admin`) + demo clock with +1/+4/+24 h and reset; state `buildgrid_delivery_demo_v1`; seeded: 6 vendors w/ scorecards, 6 orders, 8 shipments covering every state incl. disputed (short quantity), rejected, settled.
- **The canonical nine-step flow** (from `viewFlow()`, verbatim): payment escrow → split per vendor → 4 h vendor accept → vendor dispatch schedule → mandatory documents → customer tracking + OTP → driver collects OTP + photo + quantity (short = auto dispute) → 24 h review window → payout minus commission/penalty.
- **State machine `ST`** is the most complete of the three files: `awaiting → accepted → packed → dispatched → (failed→resched) → review → (disputed) → settled`, sides `rejected, timeout(vendor no-response), cancelled, refunded`; payout math `payFor(s,refund,penalty,late)` handles partial/full refund + commission + penalty + delivery retained/lost correctly.

### Flows per role
- **Customer tab**: order list w/ per-shipment status pills; per-shipment: state-specific guidance, delivery OTP **shown to customer** at dispatched ("give the code only after checking goods"), docs list, escrow payout hint, cancel (before vendor accepted → full refund), confirm-and-release or report-problem (dialog: Short quantity / Damaged goods / Wrong item / Poor quality + description ≥ 5 chars → freezes payout); sample-order button: creates 1 order split into **2 shipments from 2 random vendors**.
- **Vendor tab**: vendor switcher; kanban board (New / To dispatch / On the road / Delivered-in review / Paid); score card + tier; accept (within countdown), reject w/ reason, mark packed, dispatch dialog (same validations as Seller Hub, incl. e-way and weighbridge), failed→reschedule (sets "Tomorrow, 8 am to 12").
- **Driver tab**: phone-mock UI; assigned deliveries list; 4-digit OTP input (auto-advance, backspace nav, **3 wrong tries → status `failed`**), photo proof checkbox (demo), delivered-quantity input (0..qty) → **qty<order auto-opens dispute w/ claim = shortfall×unit price, payout frozen**, full delivery → `review` + 24 h window; "Customer not available" → failed attempt.
- **Admin tab**: escrow KPIs (held / paid vendors / commission / refunds); 4 exception queues: disputes (resolve dialog: **partial refund amount / full refund / reject claim** — each writes a correct ledger outcome), rejected+timeout (reassign to another vendor w/ fresh 4 h accept window, or full refund), late dispatch (nudge), failed attempts; vendor scorecards table + search-tier pills; global activity log.
- **Score formula** identical to Seller Hub; tier labels shared.

## 4. Cross-prototype state machines (unified target model)

```
Shipment lifecycle:
  awaiting/new ──accept──▶ accepted ──pack──▶ packed ──dispatch(+docs)──▶ dispatched
      │ │ │                     │ (late flag past dispatchBy → 2% penalty)
      │ │ └─ timeout (acceptBy passed) → admin: reassign(refresh windows) | full refund
      │ └─── rejected (vendor, w/ reason) → admin: reassign | full refund
      │ └─── cancelled (customer before accept) → full refund, stock restore
      └──────────────────▶ failed (OTP×3 | customer absent) ──reschedule──▶ dispatched
dispatched ──delivery(otp+photo+qty)──▶ review (delivered)                (24 h window)
      └─ short qty ──▶ disputed (auto claim = shortfall×price) → admin resolve:
              partial refund (pay vendor rest) | full refund (vendor pays 0) | reject claim
review ──(no issue)──▶ settled  (payout = items − commission 5% − late penalty 2% + delivery fee, escrow→available)
any settled ──withdraw──▶ transfer record, order marked withdrawn
```

Customer master order (shop prototype) stages: Ordered → Packed → Shipped → Out for delivery → Delivered, cancel before "Shipped" w/ stock restore. Note the shop's simple 5-stage tracker must map onto the richer per-shipment model — proposal documented in ARCHITECTURE_PROPOSAL §3.

## 5. Reusable as-is (moderate effort to port)
- All inline-SVG product art + category palette (`ART`, `THUMB`, `HUE`) — instant placeholder images.
- Interaction patterns and CSS design tokens (colors, fonts, radii, pills, steppers, drawers, dialogs, toasts, charts w/ tooltips) — high-quality baseline; port, don't redesign.
- Validation regex catalog (GSTIN, mobile, pincode, vehicle, UPI ID, Luhn card, password lengths) — keep, re-implement server-side.
- CSV payout-statement generation approach.
- Demo seeds (48 products, 8 seller products, order fixtures across all states) → shape our seed script.

## 6. Gaps between prototypes (must be resolved by design)
1. **Seller↔product**: shop synthesizes offers; seller hub owns products. Real model needs `Product.sellerId` + per-seller stock/price (D11).
2. **Order vs shipment**: shop has flat carts+orders; delivery file splits orders per vendor. Need `Order → Shipment(s)`; shop tracker mapped to shipment aggregation.
3. **Buyer identity**: order in delivery file has only "Rahul Menon" label; no user linkage. Add `userId`.
4. **Review window vs shop reviews**: two different review concepts — delivery acceptance (escrow gate) vs product text reviews. Keep both, name them apart.
5. **Stock**: shop decrements product stock on order; seller hub also decrements on seller **accept** (double decrement risk). Define single source: decrement at dispatch-lock (or Provincial: reserve at accept, restore on reject/cancel) — decide in Phase 2 design note.
6. **Notifications**: seller hub has them; shop/driver none. API: emit events consumed by role views.
7. **Demo clocks / time travel** are test affordances — port as a dev-only seed/test utility, never production surface.
