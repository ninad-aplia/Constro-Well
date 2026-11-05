# HANDOFF.md — current checkpoint for the next IDE

**Last updated:** 2026-11-05 (Phase 1, TASK 1.1) · **Writer agent:** OpenCode (GLM-5.3-Flash)

## Current phase
**Phase 1 — TASK 1.1 DONE.** Next incomplete task: **TASK 1.2** (dark/light token parity is already achieved in `app/src/app/globals.css` — verify on `npm run dev` with an OS theme switch, then move straight to **TASK 1.3**, the shared UI primitives).

## Last completed task (TASK 1.1, this checkpoint)
All approved decisions recorded in `DECISIONS.md` (D1–D12; D5 still open). PROJECT_CONTEXT updated to approved stack. Scaffolded `app/`:

- **Stack installed:** Next.js 16.4.5 (App Router, Turbopack), React 19.3.0, TypeScript 5, Tailwind CSS v4, ESLint 9 (flat config), `@tailwindcss/turbopack`.
- **Design tokens:** `app/src/app/globals.css` — exact palette from `buildgrid-shop.html` (light + dark via `prefers-color-scheme`, no toggle UI), fonts Figtree + Bricolage Grotesque via `next/font/google`, focus-visible, reduced-motion, skip-link, tokens exposed as Tailwind utilities (`bg-nav`, `text-ink`, `border-line`, `bg-hi`, `font-display`, …).
- **App shell:** `app/src/app/layout.tsx` (skip link, header, main `#app` skip target, footer); `app/src/components/ui/SiteHeader.tsx` (sticky dark-nav header, Constro Well wordmark placeholder "CW", search visual placeholder for TASK 4.2); `app/src/components/ui/SiteFooter.tsx` (minimal until destinations exist).
- **Placeholder storefront:** `app/src/app/page.tsx` — static hero + 12 static category cards + build-status panel. **No shopping workflow, no catalogue fetch.**
- **Env & ignore:** `app/.env.example` (DATABASE_URL, SESSION_SECRET placeholders only); `app/.gitignore` (create-next-app's, + `!.env.example` so the example commits); root `.gitignore`.
- `app/package.json` script change: `"lint": "eslint src"` (was bare `eslint`).

## Files created or modified
Created: `app/**` (scaffold + above), `.gitignore` (root).
Modified: `DECISIONS.md`, `PROJECT_CONTEXT.md`, `TASKS.md`, `HANDOFF.md` (this file), `AGENTS.md` (commands block), `app/.gitignore`, `app/package.json` (lint script), `app/README.md` (project quickstart).
**Prototypes untouched — verified** (`git diff HEAD -- buildgrid-*.html` → empty).

## Commands executed (and real results)
| Command | Result |
|---|---|
| `npx create-next-app@latest app --typescript --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*" --use-npm --yes` | OK (slow; interrupted twice by shell timeout, resolved below) |
| `npm install` (in `app/`) | exit 0 — "added 360 packages in 23m" |
| `npm run lint` → `eslint src` | **exit 0, zero problems** (first failure was a real error: `<a>` to `/` → fixed with `next/link`) |
| `npm run build` (Next 16, Turbopack) | **exit 0** — static prerender of `/` + `/_not-found`; included typecheck passed |

## Tests executed and their actual results
Only lint + build exist at this point (no Vitest yet — TASK 2.4). No tests were invented or skipped.

## Known errors, blockers, environment notes
- **First build failed** with `Cannot find module 'next/dist/compiled/loader-runner'` because `.next` had been symlinked to ext4 to work around DrvFS slowness; Turbopack resolves modules relative to the build-output root. **Fix: `.next` must stay a real directory inside `app/` (symlink removed; reverted data deleted).**
- Two npm installs timed out mid-reify on `/mnt/c` (WSL DrvFS is ~10–20× slower on I/O). A leftover npm process also held a lock causing EACCES on rename — killed. Final clean `npm install` succeeded. `node_modules` is a **real directory in `app/`** (npm reifies over symlinks, so a symlink workaround does not stick).
- Precedent for future agents: run long npm/build commands as background jobs and wait; keep `lint` scoped; do not symlink `.next` or `node_modules`.

## Pending decisions
D5 only (SMS channel for delivery OTP — stays in-app until user provides a provider).
Deferred input: **`buildgrid-platform-admin.html`** — owner supplies it after the 3 portals are built; until then TASK 7.4 uses the delivery prototype's Admin tab as its fidelity reference.
D2/D4/D10/D12 etc. all APPROVED as recorded in `DECISIONS.md`.

## Exact next action
Next IDE:
1. Read `AGENTS.md` → `PROJECT_CONTEXT.md` → `TASKS.md` → `DECISIONS.md` → this file; `git status` + `git log --oneline` (last commit = TASK 1.1). Verify build still passes: `cd app && npm run build`.
2. Do **TASK 1.3** — port shared UI primitives from the prototypes into `app/src/components/ui/` (+ `components/shop/`): Card, Button (yellow/line/orange variants, sm/wide/disabled), Toast (client), Dialog (native `<dialog>` wrapper, client), rating Stars (CSS-mask technique from prototype), Pill, Stepper (qty), field + validation-error pattern. Pure presentation only — no business logic (approved rule). **Fidelity is an acceptance criterion (D13): match prototype markup/palette/typography/spacing; document every deviation.**
3. Optionally verify dark mode: `npm run dev`, switch OS theme; tokens flip like the prototype.
4. Update `TASKS.md` + this `HANDOFF.md` with real check results before stopping. Do not start Phase 2 (Prisma/schema) before TASK 1.3 is DONE and 1.2 visually verified.

## Instructions for the next IDE
- Commands are run from `app/`, not the repo root.
- This environment (WSL on `/mnt/c`) is slow on file I/O: background-mode long commands, expect minutes not seconds.
- Keep prototypes byte-identical; keep every decision traceable in `DECISIONS.md`; never mark DONE without an executed check recorded here.
