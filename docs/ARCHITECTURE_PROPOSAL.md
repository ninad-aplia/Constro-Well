# ARCHITECTURE_PROPOSAL.md

Status: **PROPOSED — awaiting user approval on D2, D3/D4, D10** before any scaffolding.

## 1. Recommended stack (and why)

| Layer | Choice | Why (48-hour lens) |
|---|---|---|
| Frontend + backend | **Next.js (App Router) + TypeScript, one repo/app** | The three prototypes are vanilla-JS SPAs; React components port them fastest. One language, one deploy, one repo = least handoff friction for multi-IDE work. User is familiar with JS/React/Next. |
| DB | **PostgreSQL + Prisma** | Migrations are a hard requirement; Prisma gives schema + migration + typed client fastest. User knows Postgres. |
| Auth | **Server-side session cookie + bcrypt (argon2 acceptable)**, sessions table, no OAuth | Only credentials.auth is needed; an external auth package adds config overhead and hides the role model we must enforce ourselves. Fastest correct thing: short hand-rolled session middleware (~100 lines, fully ownable). |
| Styling | **Tailwind CSS**, tokens lifted from prototypes (palette, radii, pills) | Prototypes are CSS-variable based; a token-for-token Tailwind config preserves the look with no bespoke design work. (Fallback: keep CSS custom-props as-is.) |
| Validation | **Zod** shared on API boundaries | Tiny dependency; prevents re-writing the prototypes' regex catalog repeatedly, and the backend needs schema-quality validation anyway. |
| Testing | **Vitest** (+ integration tests around order/shipment/payout state machine and auth), optional Playwright smoke if time remains | The risk in this project is money-state logic, not pixels. Prototype's rules already define expected outputs — they convert directly into assertions (e.g. `payFor` math, bulk tiers, coupon thresholds). |
| Runtime schedule-ish bits | **DB polling/interval endpoint skipped** — use on-read state evaluation + a background job in dev server (`node-cron`-style or a scheduled route), decided during Phase 7 | Deadline timers (accept 4 h / dispatch 24 h / review 24 h) must not depend on a browser being open, unlike prototypes. |

Rejected alternatives (recorded for the log): **Spring Boot API + separate frontend** — second deploy target + two languages over 3 frontal surfaces; slowest path to a coherent demo. **Python/FastAPI** — user's JS/Next familiarity is stronger. **Supabase-only (no backend code)** — role authorization would live in RLS policies, harder to audit quickly and contradicts the "role auth in backend" rule.

## 2. System composition
```
Browser
  ├─ Storefront (customer)
  ├─ Seller Hub
  ├─ Driver view (mobile-first page)
  └─ Admin stopgap console
        │  REST /api/v1 (JSON, session cookie, role middleware)
        ▼
Next.js server (api routes / server actions)
  ├─ domain services: catalog, cart, orders, shipments, payouts, admin
  └─ validation + authorization (Zod + role checks)
        ▼
PostgreSQL (Prisma schema + migrations, seeded fixtures)
```
One monolith by design; no queues, no microservices. Background timers wrapped in a single module so phase 7 can swap polling to a worker without touching domain code.

## 3. Data model consolidation (resolves prototype gaps — see `docs/PROTOTYPE_AUDIT.md` §6)
- `Product` belongs to a concrete `Seller` (`sellerId`), real offers, per-product `stock` owned by that seller.
- `Order (customer, address/pymt/totals snapshot)` → `OrderLine` → `Shipment` (one per seller; the order's tracker aggregates shipment states — master status = worst/leading shipment state).
- **Stock discipline**: reserve at `accept`, release on reject/timeout/cancel, decrement finally at `dispatch`. Shop-side "add to cart" validates against stock but does not lock it (prototype parity; a real-time lock is deferred).
- All money as integer paise; totals only in `src/server/services/*` — never on the client.
- Entities list: `PROJECT_CONTEXT.md` §7 is authoritative; schema built in TASK 2.1.

## 4. Proposed directory structure
```
/
├─ AGENTS.md  PROJECT_CONTEXT.md  TASKS.md  HANDOFF.md  DECISIONS.md  README.md   ← existing
├─ buildgrid-shop.html  buildgrid-seller-dashboard.html  buildgrid-delivery-workflow.html
├─ docs/
│   ├─ PROTOTYPE_AUDIT.md / ARCHITECTURE_PROPOSAL.md
│   └─ diagrams, setup docs (deployment.md added in phase 8)
└─ app/                        ← Next.js TS app (name confirmed at TASK 1.1)
    ├─ package.json  next.config.*  tailwind.config.*  .env.example
    ├─ prisma/{schema.prisma, migrations/, seed.ts}
    ├─ src/
    │   ├─ app/
    │   │   ├─ (storefront)/   page.tsx, product/, search/, cart/, checkout/, orders/, account/
    │   │   ├─ seller/         orders/, products/, delivery/, payments/, performance/, settings/
    │   │   ├─ driver/          mobile-first assignment page + API-linked views
    │   │   ├─ admin/           exceptions console (stopgap; real portal external)
    │   │   └─ api/v1/…        auth/, products/, cart/, orders/, shipments/, payouts/, admin/, driver/
    │   ├─ components/{ui,shop,seller,delivery}   ← ported prototype primitives
    │   ├─ lib/{db,auth,validation,money,format}  ← shared, typed
    │   └─ server/services/{catalog,cart,orders,shipments,payments,payouts,admin,driver}
    └─ tests/                   vitest unit + integration
```
Rationale: route groups map 1:1 to the three prototype surfaces + API conventions from `PROJECT_CONTEXT.md` §8. `.env.example` from the start (`DATABASE_URL`, `SESSION_SECRET`, later payment keys behind approved gateway decision).

## 5. Milestone plan (mapping to TASKS.md phases)
```
P1 frontend skeleton + tokens            → demo-able home/search/product against seed data
P2 schema + seed + API skeleton + auth   → all routes role-gated, tests green
P3 store flows end-to-end (COD)          → cart→checkout→order→tracker works
P4 seller hub functional against real orders
P5 delivery state machine + driver + admin console + payout job
P6 hardening + e2e + docs                → clean-clone setup verified
```
Order adjusted to get a visible end-to-end slice fast and put the riskiest logic (shipment/payout) right behind it.

## 6. Risks & mitigations
- **Scope creep risk** — biggest. Guardrail: `TASKS.md` priorities are the contract; P0s only unless user approves otherwise.
- **Payment ambiguity until D3/D4 answered** — checkout is designed gateway-agnostic from day 1 (server `priceAtCheckout` + payment method label), so adding Razorpay later touches one module.
- **Multi-IDE collisions** — mitigated by HANDOFF discipline + git checkpoints; single writer rule in AGENTS.md.
- **Time pressure** — the prototypes carry most of the UI; port, don't redesign.
