# Evidence Register

Everything below is **VERIFIED by this session's direct inspection** unless marked
otherwise. Unverified claims are explicitly flagged.

## Source code inspected (this and prior sessions)

- `app/prisma/schema.prisma` — full model + enum inventory (VERIFIED).
- `app/prisma/migrations/` — 3 migrations incl. `20261110201000_add_audit_event`
  (VERIFIED applied to local DB; append-only triggers VERIFIED).
- `app/src/server/{auth,cart,catalog,orders,seller,security}/**` — services and
  tests (VERIFIED).
- `app/src/app/api/**` — complete route inventory (VERIFIED, listed in
  `BACKEND_API_INVENTORY.md`).
- `app/src/app/**` — portal pages/layouts (VERIFIED).
- `backend/fastapi_app/**` — routers, services, schemas, models, tests (VERIFIED).
- `app/src/proxy.ts`, `app/src/lib/api/{adminApi,catalogSource}.ts`,
  `app/src/lib/admin/**` (VERIFIED).

## Test evidence (executed this session)

- FastAPI pytest: **157/157** across domains incl. admin (9.6–9.14).
- Next.js Vitest: **158/158** across 27 files.
- `tsc --noEmit`, full ESLint, `npm run build`, `git diff --check` — all clean.
- DB-gated tests run against local PostgreSQL; isolated transaction/savepoint
  fixtures; zero test residue after each run (VERIFIED).

## Browser/HTTP verification (executed this session)

- Admin pages (Overview/Users/Sellers/Seller-detail/Orders/Order-detail/Activity
  + filters) via Playwright desktop 1440 & mobile 390, plus HTTP smoke; guest/
  customer/backend-down states verified (VERIFIED).
- Catalogue/auth/reviews FastAPI parity verified against live Next.js API
  (VERIFIED, `backend/tests/catalog/test_contract_equivalence.py`).

## Reports reused (not re-audited)

- `docs/ui-fidelity-audit-2026-11-10/` — 11 deliverables + 130 evidence images.
- `docs/architecture-assessment-2026-11-10/` — migration roadmap, auth plan,
  DB/ORM plan, workflow plan.
- `docs/AUDIT_EVENT_DESIGN.md` — append-only design + limits.

## Unverified / not inspected in this pass

- Load/performance characteristics under concurrency (no benchmark run).
- Production deployment configuration and any third-party credentials (none exist
  in this environment).
- Exact commission/penalty business rates (no source establishes them — flagged
  as owner decisions).
- Behavior of the inert `app/.github/workflows/playwright.yml` (not executed).
