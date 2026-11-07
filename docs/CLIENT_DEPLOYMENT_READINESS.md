# Constro Well — Client Deployment Readiness

**Date:** 2026-11-07 · **Scope:** deployment audit, local release-blocker fixes, production configuration and handover preparation for the Customer, Seller and Delivery portals.

**Verdict: READY TO DEPLOY AS A GATED MOCK-DATA PREVIEW.** The production build is green, all 21 defined routes serve correctly, and the three portals were exercised in a real browser. The application is **not** a transactional marketplace: there is no authentication, no API layer and no live database access in the runtime. Do not expose it publicly as a commerce site and do not present preview orders, payments or deliveries as real transactions.

---

## 1. Current application status

| Area | Status | Evidence |
|---|---|---|
| TypeScript | PASS | `npx tsc --noEmit` exit 0 |
| ESLint | PASS | `npm run lint` exit 0, no warnings |
| Unit tests | PASS | `npm run test` — 61/61 across 6 files |
| Prisma schema | PASS | `npx prisma validate` — valid |
| Local database | PASS | `npx prisma migrate status` — 1 migration, “Database schema is up to date!” |
| Production build | PASS | clean `npm run build` — 23 pages generated, exit 0 (Turbopack) |
| Production server | PASS | `node .next/standalone/server.js` — health and all portal routes 200 |
| Customer Portal | WORKING PREVIEW | Home, search, product detail, cart, checkout validation, browser-local orders/tracking |
| Seller Portal | WORKING PREVIEW | Dashboard, orders, products, delivery setup, payments, performance, settings — in-memory demo state |
| Delivery Portal | WORKING PREVIEW | Jobs list, deep-linked job drawer, OTP/photo/quantity completion flow, history, settings |
| Authentication / authorization | **MISSING** | No login, session, role middleware or API exists (TASK 2.3/3.x not started) |
| Real order / payment / inventory | **MISSING** | COD-only rule exists in UI validation; no server-side order creation (TASK 5.2) |
| Database in app runtime | **NOT CONNECTED** | `src/server/db.ts` exists but no route imports it; portals run from mock data (D14) |
| Admin portal | **OUT OF SCOPE** | Separate product per D7; no `/admin` route |

Environment used for the evidence: Node v26.13.0, npm 11.20.0, Prisma 6.19.3, on Windows. The same tree previously built under WSL; always build on the target host or in the provided Docker image (see §7).

## 2. Release blockers

### Blocking deployment as a public, transactional store
1. **No authentication.** Anyone can open the Seller and Delivery portals and use their demo controls. Real login/session/role enforcement is TASK 2.3/3.x.
2. **No server-side order creation.** Checkout writes an order preview to the visitor's browser only; nothing is reserved, charged or sent to a seller (TASK 5.2).
3. **No live inventory or seller data.** Customer catalogue and Seller Hub use separate mock datasets (D11 unification not implemented).
4. **No payment integration.** COD-only is an approved rule, not an implemented payment flow (D3/D4, TASK 5.4).

These are approved D14 scope gaps, not regressions. They are why this release must be **access-restricted** and labelled as a preview.

### Must be resolved on the deployment host
5. **Build from a clean checkout/image.** A previously used `.next` cache served stale 404 responses for `/cart`, `/checkout` and `/orders` during this audit. A clean build fixed it. The Dockerfile always builds from a clean context; do not copy a developer’s `.next` directory to production.
6. **Production environment variables.** No secrets were available to, read by, or invented by this audit. `app/.env` is git-ignored. See §6.
7. **TLS and access control.** The app has no auth, so the host/reverse proxy must provide HTTPS plus an access gate (platform password protection, HTTP basic auth at the proxy, or an IP allowlist) for any non-local deployment.

### Non-blocking known issues
- `/product/9999` returns HTTP 200 with the correct “not found” UI in the production build (Next `cacheComponents` PPR behaviour); dev returns 404.
- `app/.github/workflows/playwright.yml` is not active: GitHub only reads workflows from the repository-root `.github/`, and `app/tests/example.spec.ts` is still the Playwright starter template. It has no effect on the build.
- Seed idempotency was **not** re-run in this audit to avoid mutating the existing local database.

## 3. Fixes completed in this pass

1. **Verified the whole tree green** — `tsc`, ESLint, Vitest (61/61), Prisma validate, clean production build. No TypeScript/lint/build errors were present at the start of this pass; the earlier cart/checkout breakage documented in `CLAUDE_HANDOFF_AUDIT.md` is already repaired.
2. **Diagnosed and eliminated a stale production-cache failure** — a reused `.next` directory served cached 404s for the newer customer routes. Clean build + clean `next start` serves all of them correctly.
3. **Added `output: "standalone"`** to `app/next.config.ts` so the Docker image ships only the runtime it needs.
4. **Added `GET /api/health`** (`app/src/app/api/health/route.ts`) returning `{"status":"ok","service":"constro-well"}`. It deliberately does not touch the database.
5. **Added production deployment files:** `app/Dockerfile` (multi-stage, non-root user, health check), `app/.dockerignore`, `app/docker-compose.yml`.
6. **Completed the environment template:** `app/.env.example` now also lists `DEMO_PASSWORD` (seed-only, name only, no value).
7. **Corrected stale documentation:** root `README.md` no longer claims “no application code exists”; `app/README.md` now documents real commands, production migration and Docker usage.
8. **Functional browser verification (real Chromium, production build):** home rendered all sections; product → add to cart → cart showed the line and subtotal; checkout rendered and rejected an empty address with field errors; Seller Hub rendered with demo disclosure; Delivery job drawer opened with demo OTP `6381`; entering OTP + photo + full quantity and confirming moved `BG-50231` out of the assigned list and showed “Delivered. Review window started.” Zero console errors on these pages.

No business rule, prototype HTML file, schema, migration or existing data was changed.

## 4. Production build results

```
$ npx tsc --noEmit                         → exit 0
$ npm run lint                             → exit 0 (0 problems)
$ npm run test                             → 6 files, 61 tests passed
$ npx prisma validate                      → schema valid
$ npx prisma migrate status                → up to date (1 migration)
$ npm run build                            → exit 0, 23/23 pages generated
$ node .next/standalone/server.js          → ready
$ curl /api/health                         → {"status":"ok","service":"constro-well"} 200
$ curl /,/cart,/checkout,/orders,/product/0,/seller,/delivery → all 200
```

Routes generated by the build: `/`, `/api/health`, `/cart`, `/checkout`, `/orders`, `/orders/[id]`, `/product/[id]`, `/thanks/[id]`, `/search`, `/seller` + 6 seller sub-routes, `/delivery` + 3 delivery sub-routes, `/_not-found`. `/admin` and `/login` intentionally 404.

## 5. Database hosting requirements

- **Today:** no production database is required to serve the portals — the runtime never queries Prisma. `prisma migrate status` currently succeeds against the owner’s local PostgreSQL (`127.0.0.1:5433`, database `constrowell`), but that instance is **not** reachable from a production host and must not be assumed to be.
- **When the API layer lands (TASK 2.3+):** provision a managed PostgreSQL 15+ database (any provider), set `DATABASE_URL`, and run `npx prisma migrate deploy` from a build/release step. Keep the database private; no direct public ingress.
- **Migrations are forward-only.** Never run `prisma migrate reset` or drop the schema in production. Take a provider snapshot before the first production migration and before any schema-changing release.
- **Seeding in production:** `npm run db:seed` creates demo accounts, products and orders. It is intended for demos only; do not run it against a client database containing real data unless the owner explicitly wants sample data. Seed idempotency is designed but was not re-executed in this audit.
- **No production migration or database change was performed by this audit** — owner approval is still required for that step.

## 6. Required environment variable names

Values are never committed and never printed here. Start from `app/.env.example`.

| Name | Required today? | Purpose |
|---|---|---|
| `DATABASE_URL` | No for page serving; Yes for any Prisma command | PostgreSQL connection string |
| `SESSION_SECRET` | No (auth not implemented) | Session-cookie signing secret for TASK 3.x |
| `DEMO_PASSWORD` | Only for `npm run db:seed` | Password for seeded demo accounts |
| `NODE_ENV` | Set by host/Dockerfile | `production` at runtime |
| `PORT` / `HOSTNAME` | Set by host/Dockerfile | Listen port / bind address (default 3000 / 0.0.0.0) |

If hosting without Docker, set `NODE_ENV=production` and `PORT` in the platform’s environment settings. There is no runtime secret the app reads today; do not paste real secrets into the repository or into documentation.

## 7. Recommended hosting architecture

**Simplest reliable option:** one Linux container running the Next.js server, behind the host’s HTTPS termination/proxy, with edge access control because authentication is absent.

```
Client ── HTTPS ──> Reverse proxy / platform edge (TLS + access gate)
                         │
                         └──> constro-well container (node server.js, port 3000)
                                  └── optional managed PostgreSQL (only once the API reads it)
```

- Use the provided `app/Dockerfile`. It builds with Node 22 Alpine, runs as a non-root user, and exposes a container health check on `/api/health`.
- Any container host works (managed container platform, a VPS with Docker, or a Node platform that runs `npm run build && npm start`). No provider, domain or credentials are assumed or invented here.
- **Do not use static hosting / CDN-only hosting** — the app uses server rendering, Server Actions and a partial-prerender runtime.
- Add **access protection at the platform/proxy** (password protection, basic auth or IP allowlist) before sharing the URL. Without it, anyone can use the Seller/Delivery demo controls.
- Postgres is not part of the current runtime. Add a managed database only when the API work starts; do not embed a database password in the image.

## 8. Deployment instructions

### Build and run the image
```bash
cd app
docker build -t constro-well:2026-11-07 .
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  constro-well:2026-11-07
```
Open `http://localhost:3000`. Health: `curl -f http://localhost:3000/api/health`.

### Or run with a Node toolchain (no Docker)
```bash
cd app
npm ci
npm run build
NODE_ENV=production npm start        # or: node .next/standalone/server.js
```

### Production database (only when the API needs it)
```bash
# one-time / each release, with a real DATABASE_URL supplied by the host
cd app
npx prisma migrate deploy
# optional demo data only, never against real client data:
# npm run db:seed
```

### Health check procedure
1. `curl -f https://<host>/api/health` → HTTP 200 with `{"status":"ok"...}`.
2. `curl -o /dev/null -s -w "%{http_code}" https://<host>/` → `200`.
3. Spot-check `https://<host>/seller` and `https://<host>/delivery` → `200`.
4. Check container logs for startup errors and render exceptions.
5. The health endpoint intentionally does not test PostgreSQL, so a green health check does not prove database connectivity.

### Rollback procedure
1. Redeploy the previous known-good image tag (keep every release tagged).
2. Verify `/api/health`, `/`, `/seller`, `/delivery` on the previous tag.
3. Database migrations are forward-only: restore the pre-release provider snapshot if a release changed the schema incompatibly. Never reset a production database.
4. Record the rollback reason and the release tag in `HANDOFF.md`.

### Pre-release gate (run every time)
```bash
cd app
npx tsc --noEmit
npm run lint
npm run test
npx prisma validate
npm run build
```

## 9. Known limitations

- **No authentication or authorization.** Seller and Delivery portals are open demo surfaces. Do not treat role separation as enforced.
- **No real transactions.** Checkout, orders, payments and delivery completions are browser-local previews; the Delivery state resets on reload (Seller/Delivery state is in-memory).
- **Two disconnected mock datasets.** Customer catalogue stock and Seller Hub products do not reference the same rows (D11 pending). Cart prices and stock come from the customer catalogue’s mock `stock` field.
- **No live inventory, payouts, escrow, SMS/OTP delivery or GPS.** Demo OTP `6381` is deterministic and labelled as such.
- **No admin portal** in this app (D7).
- **Preview disclosure is present**, but it is not a security boundary; access must be gated externally.
- `/product/9999` returns 200 with a not-found UI in production (PPR), not 404.
- Seed data exists in the local database only; production demo data requires an explicit seed run.
- Playwright e2e/API integration tests are not implemented (only Vitest unit tests); the workflow file in `app/.github/` is inactive.

## 10. Client handover checklist

**Deployment owner**
- [ ] Choose the host and provide its access/credentials (not in this repo).
- [ ] Confirm the release scope: **gated preview**, not a live marketplace.
- [ ] If a database is needed: provision managed PostgreSQL, set `DATABASE_URL`, approve `prisma migrate deploy`.
- [ ] Provide the production domain and TLS; enable platform/proxy access protection.
- [ ] Decide whether demo seed data is wanted in the client environment.
- [ ] Approve the push/commit of the current working tree (everything is still uncommitted).

**Deployer**
- [ ] Build from a clean checkout or the provided Dockerfile (never copy `.next`).
- [ ] Run the pre-release gate in §8; record real output.
- [ ] Deploy one tagged image; set only the environment variables listed in §6.
- [ ] Verify health, home, Customer cart/checkout, Seller and Delivery in the deployed environment.
- [ ] Confirm the preview disclosure is visible on Seller and Delivery pages.
- [ ] Record the deployed URL, image tag, date and verifier in `HANDOFF.md`.

**Client acceptance**
- [ ] Understand that no payment is taken and no order reaches a seller.
- [ ] Confirm the access gate is active and the URL is not public.
- [ ] Sign off the three portals against the agreed demo scope.
- [ ] Accept the known limitations in §9 in writing.
- [ ] Receive credentials/host access, this document and the rollback procedure.

---

### Files added or changed for deployment
- `app/next.config.ts` — `output: "standalone"`.
- `app/src/app/api/health/route.ts` — health endpoint.
- `app/Dockerfile`, `app/.dockerignore`, `app/docker-compose.yml` — production container.
- `app/.env.example` — added name-only `DEMO_PASSWORD`.
- `README.md`, `app/README.md` — corrected setup/status text.

Nothing was deployed, pushed, migrated in production, or committed by this pass. `.env` values were not read or exposed.
