# SCREENSHOT_EVIDENCE_INDEX.md

Phase 04A — Deliverable 11 of 11. Every image below was captured during this audit from the **running application** (`http://localhost:64704`, Next.js dev server, local PostgreSQL at `127.0.0.1:5433`) or from the **four prototype HTML files loaded directly in Chromium** (`file:///.../buildgrid-*.html`). No screenshot is illustrative, reconstructed, or copied from earlier phases.

## Capture method (reproducible)

- Engine: Playwright 1.65.0 (already a dev dependency of `app/`), Chromium, `deviceScaleFactor: 1`, `colorScheme: "light"` (prototypes are light-first; dark mode is audited separately in `RESPONSIVE_AND_ACCESSIBILITY_AUDIT.md`).
- Viewports: **1440×900** (desktop), **1024×768** (small desktop/tablet), **390×844** (mobile).
- Desktop captures are full-page (`fullPage: true`); mobile comparison captures are viewport-only (`evidence/viewport/`) because full-page mobile images exceed 7,000 px in height.
- Prototype screen switching was driven through each prototype's own router (`location.hash` for the shop, `data-act`/`data-p` handlers for seller/admin/delivery), so each capture is the prototype's real rendered state for that screen, not a different file.
- Temporary capture scripts lived at `app/.scratch-*.mjs` and were **deleted** after use (see final Git verification — `git status` shows no trace of them).
- Machine-readable manifests: `evidence/capture-manifest.json` (desktop + driver) and `evidence/capture-manifest-mobile.json` (mobile/tablet).

> **Correction (this pass).** The seller entries in `capture-manifest-mobile.json` record URLs of `/login?next=/seller` — that run was not authenticated, so the original mobile seller images were sign-in pages, not seller screens. All seven seller screens were **re-captured authenticated** at 390×844 and 1024×768 (`imran.shaikh@demo.constrowell.test`, viewport-only at 390 and full-page at 1024) and the images replaced in place. Read the manifest's seller-mobile URLs as **superseded**; the images are correct. This also added `app-seller-orders-390x844.png` and `app-seller-orders-1024x768.png`, which did not previously exist.

## A. Prototype reference captures (all four portals)

| Portal | View | File | Lines in source |
|---|---|---|---|
| Customer | home | `evidence/proto-shop-home-1440x900.png` | `buildgrid-shop.html:167-190, 400-415` |
| Customer | search | `evidence/proto-shop-search-1440x900.png` | `buildgrid-shop.html` VIEWS_search |
| Customer | product 1 | `evidence/proto-shop-product-1-1440x900.png` | `buildgrid-shop.html:484-497` |
| Customer | cart | `evidence/proto-shop-cart-1440x900.png` | VIEWS_cart |
| Customer | wishlist | `evidence/proto-shop-wishlist-1440x900.png` | VIEWS_wishlist |
| Customer | account | `evidence/proto-shop-account-1440x900.png` | VIEWS_account |
| Customer | orders | `evidence/proto-shop-orders-1440x900.png` | VIEWS_orders |
| Seller | overview | `evidence/proto-seller-overview-1440x900.png` | `buildgrid-seller-dashboard.html:318-341` |
| Seller | orders | `evidence/proto-seller-orders-1440x900.png` | `:346-354` |
| Seller | products | `evidence/proto-seller-products-1440x900.png` | `:356-364` |
| Seller | delivery | `evidence/proto-seller-delivery-1440x900.png` | `:366-371` |
| Seller | payments | `evidence/proto-seller-payments-1440x900.png` | `:373-378` |
| Seller | performance | `evidence/proto-seller-performance-1440x900.png` | `:380-386` |
| Seller | settings | `evidence/proto-seller-settings-1440x900.png` | `:388-393` |
| Delivery | flow (how it works) | `evidence/proto-delivery-flow-1440x900.png` | `buildgrid-delivery-workflow.html:348-354` |
| Delivery | customer tab | `evidence/proto-delivery-customer-1440x900.png` | `:287-304` |
| Delivery | vendor tab | `evidence/proto-delivery-vendor-1440x900.png` | `:306-313` |
| Delivery | **driver app** | `evidence/proto-delivery-driver-1440x900.png` | `:315-332` |
| Delivery | admin tab | `evidence/proto-delivery-admin-1440x900.png` | `:334-346` |
| Admin | overview | `evidence/proto-admin-overview-1440x900.png` | `buildgrid-platform-admin.html:343-367` |
| Admin | approvals | `evidence/proto-admin-approvals-1440x900.png` | `:369-384` |
| Admin | deliveries | `evidence/proto-admin-deliveries-1440x900.png` | `:386-395` |
| Admin | payouts | `evidence/proto-admin-payouts-1440x900.png` | `:397-404` |
| Admin | sellers | `evidence/proto-admin-vendors-1440x900.png` | `:406-413` |
| Admin | users | `evidence/proto-admin-users-1440x900.png` | `:415-422` |
| Admin | activity log | `evidence/proto-admin-log-1440x900.png` | `:424-428` |
| Admin | settings | `evidence/proto-admin-settings-1440x900.png` | `:430-436` |

Mobile (390×844) reference captures exist for all four portals, e.g. `evidence/proto-shop-home-390x844.png`, `evidence/proto-seller-overview-390x844.png`, `evidence/proto-delivery-driver-390x844.png`, `evidence/proto-admin-overview-390x844.png`, plus `evidence/viewport/proto-shop-home-390.png`, `evidence/viewport/proto-seller-overview-390.png`, `evidence/viewport/proto-delivery-driver-390.png`.

## B. Current application captures

| Portal | Screen | File |
|---|---|---|
| Customer | home | `evidence/app-customer-home-1440x900.png` |
| Customer | search | `evidence/app-customer-search-1440x900.png` |
| Customer | product detail | `evidence/app-customer-product-1440x900.png` |
| Customer | cart (guest) | `evidence/app-customer-cart-1440x900.png` (renders sign-in) |
| Customer | cart (authenticated) | `evidence/app-customer-cart-auth-1440x900.png` |
| Customer | checkout (guest) | `evidence/app-customer-checkout-guest-1440x900.png` |
| Customer | orders (guest) | `evidence/app-customer-orders-guest-1440x900.png` |
| Customer | orders (authenticated) | `evidence/app-customer-orders-auth-1440x900.png` |
| Seller | overview | `evidence/app-seller-overview-1440x900.png` |
| Seller | orders | `evidence/app-seller-orders-1440x900.png` |
| Seller | products | `evidence/app-seller-products-1440x900.png` |
| Seller | add-listing dialog | `evidence/app-seller-add-listing-dialog-1440x900.png` |
| Seller | delivery setup | `evidence/app-seller-delivery-1440x900.png` |
| Seller | payments | `evidence/app-seller-payments-1440x900.png` |
| Seller | performance | `evidence/app-seller-performance-1440x900.png` |
| Seller | settings | `evidence/app-seller-settings-1440x900.png` |
| Delivery | overview | `evidence/app-delivery-home-driver.png` + `evidence/app-delivery-home-1440x900.png` |
| Delivery | assigned deliveries | `evidence/app-delivery-jobs-driver.png` |
| Delivery | OTP / proof-of-delivery drawer | `evidence/app-delivery-complete-dialog-1440x900.png` |
| Delivery | history | `evidence/app-delivery-history-driver.png` |
| Delivery | settings | `evidence/app-delivery-settings-driver.png` |
| Admin | route attempt `/admin` | `evidence/app-admin-route-1440x900.png` (HTTP 404) |

Mobile/tablet app captures: `evidence/app-customer-home-390x844.png`, `app-customer-search-390x844.png`, `app-customer-home-1024x768.png`, plus viewport-only `evidence/viewport/app-customer-home-390.png` and `evidence/viewport/app-delivery-jobs-390.png`.

**Authenticated seller set (390×844 and 1024×768)** — all seven screens, re-captured this phase:
`app-seller-overview-{390x844,1024x768}.png` · `app-seller-orders-{390x844,1024x768}.png` · `app-seller-products-{390x844,1024x768}.png` · `app-seller-delivery-{390x844,1024x768}.png` · `app-seller-payments-{390x844,1024x768}.png` · `app-seller-performance-{390x844,1024x768}.png` · `app-seller-settings-{390x844,1024x768}.png`.

`evidence/thumbs/` contains downscaled 1000-px-wide derivatives of the full-page captures, created solely because the review tooling cannot open images above 768 KB. The originals remain the evidence of record.

## C. What these captures do NOT prove

- They are rendered-state evidence, not proof that a control persists its change. Persistence is established separately in `DATA_AND_BACKEND_DEPENDENCY_MATRIX.md` by tracing the handler/API/Prisma path, not by mutating data during this read-only audit.
- No screenshot was taken of a completed checkout, an order-confirmation page, or a seller dispatch/accept transition, because each would require writing to the shared local database. Those screens are classified **PARTIALLY VERIFIED** in the registers, never as verified working.
- The screens listed as uninspected in each register were not captured for that reason; they are not silently omitted.
- No automated accessibility scan or screen-reader pass was performed; contrast figures in `RESPONSIVE_AND_ACCESSIBILITY_AUDIT.md` are computed from token hex values, not measured from these images.
