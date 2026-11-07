# Constro Well - application

Next.js (App Router, TypeScript) app serving the Customer, Seller and Delivery portals. See the repository root (`README.md`, `AGENTS.md`, `PROJECT_CONTEXT.md`, `TASKS.md`) for project rules and status.

> **Release status:** mock-data preview (D14). Portal pages and browser-local cart/checkout previews work; there is no authentication, no API layer and no live database access in the app runtime yet. Do not present it as a transactional marketplace.

## Quickstart (local)

```bash
npm install                      # from this directory
cp .env.example .env             # fill DATABASE_URL for Prisma commands
npm run db:migrate               # apply migrations (development)
npm run db:seed                  # optional demo data
npm run dev                      # http://localhost:3000
```

Use `npm run db:migrate:deploy` (not `db:migrate`) on a production database.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | dev server (Turbopack) |
| `npm run build` | production build |
| `npm run start` | serve the production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run db:migrate` | Prisma migrate (development) |
| `npm run db:migrate:deploy` | Prisma migrate (production) |
| `npm run db:seed` | demo seed data |
| `npm run db:studio` | Prisma Studio |

## Deployment

See `docs/CLIENT_DEPLOYMENT_READINESS.md` in the repository root for the full
pre-flight, hosting, migration, rollback and handover procedure. A production
image can be built from this directory:

```bash
docker build -t constro-well .
docker run --rm -p 3000:3000 constro-well
# health: curl -f http://localhost:3000/api/health
```

## Structure

- `src/app/` - routes: customer pages, `seller/`, `delivery/`, `api/health/`
- `src/components/{ui,home,product,cart,seller,delivery,layout}` - UI
- `src/lib/` - facades and business rules (`api/`, `shop/`, `seller/`, `delivery/`, `cart/`)
- `src/server/` - Prisma access (not yet used by routes)
- `prisma/` - schema + migrations + seed

Design tokens (colors, fonts, radii) are lifted from the approved storefront prototype - see `src/app/globals.css`.
