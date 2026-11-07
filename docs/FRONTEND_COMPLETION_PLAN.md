# Frontend Completion Plan — Stage 1 (all three portals)

**Date:** 2026-11-07 · Prepared per owner brief "STAGE 1: FRONTEND COMPLETION". Frontend only; no backend, schema, migration or auth work.

## Inventory of current state (verified against source, not docs)

### Already complete (verified in source)

**Customer portal**
- Home (TASK 4.1): hero carousel, category tiles, Today's deals, Bulk saver, sign-in tile, best-sellers / finishing-touches rows, recently-viewed row (client, resolves via server action).
- Search (TASK 4.2, actually built ahead of its NOT STARTED row status): query, category, brands, rating, price buckets, sort, pagination, designed empty state ("No results").
- Product detail (TASK 4.3 Stage 1): gallery, buy box (qty stepper + live bulk-price tier), Other sellers comparison, FBT, specs, reviews.

**Seller portal (TASKS 6.1–6.6, UI PREVIEW DONE)** — `SellerStoreProvider`-driven, verified wired:
- Overview with KPIs/charts; orders board incl. accept/reject/dispatch state transitions (`OrdersView.tsx` wires accept/reject/dispatch ×9), order details drawer (`OrderDrawer.tsx`), reject & dispatch dialogs with mandatory-document validation; products CRUD (add **and** edit both open `ProductDialog`), stock steppers, low-stock filter; delivery/vehicles+drivers setup; payments (balance, settled table, withdraw flow); performance (score math + tier); settings.
- Only auth is missing — explicitly out of scope for Stage 1 (Phase 3).

**Delivery portal (TASK 7.2, UI PREVIEW DONE)** — `DeliveryStoreProvider`-driven:
- Overview; assigned-jobs list + drawer via deep link (`DeliveryJobDrawer.tsx`): OTP verify UI (3-try rule), photo-proof flag, delivered-quantity, "Customer not available" issue flow; history with status filters; settings.

### Gaps to close in Stage 1 (owner brief Steps 2–4 mapped to work items)

| # | Gap | Work |
|---|---|---|
| C1 | No cart at all (TASK 4.4) | Client cart state provider + persistence; header cart badge + count; cart page with rows, qty steppers, delete, save-for-later, coupon engine, free-delivery meter, GST display, empty state; "Pairs well with your cart" recommendation row (prototype layout). |
| C2 | Buy box not connected (TASK 4.3 leftover) | Enable Add to cart (toast w/ "Go to cart" action), Buy now → checkout; wishlist remains deliberately disabled (P1, not in Stage 1 scope). |
| C3 | Checkout missing (TASK 5.1 UI) | Address selection + validated new-address form (prototype validation rules); COD-only payment per D3 with ₹50,000 cap enforced in the form; review step; summary aside; Place order → **order confirmation preview** (clearly labelled browser-only). |
| C4 | Order history/tracking missing (TASK 5.3 UI) | Orders list page (order cards, empty state), order detail with 5-stage tracker, "Simulate next update (demo)" (honest label, prototype behaviour), cancel-before-dispatch preview, reorder ("Buy it again"). |
| C5 | Loading/empty/error parity for the above | Loading state while cart lines resolve, error state with retry. |

### Explicitly out of scope (Stage 1 restrictions)

- Any `/api/v1` route, middleware, session/role code, Prisma/DB changes, real payments, fake success screens.
- Wishlist/addresses/account page as standalone screens (TASK 4.5, P1) — checkout's saved-address storage is the only address UI; full account page stays a later task.
- Seller/delivery portals: complete for Stage 1 except noted polish below.

### Polish items (small, within Step 3/4 brief)

- S1 Seller: verify product **details** presentation matches prototype's product dialog depth (add/edit already exist).
- S2 Delivery: verify "Failed attempt" filter and failed-delivery issue reporting render (verified accessible via `/delivery/jobs?filter=failed` and drawer).

## New files (planned)

- `app/src/lib/cart/store.ts` — framework-free cart/coupon/address persistence logic (localStorage; the only place touching it).
- `app/src/lib/shop/validate.ts` — customer-form validation (address fields, COD cap) as pure functions.
- `app/src/lib/api/cart.ts` — Stage-2 API boundary + server-side line resolution.
- `app/src/lib/api/orders.ts` — preview-order store boundary (localStorage today → REST in Stage 2).
- `app/src/components/cart/CartProvider.tsx`, `CartBadge.tsx`, `CartView.tsx`, `CheckoutView.tsx`, `OrdersView.tsx`, `OrderDetailView.tsx`, `ThanksView.tsx`, `OrderCard.tsx`, `CartThumb.tsx`.
- `app/src/app/cart/page.tsx`, `checkout/page.tsx`, `thanks/[id]/page.tsx`, `orders/page.tsx`, `orders/[id]/page.tsx`.

## Modified files (planned)

- `app/src/app/layout.tsx` — mount `CartProvider`.
- `app/src/components/ui/SiteHeader.tsx` — cart badge (client child) to prototype location.
- `app/src/components/product/BuyBox.tsx` — wire Add to cart / Buy now (keep wishlist disabled).
- Product cards stay as-is (disabled add is a documented Stage-1 state; BuyBox is the enabling path).

## Ground rules honoured

- All money math reuses `src/lib/shop/pricing.ts` (bulk tiers, coupons, delivery fee, GST) — no duplicated logic.
- All data access via `src/lib/api/*` facades; components never import `data/*` directly (D14).
- Orders are created **only** in browser storage and every simulated action is labelled demo; no stock mutation of the shared mock catalogue (prototype did decrement stock; documented deviation in the report).
- COD-only + ₹50k cap enforced in the checkout form as the display analogue of the future server boundary (D3/D4: real enforcement lands server-side in Stage 2).
- Prototype design language (nav/palette/cards/typography/interactions) preserved; deviations recorded.
