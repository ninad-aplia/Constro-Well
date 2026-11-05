# Constro Well — application

Next.js (App Router, TypeScript) full-stack app. See the repository root (`README.md`, `AGENTS.md`, `PROJECT_CONTEXT.md`, `TASKS.md`) for project rules and status.

## Quickstart (local)

```bash
npm install                      # from this directory
cp .env.example .env             # placeholders — fill in real values, never commit .env
npm run db:migrate & npm run db:seed   # these arrive with TASK 2.1/2.2; ignore until then
npm run dev                      # http://localhost:3000
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | dev server (Turbopack) |
| `npm run build` | production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (added in TASK 2.4) |
| `npm run db:migrate` | Prisma migrate (added in TASK 2.1) |

## Structure (as approved in docs/ARCHITECTURE_PROPOSAL.md §4)

- `src/app/` — routes: `(storefront)`, later `seller/`, `driver/`, `admin/`, `api/v1/`
- `src/components/{ui,shop,seller,delivery}` — shared UI, no business logic
- `src/server/services/` — all business logic (pricing, orders, shipments, payouts)
- `src/lib/` — db, auth, validation, formatting helpers
- `prisma/` — schema + migrations (TASK 2.1)

Design tokens (colors, fonts, radii) are lifted from the approved storefront prototype — see `src/app/globals.css`.
