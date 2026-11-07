# README.md — Constro Well

An e-commerce marketplace MVP for **construction materials in India** — customer storefront, seller portal, driver delivery view and admin exception console — target: a working version in ~48 hours.

> **Status: deployable mock-data preview.** The Next.js app in `app/` serves the Customer, Seller and Delivery portals; cart/checkout/orders work as browser-local previews (D14). Authentication, the API layer and live order processing are not implemented yet. Release status and deployment procedure: `docs/CLIENT_DEPLOYMENT_READINESS.md`.

## Repository map
| Path | What it is |
|---|---|
| `buildgrid-shop.html` | UI prototype #1 — customer storefront (self-contained SPA, localStorage demo) |
| `buildgrid-seller-dashboard.html` | UI prototype #2 — Seller Hub |
| `buildgrid-delivery-workflow.html` | UI prototype #3 — multi-role delivery workflow demo (customer/vendor/driver/admin tabs) |
| `AGENTS.md` | **Mandatory first read** for every AI agent working here |
| `PROJECT_CONTEXT.md` | Product, roles, entities, conventions — the project reference |
| `TASKS.md` | Backlog with status + acceptance criteria — find your task here |
| `HANDOFF.md` | Current checkpoint and exact next action |
| `DECISIONS.md` | Decision log (PROPOSED/APPROVED/REJECTED) |
| `docs/PROTOTYPE_AUDIT.md` | Detailed audit of all three prototypes |
| `docs/ARCHITECTURE_PROPOSAL.md` | Proposed stack, architecture, directory layout |

The three prototype HTML files are historical design sources: open one directly in a browser to see it work. They must not be modified until their replacements are verified (see `AGENTS.md`).

## Original prototypes
Open one directly in a browser to see it work:
| File | What it is |
|---|---|
| `buildgrid-shop.html` | Customer storefront (SPA: home, search, product, cart, checkout, orders, account) |
| `buildgrid-seller-dashboard.html` | Seller Hub (orders, products, delivery setup, payments, performance, settings) |
| `buildgrid-delivery-workflow.html` | Multi-role delivery demo (customer / vendor / driver / admin tabs) |

## Setup (application)
```bash
cd app
npm install
cp .env.example .env      # fill DATABASE_URL for Prisma commands
npm run db:migrate        # development migrations
npm run db:seed           # optional demo data
npm run dev               # http://localhost:3000
```

Production build, hosting, migration and rollback steps: `docs/CLIENT_DEPLOYMENT_READINESS.md`.

## Working on this repo (agents)
Follow the entry procedure in `AGENTS.md` before every session: read all five docs, check `git status`, verify claimed progress, continue the first non-DONE task in `TASKS.md`, and update `HANDOFF.md` before stopping.
