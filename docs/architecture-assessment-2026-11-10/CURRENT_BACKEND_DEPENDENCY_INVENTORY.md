# CURRENT_BACKEND_DEPENDENCY_INVENTORY.md

Phase 02 — Deliverable 2 of 10. All findings VERIFIED by direct code reading this phase (fresh, not carried over from Phase 01 without re-confirmation), via three independent research passes plus direct spot-checks.

## 1. The central finding: backend capability is NOT fully enumerated by the 39 API routes

Phase 01's 39-route inventory is accurate for what it covers, but **it is not the complete backend surface**. Confirmed this phase, by direct code reading: a meaningful share of this application's server-side Prisma access happens **inside Server Components and one Server Action, with zero `/api/` hop** — these must be accounted for separately in the migration, because "repoint the frontend's `fetch` calls at FastAPI" does not touch them; they need their *data-fetching code itself* rewritten (from a direct service-layer import to an HTTP call), which is a qualitatively different, slightly larger task than most of the 39-route migration.

### 1a. Customer catalog pages — zero API hops today (VERIFIED)
- `src/app/product/[id]/page.tsx:29-37,51,54-61` — imports `getBulkTiers, getFrequentlyBoughtTogether, getProductById, getProductReviews, getRatingBreakdown, getSellerOffers, getSimilarProducts` from `@/lib/api/catalogDb`, calls them directly in the Server Component body.
- `src/app/search/page.tsx:14,71` — imports and calls `searchProducts` from `@/lib/api/catalogDb` directly.
- `src/components/home/TodaysDealsRow.tsx:2,5`, `BestSellersRow.tsx:2,5`, `FinishingTouchesRow.tsx:2,5`, `DealTiles.tsx:8,11` — each a Server Component calling a `catalogDb.ts` function directly.
- All of the above route through `src/lib/api/catalogDb.ts` → `src/server/catalog/service.ts` → Prisma (`db` singleton).

**Migration implication**: there is no existing `/api/products`-style route for FastAPI to simply "take over" here in the way a route-for-route swap works elsewhere — `GET /api/products`/`GET /api/products/[id]` **do exist** (Phase 01's inventory, re-confirmed this phase) and have equivalent data, but these specific pages don't call them; they bypass straight to the service layer. The migration must either (a) rewrite these 6 files to `fetch()` the existing (or FastAPI-replaced) `/api/products*` endpoints instead of importing `catalogDb.ts`, or (b) keep these particular Server Components reading from a thin Prisma (or SQLAlchemy, via a Python-to-TS bridge — not recommended, see Deliverable 7) layer indefinitely. **Recommendation: (a)** — converting these to real `fetch` calls against the already-existing `/api/products*` contract is low-risk, independently useful even before any FastAPI work begins (it makes the catalog domain's actual API surface consistent, closing exactly the kind of "mid-migration" seam Phase 01's own frontend audit flagged as a code-quality issue), and is a prerequisite for ever letting FastAPI serve this domain.

### 1b. Portal layout gating — duplicated logic, not just duplicated routes (VERIFIED)
- `src/app/seller/layout.tsx:26,30,35` — calls `getCurrentUser()` → `resolveSellerForUser()` → `sellerSummary()` directly, to decide the redirect/access-notice/render branch **before** any child page renders, and to seed `SellerLiveProvider`'s initial state. This exact chain is independently exposed via `GET /api/auth/me` + the seller's own `resolveSellerForUser` inside `requireSeller` + `GET /api/seller/summary` — **but the layout does not call those routes; it imports the service functions in-process.**
- `src/app/delivery/layout.tsx:19,23,26` — identical pattern: `getCurrentUser()` → `resolveDriverForUser()` → `listDriverJobs()`.
- `src/app/login/page.tsx:18`, `src/app/register/page.tsx:18` — both call `getCurrentUser()` directly (to redirect an already-authenticated visitor away from the login/register form).

**Migration implication**: this is the SSR-gating pattern Next.js Server Components are specifically good at (blocking redirect decided before any HTML streams, no client-side flash of a wrong page) — this phase's own instruction says "Server Components access migrated backend data," which is exactly what should happen here: once identity/seller/driver resolution lives in FastAPI, these four files change from "import the TypeScript service function" to "await an HTTP call to FastAPI's `/me`, `/seller/summary`, `/driver/jobs` equivalents" — the SSR-gating *pattern* is fully preserved, only the data source changes from in-process to HTTP. This is a real, necessary code change in the frontend (not a backend-only migration step), and should be scoped as such in Deliverable 9.

### 1c. One live Server Action with real DB access (VERIFIED)
`src/lib/api/recentlyViewedAction.ts` (file-level `"use server"`) exports `getRecentlyViewedCards`, called from `src/components/home/RecentlyViewedRow.tsx`'s `useEffect`, which reads real product data via `catalogDb.ts` → Prisma. (A second `"use server"` file, `src/lib/api/cart.ts`, is confirmed **mock-data-only** — it operates on `@/data/catalog`'s static arrays, not Prisma, and is a known-dead/legacy path per Phase 01's own dead-code finding; no migration action needed for it beyond the cleanup already recommended in Phase 01's roadmap.)

### 1d. Confirmed: no other direct Prisma/`db`-singleton imports anywhere in `src/components/**` or `src/app/**` outside the above (VERIFIED by grep this phase — zero additional hits for `new PrismaClient` or `from "@/server/db"` outside `src/server/**`, `src/app/api/**`, and test files).

## 2. Full service-function-to-caller map (VERIFIED this phase)

| Service function (file) | Via API route | Via Server Component/Layout/Action directly |
|---|---|---|
| Auth (`auth/current.ts`, `auth/session.ts`) | `auth/login,register,logout,me` and every `requireX()` gate | `login/page.tsx`, `register/page.tsx`, `seller/layout.tsx`, `delivery/layout.tsx` |
| Catalog (`catalog/service.ts`: `listCategories`, `listProducts`, `getProductById`, `listProductOffers`, `getProductSummariesByCodes`, `listProductReviews`, `getReviewHistogram`) | `categories`, `products`, `products/[id]`, `products/[id]/offers` | **Yes** — via `catalogDb.ts`, from `product/[id]/page.tsx`, `search/page.tsx`, 4 home-row components, and `recentlyViewedAction.ts` |
| Cart (`cart/service.ts`, `cart/pricing.ts`) | `cart`, `cart/items*`, `cart/coupon` | No |
| Addresses (`orders/addresses.ts`) | `addresses`, `addresses/[id]` | No (one internal-only helper, `getAddress`, used by `orders/service.ts` only) |
| Orders (`orders/service.ts`) | `checkout/preview`, `orders`, `orders/[id]`, `orders/[id]/cancel` | No |
| Driver (`orders/driverService.ts`) | all `api/driver/jobs*` | **Yes** — `listDriverJobs` also from `delivery/layout.tsx` |
| Seller orders/summary/payments/performance (`orders/sellerService.ts`) | all `api/seller/*` (orders, payments, performance, summary) | **Yes** — `sellerSummary` also from `seller/layout.tsx` |
| Seller delivery settings (`seller/delivery.ts`) | `seller/delivery`, `seller/delivery/service-areas` | No |
| Seller inventory (`seller/inventory.ts`) | `seller/products*` | No |
| Seller profile (`seller/profile.ts`) | `seller/settings` | No |
| Lifecycle helpers (`orders/lifecycle.ts`: `refreshOrderStage`, `restoreReservedStock`, `refundHeldEscrow`) | Internal only (called by `sellerService.ts`/`service.ts`) | No |
| OTP crypto (`security/otp.ts`) | Internal only | No |
| HTTP helpers (`http.ts`) | Every route | No (pure helper layer, no DB) |

**No service function was found with zero live caller** (i.e., dead-but-present backend logic) — every function above is reachable from at least one real entry point.

## 3. External dependencies (re-confirmed unchanged from Phase 01, zero new findings)
No file storage/upload SDK, no background-job/queue library, no email/SMS provider integration anywhere in the dependency tree (`package.json` re-checked this phase: unchanged from Phase 01's read — `@prisma/client`, `bcryptjs`, `next`, `react`, `react-dom`, `zod` as runtime deps; `@playwright/test`, `@tailwindcss/postcss`, `eslint`+`eslint-config-next`, `jsdom`, `prisma`, `tailwindcss`, `tsx`, `typescript`, `vitest` as dev deps — nothing added or removed since Phase 01).

## 4. Transaction/concurrency/financial dependencies
See `DATABASE_AND_ORM_MIGRATION_PLAN.md` §3-§7 for the complete, freshly-re-derived inventory of every `$transaction` block, every row lock, every conditional-update concurrency guard, the idempotency-key mechanism, and the two Decimal-precision exceptions found this phase — not duplicated here to avoid drift between documents.

## 5. Existing tests, mapped to the above (re-confirmed from Phase 01, unchanged — 19 Vitest files, DB-gated suites via `describe.skipIf(!hasDb)`, zero real Playwright coverage, no CI that actually runs). See Phase 01's `CURRENT_ARCHITECTURE_AUDIT.md §5` for the full breakdown; this phase found no change to that inventory (HEAD unchanged).
