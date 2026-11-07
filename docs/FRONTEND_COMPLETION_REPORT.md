# Frontend Completion Report — Customer Portal (Cart, Checkout, Orders, Tracking)

**Date:** 2026-11-09 · **Writer agent:** Claude Code (Sonnet 5), Freebuff session · **Task:** repair the Customer Cart/Checkout/Orders/Tracking implementation identified as broken in `docs/CLAUDE_HANDOFF_AUDIT.md`. This is a verified-current status report, not a plan — every claim below was re-derived from source and/or executed in this session.

**Verdict: the Customer Portal (home → search → product detail → cart → checkout → orders → tracking → thanks) builds clean, lints clean, has a new unit-test suite passing, and was verified end-to-end in a real browser. It remains a mock-data/localStorage preview by design (D14) — no server-side order creation, no real payment, no live inventory.**

---

## 1. What changed in this repair pass

| Priority | Status | Summary |
|---|---|---|
| 1 — TypeScript error | ✅ Fixed | `CheckoutView.tsx` address resolution rewritten as `Address \| null`, resolved explicitly per path, narrowed with an explicit `if (!addr) return;` guard. No `any`/cast/`!`. |
| 2 — Stock/pricing bug | ✅ Fixed | `resolveCartLines` now prices the same clamped quantity it displays; `CartLine` gained `requestedQty`/`outOfStock`; zero-stock handled explicitly in the UI; persisted entries reconciled against resolved stock. |
| 3 — ESLint (7 errors) | ✅ Fixed | All 5 `set-state-in-effect` violations restructured to the project's established "deferred async load" shape; both `react-hooks/purity` violations resolved by moving `Math.random`/`Date.now` to plain module-level functions. |
| 4 — Dead code | ✅ Fixed | `CheckoutView.tsx`'s unused `getOrderExists` removed; no other orphaned code found in the cart/checkout/orders area. |
| 5 — Stock edge cases | ✅ Fixed | Normal, low, zero stock, over-limit request, quantity reduction, removed-from-catalogue, and unavailable-during-revalidation are all handled explicitly and distinctly in the UI (see §4). |
| 6 — Testing | ✅ Done | Vitest + jsdom added (D18, fulfilling the already-approved D2/D12 choice); 61 new unit tests across 6 files; `@playwright/test` kept, not removed, reserved for future e2e. |
| 7 — Verification | ✅ Done | `tsc`, `lint`, `vitest`, `prisma validate`, `next build` all green; full browser walkthrough of every required flow, including a real bug (checkout→thanks navigation race) found and fixed during that walkthrough. |

---

## 2. Files changed in this repair pass

**Modified:**
- `app/src/lib/shop/types.ts` — `CartLine` gained `requestedQty: number`, `outOfStock: boolean`.
- `app/src/lib/api/cart.ts` — `resolveCartLines` computes `effectiveQty` once, prices only that value; sets `outOfStock`.
- `app/src/lib/api/orders.ts` — added `makePreviewOrderId` (moved from `CheckoutView.tsx`, now unit-tested).
- `app/src/lib/cart/store.ts` — `addEntry` no longer force-increments an out-of-stock (`max <= 0`) merge.
- `app/src/components/cart/CartProvider.tsx` — mount effect restructured to call `resolveCartLines` directly with an inline `.then()` (not the local `refresh` wrapper) to satisfy `react-hooks/set-state-in-effect`; `recompute` fixed for `max <= 0`; added `notice`/`dismissNotice` to `CartApi`; reconciliation logic extracted to `lib/cart/reconcile.ts`.
- `app/src/components/cart/CartView.tsx` — mount effect replaced with a lazy `useState` initializer; per-line rendering branches on `outOfStock`/reduced-quantity; added the `CartNotice` banner.
- `app/src/components/cart/CheckoutView.tsx` — `place()`'s address resolution rewritten type-safe; `purchasableLines` (excludes `outOfStock`) used for the order's item list, review section, and the empty-cart guard; mount-time address state computed via a lazy initializer (`initialAddressState`); `Math.random`/`Date.now` isolated into module-level/imported functions; dead `getOrderExists` removed; `orderJustPlaced` ref added to fix the navigation race found during browser testing.
- `app/src/components/cart/OrderDetailView.tsx`, `OrdersView.tsx` — effects restructured to the same deferred-load shape; `window.location.href` replaced with `useRouter().push`.
- `app/src/components/cart/ThanksView.tsx` — removed unused `dLong`; `window.location.href` replaced with `useRouter().push`.
- `app/src/app/orders/[id]/page.tsx` — keyed `<OrderDetailView key={id} id={id} />` for a clean remount per order id; added `export const instant = false`.
- `app/src/app/cart/page.tsx`, `checkout/page.tsx`, `orders/page.tsx`, `thanks/[id]/page.tsx` — added `export const instant = false` (same `cacheComponents` fix already used everywhere else in this project).
- `app/package.json` — added `test`/`test:watch` scripts (Node's `--no-experimental-webstorage` flag, required so jsdom's `localStorage` isn't shadowed by Node 22+'s own experimental global — see §5).
- `DECISIONS.md` — new entry D18 (testing strategy).

**New:**
- `app/vitest.config.ts`.
- `app/src/lib/cart/reconcile.ts` + `reconcile.test.ts` (pure reconciliation logic, extracted for testability).
- `app/src/lib/shop/pricing.test.ts`, `validate.test.ts`.
- `app/src/lib/api/cart.test.ts`, `orders.test.ts`.
- `app/src/lib/cart/store.test.ts`.
- `docs/FRONTEND_COMPLETION_REPORT.md` (this file).

**Not changed (explicitly out of scope per the repair task's restrictions):** `app/prisma/schema.prisma`, any migration, any database record, any approved business rule (bulk tiers, GST, COD cap, coupon rules all byte-identical to before), the UI's visual design, `data/seller.ts` (not connected to customer-cart stock — see §6).

---

## 3. Stock and pricing design — verified consistent

- **ProductDetail still excludes `stock`** (`app/src/lib/api/catalog.ts`'s `ProductDetail` type) and `BuyBox.tsx` still has no stock reference and no client-side quantity ceiling — this architectural decision was preserved exactly, per the task's explicit instruction.
- **Stock is resolved exactly once per cart line**, in `resolveCartLines` (`app/src/lib/api/cart.ts`): `effectiveQty = Math.max(0, Math.min(e.q, p.stock))`. Both the displayed quantity and the priced quantity (`u`, `total`) now come from this single value — the original bug (clamped display, unclamped pricing) is structurally impossible to reintroduce without touching this one line, and a regression test (`cart.test.ts`) pins the exact scenario that was broken.
- **Bulk pricing** (`bulkTier`/`unitPrice` from `lib/shop/pricing.ts`) is reused, not duplicated, by both `resolveCartLines` and `CartProvider`'s own `recompute` (used for optimistic merges and the quantity stepper) — both now apply the same `max <= 0 → qty 0` rule.
- **Cart totals** (`calcTotals`, same module) are unaffected by any of this — they sum each line's already-correct `total`/`q`, so a zero-stock line (`total: 0, q: 0`) naturally contributes nothing, with no special-casing needed.

---

## 4. Stock edge cases — how each is actually handled now

| Scenario | Behaviour |
|---|---|
| Normal stock | Priced at the requested quantity; "In stock" shown. |
| Low stock (≤ 15) | "Only N left" shown in the cart; quantity stepper still capped at `stock`. |
| Zero stock | `outOfStock: true`, `q: 0`, `total: 0`. Cart row shows "Out of stock — remove it to check out", no quantity stepper, no "Save for later", price column shows "—". Excluded from the checkout order entirely (`purchasableLines` filter) and from the empty-cart redirect guard's "is there anything to buy" check. |
| Requested qty > stock | Quantity is clamped to `stock` for both display and price; a red "Only {stock} left — reduced from {requestedQty}" message explains the reduction. The persisted entry is also reconciled (clamped) so the over-limit number doesn't reappear on the next load. |
| Quantity reduction (stepper) | `setQty` recomputes `u`/`total` at the new quantity immediately — verified live (14 → 13 units recalculated the line total and header badge correctly). |
| Product removed from catalogue | `resolveCartLines` drops the line (can't resolve a product/offer that no longer exists); the reconciliation step now also prunes the dead entry from `localStorage` instead of leaving a permanent zombie row, and surfaces a dismissible "no longer available" notice. |
| Product unavailable during cart revalidation | Same path as "removed from catalogue" — handled identically and consistently, not a separate code path. |

---

## 5. Testing

**Decision:** `DECISIONS.md` D18 adds Vitest (already named in D2/D12 but never actually installed) for unit tests, and formally notes that `@playwright/test` was previously added with no decision record — it is kept (not removed, per the task's explicit instruction), reserved for the end-to-end tests D12 scopes separately from unit tests.

**New dependencies:** `vitest@^3.2.7`, `jsdom@^31` (devDependencies only).

**61 tests across 6 files, all passing:**
- `lib/shop/pricing.test.ts` (19) — bulk-tier boundaries (9/10/49/50/199/200 units), coupon engine (BUILD10/FIRST250/FREESHIP/invalid), `calcTotals` (free-delivery threshold, GST, coupon interaction).
- `lib/shop/validate.test.ts` (9) — address field validation, COD cap boundary.
- `lib/api/cart.test.ts` (7) — **the regression suite for the fixed bug**: normal/low/zero stock, the over-limit clamp-and-price-consistency case, bulk pricing at a clamped quantity, dropped lines for an unknown product/offer.
- `lib/cart/reconcile.test.ts` (5) — no-op when nothing changed, clamp-down reconciliation, out-of-stock entries left untouched, pruning + notice text (singular/plural).
- `lib/cart/store.test.ts` (11) — `addEntry`'s pure merge logic (including the out-of-stock no-increment fix) and a real `localStorage` round-trip (write/read, malformed-row rejection, duplicate-row merging).
- `lib/api/orders.test.ts` (10) — order save/list/get, `advanceOrderStage` (including "does nothing past stage 4" and "does nothing when cancelled"), `cancelOrder` (including "refuses at/after stage 2"), and `makePreviewOrderId`'s collision retry.

**Environment note:** Node 22+'s own experimental global `localStorage` (present but non-functional without `--localstorage-file`) silently shadows jsdom's `window.localStorage` unless disabled. `package.json`'s `test`/`test:watch` scripts invoke Node directly with `--no-experimental-webstorage`, and `vitest.config.ts` also sets this via `poolOptions.{threads,forks}.execArgv` so Vitest's worker threads get the same flag (CLI-level flags don't propagate to worker threads automatically). Both were necessary — confirmed by reproducing the failure with each fix applied individually before combining them.

---

## 6. Explicit non-changes (per task restrictions, honoured)

- No backend API routes implemented.
- `app/prisma/schema.prisma` not touched; no migration run; no database record modified.
- No approved business rule changed — `BULK`, `couponCheck`, `calcTotals`, `COD_CAP`, `validateAddress`'s regexes are byte-identical to before this pass.
- The Seller Hub's mock product dataset (`app/src/data/seller.ts`) was **not** connected to customer-cart stock resolution — `resolveCartLines` still sources stock from the customer catalogue's own `Product.stock` field only, per the explicit instruction not to invent a new stock source or connect the two datasets without first verifying the existing architecture (verified: they are intentionally separate per D11's still-open seller↔product unification gap).
- No existing untracked work was discarded; nothing staged, committed, pushed, or deployed.

---

## 7. Verification — exact results

```
$ npx tsc --noEmit
(exit 0, no output)

$ npm run lint
> eslint src
(exit 0, no output)

$ npm run test
 ✓ src/lib/shop/validate.test.ts (9 tests)
 ✓ src/lib/cart/reconcile.test.ts (5 tests)
 ✓ src/lib/cart/store.test.ts (11 tests)
 ✓ src/lib/shop/pricing.test.ts (19 tests)
 ✓ src/lib/api/orders.test.ts (10 tests)
 ✓ src/lib/api/cart.test.ts (7 tests)
 Test Files  6 passed (6)
      Tests  61 passed (61)

$ npx prisma validate
The schema at prisma\schema.prisma is valid 🚀

$ npm run build   (next build, Turbopack)
✓ Compiled successfully
✓ Generating static pages (22/22)
Route (app): 22 routes listed, correct ○/◐/ƒ categorization
  (no cacheComponents errors, no dynamic-rendering diagnostics)
```

**Browser verification (dev server, real interactions, not just HTTP checks):**
- **Product detail → cart:** added `RapidSet Fast-Setting Cement` (stock 14) at requested quantity 20 — cart badge and cart page both show **14**, not 20; line total ₹11,130 = 14 × ₹795 (the 10+-unit 3% bulk tier applied to the clamped quantity, not the requested one).
- **Cart quantity change:** decremented 14 → 13 via the stepper; total and header badge recalculated live to ₹10,335.
- **Cart removal:** "Delete" on the only line correctly produced the designed empty-cart state ("Your cart is empty").
- **Checkout validation:** submitting with an empty new-address form produced all 5 expected field errors plus "Choose or add a delivery address"; filling valid values cleared them.
- **Preview order creation:** placed an order against a saved default address; a real `OrderPreview` was written to `localStorage` (`cw-orders`) with correct items/totals/address.
  - **Bug found and fixed during this exact test:** the first attempt landed back on `/cart` instead of `/thanks/{id}` — the empty-cart redirect guard raced the post-order cart-clearing against the navigation. The order itself was saved correctly (confirmed via `localStorage` inspection) but the confirmation page was never shown. Fixed with an `orderJustPlaced` ref that suppresses the guard once this component has placed an order; re-ran the full flow and it now lands on `/thanks/{id}` correctly every time.
- **Order history (`/orders`):** both placed orders listed, newest first, with correct totals.
- **Order detail and tracking (`/orders/[id]`):** 5-stage tracker rendered; "Simulate next update (demo)" advanced `Ordered → Packed` with a real timestamp; "Cancel order (preview)" (shown only because `stage < 2`) correctly set the order to "This order was cancelled" and removed the tracker/action buttons.
- **Thanks page:** confirmation copy, order card, and the explicit "Preview order — stored in this browser only; no payment was taken and nothing was reserved" disclosure all rendered correctly.

No real order creation, payment, or live inventory was claimed or implied anywhere in this verification — every screen that could be mistaken for a live transaction carries an explicit preview disclosure, unchanged from before this repair except where copy needed to reflect the new out-of-stock state.

---

## 8. Unresolved issues / explicitly out of scope

- TASK 5.2 (server-side order creation: real stock decrement in a transaction, server-side price recheck, per-seller shipment split) — not started, correctly deferred per D14.
- The two disconnected product-id namespaces (customer catalogue vs. seller mock products, `docs/CLAUDE_HANDOFF_AUDIT.md` §7) — unchanged, flagged as a standing architectural item for whenever D11 (real per-seller products) lands.
- Integration/e2e tests (D12's other two tiers) — still not implemented; `@playwright/test` remains installed but unconfigured beyond the default scaffold, intentionally reserved rather than built out in this pass.
- `TASKS.md`/`HANDOFF.md` — updated as part of this repair's own deliverables (see `HANDOFF.md`'s new checkpoint).
