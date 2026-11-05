# HANDOFF.md — current checkpoint for the next IDE

**Last updated:** 2026-11-05 (Phase 1, TASKS 1.2 + 1.3 DONE) · **Writer agent:** OpenCode (GLM-5.3-Flash)

## Current phase
**Phase 1 complete — TASKS 1.1, 1.2 and 1.3 are DONE.** Next incomplete task: **TASK 2.1 — Prisma schema** (`app/prisma/schema.prisma` for entities in `PROJECT_CONTEXT.md` §7 + initial migration). Do not jump ahead of Phase 2 ordering (2.1 → 2.2 seed → 2.3 API skeleton → 2.4 auth integration test).

## Last completed task (TASKS 1.2 + 1.3, this checkpoint)
Shipped the shared presentation primitives, ported from the prototypes at token level:

- **New files** in `app/src/components/ui/`: `Card.tsx`, `Button.tsx`, `Pill.tsx`, `Stars.tsx`, `Stepper.tsx` (client), `Dialog.tsx` (client, native `<dialog>` wrapper with `cancel` handling), `Toast.tsx` (client: `ToastProvider` + `useToast`, ink bg / hi action, 3.2 s), `PrimitiveShowcase.tsx` (QA section, temporary — removed when real storefront lands).
- **Modified:** `app/src/app/globals.css` (added `--warn` light `#945400` / dark `#F0B74A` for `.pill.warn`, `--color-warn` Tailwind mapping, `.stars` CSS-mask rule = exact port of the prototype's star SVG gradient with `--p` fill variable, `dialog::backdrop`), `app/src/app/layout.tsx` (`ToastProvider` wraps header/main/footer), `app/src/app/page.tsx` (renders `<PrimitiveShowcase />`).
- `app/AGENTS.md` (Next.js-generated agent-rules block) is committed intentionally — removal only recreates it.
- Zero new dependencies; no business logic in components (Stepper `min`/`max` come from the caller — stock/min-order are business rules).

## Verification executed (real results)
| Check | Result |
|---|---|
| `npm run lint` (`eslint src`) | **exit 0, zero problems** (one round: fixed `react-hooks/set-state-in-effect` in Stepper by deriving controlled value from the prop instead of mirroring in an effect) |
| `npm run build` (Next 16 / Turbopack) | **exit 0** — first run failed typecheck: showcase called toast context like a function (`TS2349`); fixed to `toast.show(...)`; rerun clean, TypeScript passed, `/` + `/_not-found` static prerender |
| `npm run dev` + `curl http://localhost:3000/` | **HTTP 200**; served HTML contains the primitive showcase ("Component library (TASK 1.3 QA)", dialog buttons). A second dev-server pass caught a React DOM warning (`Invalid DOM property stroke-linecap`) in the Stepper icons — fixed to `strokeLinecap`; re-served page 200 with zero warnings in the dev log |
| Served CSS token check | light tokens `eaedf1 ffc72c 0b1f3a f5a623`; dark `081120`; warn `945400` (light) + `f0b74a` (dark); `.stars` rule present; `dialog` backdrop rules present; `color-scheme: light` + `color-scheme: dark`; `prefers-reduced-motion` rules — all present |
| Prototype integrity | `git diff HEAD -- buildgrid-*.html` → empty; `git status` on the three files → clean |

**Visual/browser note:** this environment has no browser tooling — theme/responsive checks were done by inspecting served HTML/CSS (tokens, color-scheme blocks, media queries are all verified present). The next human or IDE should spot-check in a real browser: run `cd app && npm run dev`, verify light/dark (OS themes, no toggle by design), widths 360/768/1440, focus-visible rings, and reduced-motion. The `PrimitiveShowcase` section on the home page exists exactly for this QA pass.

## Known deviations from prototypes (per D13, all intentional)
- `Button` radius is a `pill` prop: shop prototype uses 20px pills, seller/delivery portals use 10px corners — both shapes preserved.
- Toast: `aria-live="polite"` + small-screen max-width added (a11y/responsive improvement, allowed by D13).
- Stars: exact prototype CSS-mask technique, but wrapped with `role="img"` + computed `aria-label` (a11y).
- Data tables + product card were **not** built here — they belong to the portal/product pages that use them (Phase 4/6), recorded as such in TASKS.md.

## Pending decisions
D5 only (SMS channel for delivery OTP — stays in-app until user provides a provider).
Deferred input: **`buildgrid-platform-admin.html`** — owner supplies it after the 3 portals are built; until then TASK 7.4 uses the delivery prototype's Admin tab as its fidelity reference.
D1–D13 all APPROVED as recorded in `DECISIONS.md` except D5.

## Exact next action
Next IDE:
1. Read `AGENTS.md` → `PROJECT_CONTEXT.md` → `TASKS.md` → `DECISIONS.md` → this file; `git status` + `git log --oneline` (last commit = TASKS 1.2/1.3 checkpoint). Verify build still passes: `cd app && npm run build`.
2. Do **TASK 2.1** — `app/prisma/schema.prisma` for entities in `PROJECT_CONTEXT.md` §7 (users/roles, vendors, products, orders/lines, shipment attempts, disputes, payout ledger, events), PostgreSQL via `DATABASE_URL` from `app/.env.example`; run `npx prisma migrate dev --name init` against the local blank DB. Acceptance: migration applies cleanly.
3. Then 2.2 seed, 2.3 API skeleton, 2.4 integration test. Update `TASKS.md` + this file with real results before stopping.

## Instructions for the next IDE
- Commands run from `app/`, not the repo root.
- WSL-on-`/mnt/c` env: DrvFS I/O is very slow — run installs/builds/dev as background jobs and wait; foreground `npm install` will time out.
- Do **not** symlink `.next` or `node_modules` outside the project tree (Turbopack fails: `Cannot find module 'next/dist/compiled/loader-runner'`).
- Keep prototypes byte-identical; keep every decision traceable in `DECISIONS.md`; never mark DONE without an executed check recorded here.
