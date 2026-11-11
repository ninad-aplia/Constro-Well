# Backend API Inventory

Ownership map across the hybrid Next.js/Prisma and FastAPI/SQLAlchemy backends.
FastAPI is the agreed target; Next.js endpoints remain during coexistence.

## Next.js API routes (Prisma-owned) — inventory

| Route | Owner | Status |
|---|---|---|
| `POST /api/auth/register|login|logout` | Next.js | COMPLETE (session.ts) |
| `GET /api/auth/me` | Next.js | COMPLETE; FastAPI equivalent exists |
| `GET/POST /api/addresses`, `PATCH/DELETE /api/addresses/[id]` | Next.js | COMPLETE |
| `GET/POST /api/cart`, `POST/PATCH/DELETE /api/cart/items*`, `POST/DELETE /api/cart/coupon` | Next.js | COMPLETE |
| `GET /api/categories` | Next.js→FastAPI facade | COMPLETE (delegates via `catalogDb.getCategories`) |
| `GET /api/products`, `/[id]`, `/[id]/offers` | Next.js | COMPLETE (FastAPI parity available) |
| `POST /api/checkout/preview` | Next.js | COMPLETE |
| `POST /api/orders`, `GET /api/orders`, `GET /api/orders/[id]`, `POST /api/orders/[id]/cancel` | Next.js | COMPLETE |
| `GET /api/driver/jobs*`, `accept`, `deliver`, `issue` | Next.js | COMPLETE |
| `GET /api/seller/*` (summary, products, orders+transitions, payments, performance, settings, delivery) | Next.js | COMPLETE (reads + writes) |
| `GET /api/health` | Next.js | COMPLETE |

**Missing Next routes:** reviews write, wishlist, notifications, KYC upload,
settlement/payout, admin write ops.

## FastAPI routes (SQLAlchemy) — inventory

| Route | Status |
|---|---|
| `GET /health`, `/health/db` | COMPLETE |
| `GET /api/auth/me` | COMPLETE (session-validation parity) |
| `GET /api/categories`, `/api/products*`, `/api/products/{id}/reviews`, `/rating` | COMPLETE (read) |
| `GET /api/admin/users` | COMPLETE |
| `GET /api/admin/sellers`, `/{id}`, `/{id}/exists` | COMPLETE |
| `GET /api/admin/orders`, `/{id}`, `/{id}/exists` | COMPLETE |
| `GET /api/admin/audit-events`, `/filters` | COMPLETE (filters 9.14) |
| `GET /api/admin/overview` | COMPLETE |

## Coexistence / duplication

- Catalogue reads: Next.js `catalogDb` can route through FastAPI
  (`FASTAPI_BASE_URL`) with Prisma fallback (`catalogSource.ts`). Reviews/rating
  likewise.
- Auth read: both implementations validate the shared `Session` table with
  identical SHA-256/bcrypt semantics; no duplicate schema.
- Business write logic (cart/checkout/orders/seller/driver) is **still entirely
  Next.js/Prisma** — not yet migrated, per the incremental plan.

## Recommended ownership (see roadmap)

Migrate the highest-risk correctness domains last; add net-new FastAPI features
(settlement job, KYC, notifications) natively in FastAPI rather than in Next.js,
consistent with the approved architecture.
