# AGENTS.md — Instructions for every AI agent working on Constro Well

## Mandatory reading order (before ANY coding)
1. `PROJECT_CONTEXT.md` — what this product is, entities, conventions
2. `TASKS.md` — the backlog; find the first non-DONE task
3. `DECISIONS.md` — do not violate or silently change an APPROVED decision
4. `HANDOFF.md` — current checkpoint and next exact action
5. `git status` + recent commits — verify claimed work actually exists before trusting it

If `HANDOFF.md` claims something that is not in the code, trust the code, then fix `HANDOFF.md`.

## Project purpose
An e-commerce marketplace for construction materials (cement, steel, sand, tiles, paint, safety gear) in India. INR currency. Multi-vendor: sellers list products, fulfil orders with their own trucks, get paid from escrow after a proof-of-delivery review window. Target is a 48-hour MVP, not a production system.

## Hard rules (violating these is a failed handoff)
- **Do not modify or delete** `buildgrid-shop.html`, `buildgrid-seller-dashboard.html`, `buildgrid-delivery-workflow.html` until a verified replacement exists (decision in `DECISIONS.md`).
- No hardcoded secrets. Everything sensitive goes in `.env` (never committed) + `.env.example` (committed).
- Validate every input on the backend. Never trust client prices, totals, or stock.
- Role-based authorization on the backend (customer / seller / driver / admin), enforced in API handlers — hiding UI screens is not authorization.
- Passwords hashed with bcrypt/argon, never stored or logged in plaintext.
- Real payment/order operations must not return fake success. If an integration is not wired, its endpoints must not exist yet.
- Database schema changes only through migrations.
- Do not commit `.env`, credentials, node_modules, build output, or generated dumps.
- No new dependencies without a written reason in the task or `DECISIONS.md`.

## Coding standards
- TypeScript throughout.
- Frontend: follow patterns already used by the deployed code; prototype's design language (dark navy nav `#0B1F3A`, yellow accent `#FFC72C`, Figtree + Bricolage Grotesque fonts, card-based light UI with dark-mode support) is the visual spec.
- Backend: one protocol style (REST per `PROJECT_CONTEXT.md`), no mixed conventions.
- Error handling: user-visible states for loading, empty, and error on every async view.
- Comments explain why, not what. Keep them rare.

## Commands (verified working — TASK 1.1)
- Setup: `cd app && npm install` · Dev: `npm run dev` (from `app/`)
- Lint: `npm run lint` · Build: `npm run build`
- DB/test commands arrive in Phase 2 (`npm run db:migrate`, `npm run test`) — do not invent them here until those tasks land.

**Environment note (WSL on `/mnt/c`):** npm + I/O-heavy tools on the Windows drive are very slow; timeouts on long installs are normal. `npm run lint` is scoped to `src` intentionally; never symlink `.next` outside the project tree (breaks Turbopack module resolution — tested and reverted).

## Running tests is part of "done"
Never mark a task DONE in `TASKS.md` without executing the check that proves it and recording the real result in `HANDOFF.md`.

## Prototype fidelity policy (APPROVED, product-owner directive — acceptance criterion)
The four original prototypes are the primary visual + UX references:
`buildgrid-shop.html`, `buildgrid-seller-dashboard.html`, `buildgrid-delivery-workflow.html`, `buildgrid-platform-admin.html`.

- **MUST preserve:** color palette/design tokens, typography + hierarchy + sizing, visual identity/branding, navigation structure and information architecture, page layouts/card structure/spacing/visual hierarchy, user journeys and interaction patterns, portal-specific visual characteristics.
- **MAY improve:** responsiveness, accessibility + keyboard navigation, component reusability/code quality, form validation + error feedback, loading/empty/success/failure states, micro-interactions, usability fixes that don't change design intent.
- **MUST NOT:** swap in a generic Next.js/SaaS dashboard template; arbitrarily change palette/typography/branding; redesign page structure or navigation without written justification; remove prototype features because their backend is not connected yet; inconsistent styling between portals; design changes based on personal preference.
- **Verification before any UI task is DONE:** implemented page compared against its prototype; visual hierarchy/spacing/typography/colors/proportions checked; desktop + mobile responsiveness checked; every intentional deviation documented in `DECISIONS.md`/task notes with a reason; prototypes confirmed unchanged (`git diff`).

Principle: **Preserve the design, improve the experience, strengthen the implementation.**

## Multi-IDE rules (OpenCode / Antigravity / Freebuff share this working tree)
- Read all 5 docs above every session, even if you "remember" the project.
- One IDE writes at a time. Never launch two agents that mutate the same files concurrently.
- Before stopping: update `TASKS.md`, `HANDOFF.md` (and `DECISIONS.md`/`PROJECT_CONTEXT.md` if anything changed), commit as a checkpoint when practical, and report modified files and uncommitted work.
- Continue the next incomplete task. Do not rebuild what is already DONE.
- Never mark a task DONE without verifying the implementation directly against the code.
