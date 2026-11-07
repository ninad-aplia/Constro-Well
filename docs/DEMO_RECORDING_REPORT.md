# Demo Recording Report — Constro Well (Three Portals)

**Date:** 2026-11-07 · **Recorded by:** OpenCode (GLM-5.3-Flash) · **Method:** real Chromium (Playwright 1.65.0, headed via WSLg) with Playwright `recordVideo` — genuine browser interaction, no stitched screenshots, no synthetic frames.

**Recordings (in `artifacts/demo-recordings/`):**

| File | Portal | Duration | Resolution | FPS | Size |
|---|---|---|---|---|---|
| `01-customer-portal.webm` | Customer | 00:00:55.12 | 1920×1080 (VP9) | 25 fps (Playwright screencast standard; 30 fps not settable via this API) | 12.4 MB |
| `02-seller-portal.webm` | Seller | 00:00:40.36 | 1920×1080 (VP9) | 25 fps | 8.2 MB |
| `03-delivery-portal.webm` | Delivery | 00:00:40.92 | 1920×1080 (VP9) | 25 fps | 5.1 MB |

Pacing used throughout: ~900 ms between actions, 1.8 s holds after important interactions, 2.6 s after navigations, wheel-scrolling in 200–260 px increments with pauses.

## Playback verification (all three)

- `ffmpeg` (Playwright's bundled binary) probe → duration, bitrate and `1920x1080 vp9` stream confirmed for each file (values above).
- Frames decoded from each recording at multiple timestamps and visually inspected by the recording agent:
  - `01` @ ~30 s shows the search page with category sidebar and the Interior Design "No results found / Try fewer filters…" empty state.
  - `02` @ ~15 s shows the Seller Hub orders table (16 `BG-50xxxx` orders with statuses To dispatch / Packed / On the road / In review / Disputed / Paid).
  - `03` @ ~12 s shows the `BG-50231` shipment drawer (delivery OTP input, photo upload, quantity delivered, "Confirm delivery", "Customer not available") and @ ~22 s the delivery history with All/In review/Disputed/Paid filters.
- All uploads/modifications: none — recordings only navigate, scroll, and open read-only dialogs/drawers; Escape/cancel used to close.

## 01 Customer Portal — actions performed

1. Homepage entry `/` — slow scroll through hero carousel, "Shop by category", Today's deals, Bulk saver, sign-in tile, Best sellers, Finishing touches.
2. Search — typed "cement" into the site header search (`input[name=q]`, slow 300 ms-per-key typing) and submitted → results page.
3. Scroll through results; browsed filter sidebar.
4. Category filter navigation — "Doors and windows" category results page.
5. Deliberate empty state — `/search?cat=Interior Design` → "No results found" with "Clear filters" (designed empty state, D15).
6. Product detail `/product/0` — scrolled specs, buy box shown; **quantity stepper interaction: +3 then −3** at ~1 s per step, visibly updating the bulk-price tier ("Bulk price applied: 3% off" at qty 10).
7. Returned home.

**Demonstrated successfully:** catalogue, search, category filters, empty state, product detail incl. FBT/sellers/reviews page areas, quantity/bulk pricing interaction, sign-in tile, preview-disclaimer banners.

**Unavailable / mocked (visible in the video as disabled controls, not hidden):**
- Login/registration — **no login route in this build** (`/login`, `/register` are 404). The homepage "Sign in for the best experience" tile is shown; auth is a future phase.
- Cart — **not implemented**: "Add to cart", "Buy now", "Add to wish list" are disabled buttons; checkout, coupon entry and order history/tracking do not exist yet. Recordings show the disabled state and the "Sample listing for preview — not a live offer" notice; **no order or payment was attempted.**

## 02 Seller Portal — actions performed

1. Entry `/seller` (Overview: dashboard metric cards + SalesChart), slow scroll.
2. `/seller/products` — inventory list + low-stock badges scroll.
3. Add-product dialog opened from the "Add product" affordance to show the form, then **closed via Escape — nothing saved** (mock-only store; no business data altered).
4. `/seller/orders` — full orders table scroll; one order row clicked and its details drawer held on screen (~2 s hold ×2) — **Accept/Reject/Dispatch buttons NOT clicked**; drawer closed with Escape.
5. `/seller/delivery` — shipment handoff interface shown (no dispatch performed).
6. `/seller/payments`, `/seller/performance`, `/seller/settings` — browsed.

**Demonstrated successfully:** dashboard, product/inventory view, incoming orders, order details drawer, order-status vocabulary (To dispatch → Packed → Dispatched → Delivered in review → Disputed → Paid as visible data), handoff screen, payments/performance/settings.

**Unavailable / mocked:** all state transitions (accept/reject/dispatch), product create/edit save, withdrawals — mock-preview only per D14; the in-app "Sample data — not live" PreviewDisclosure is visible in the recording. No persistent state was modified.

## 03 Delivery Portal — actions performed

1. Entry `/delivery` (Overview), slow scroll; "Delivery preview — Sample driver workflow, not a live tracking app" banner is on screen.
2. `/delivery/jobs` — assigned shipments list (BG-50231, BG-50229 with vehicle/driver details).
3. Shipment drawer via deep link `/delivery/jobs?open=BG-50231` — full drawer held ~3.5 s ×2: delivery-OTP step (with the clearly labelled *"Demo OTP for this preview: 6381 — shown here since order tracking isn't built yet"*), photo-of-unloaded-goods (demo), quantity-delivered field, "Confirm delivery" and "Customer not available" buttons. **The completion form was NOT submitted — no delivery was fabricated.** Drawer closed with Escape.
4. `/delivery/history` — completed-shipment list; dispute view `/delivery/history?filter=disputed`; `/delivery/settings` browsed.

**Demonstrated successfully:** driver overview, assigned jobs, shipment details (pickup/drop-off/vehicle/driver/documents), status interface, completion + issue-reporting UI, history + filters.

**Unavailable:** real OTP verification, GPS tracking, live events, persistence — preview only (stated on-screen throughout the recording); backend delivery completion doesn't exist in this build.

## Failed interactions / deviations

- First recording attempt (v1 script) split each walkthrough across per-page video files; **corrected and re-recorded** in full — v1 outputs deleted, deliverables above are from the single-page-per-context v2 run.
- Chromium initially failed to launch on this WSL box (missing system libraries `libnspr4/libnss3/libasound2`); resolved by unpacking those three Ubuntu debs to a temp dir and launching with `LD_LIBRARY_PATH` pointing there. The repo, `node_modules`, and lockfile were untouched; temp files removed afterwards.
- None of the requested walkthrough steps were skipped wrongfully: every unavailable feature above is deliberately shown in its disabled/preview state and reported here.

## Tooling notes

- Recording scripts were temporary (`app/.tmp-demo-record.mjs`, deleted after use). No application code, `package.json`, or schema file was modified for this task; nothing committed, pushed or deployed.
- Only already-installed `@playwright/test` 1.65.0 dependency + Chromium browser binaries downloaded to `~/.cache/ms-playwright` (outside the repo) were used.
- The target app was the already-running dev server on `http://localhost:3000` (owner-started; reused, not restarted).
- No credentials, secrets or environment variables appear in any recording (none exist in the app UI).
