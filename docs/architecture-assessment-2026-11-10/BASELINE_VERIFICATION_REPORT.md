# BASELINE_VERIFICATION_REPORT.md

Phase 03A — Existing System Baseline Verification. Unlike Phases 01/02, this phase **executed** commands (lint, typecheck, tests, build, and one disposable reproduction script) against a confirmed-local, non-production database, rather than relying solely on static code reading. Every pass/fail result below is a real, observed outcome, not an inference.

## 1. Git baseline

- **Branch**: `feature/backend-mvp`, up to date with `origin/feature/backend-mvp`.
- **HEAD**: `1f0f61fe1aa16a93e5b79e634f18543708da391e`, 2026-11-08 06:49:10 +0530, "Complete customer and seller marketplace workflows" — **unchanged since Phase 01 and Phase 02**, re-confirmed at the start of this phase.
- **Working tree**: clean. Untracked-only: `app/.github/`, `app/tests/`, `artifacts/`, `buildgrid-platform-admin.html` (all pre-existing, unrelated to this work), plus the two prior phases' own documentation directories (`docs/architecture-assessment-2026-11-09/`, `docs/architecture-assessment-2026-11-10/`).
- **No tracked file was modified, nothing was staged, committed, pushed, reset, or stashed** during this phase. One disposable, untracked verification script (`.scratch-race-check.mjs`) was created outside `src/` for the Step 4 reproduction and deleted immediately after use; `git status --short` was re-checked afterward and shows no trace of it.

## 2. Quality-gate inventory (Step 2)

- **Scripts** (`app/package.json`): `dev`, `build` (`next build`), `start`, `lint` (`eslint src`), `test` (`node --no-experimental-webstorage node_modules/vitest/vitest.mjs run`), `test:watch`, `db:migrate`, `db:migrate:deploy`, `db:seed`, `db:studio`. **No dedicated `typecheck` script exists** — type-checking was run directly via `npx tsc --noEmit`, relying on `tsconfig.json`'s own `noEmit: true`.
- **TypeScript config**: `strict: true`, no relaxed sub-flags, `skipLibCheck: true`, `isolatedModules: true`.
- **Lint config**: `eslint.config.mjs` extends `eslint-config-next/core-web-vitals` + `/typescript`, no custom rule disables.
- **Test framework**: Vitest 3.2.7, `jsdom` environment, 19 test files under `src/**/*.test.ts`. Roughly half are pure (no DB), half are gated `describe.skipIf(!hasDb)` against a real PostgreSQL instance via `process.env.DATABASE_URL`.
- **CI**: one workflow file, `app/.github/workflows/playwright.yml` — **still at the wrong location** (GitHub Actions only discovers `<repo-root>/.github/workflows/`; there is no `.github/` at the actual repo root), unchanged from both prior phases' findings. It would only ever run the unmodified Playwright scaffold test even if relocated.
- **Dependencies**: `app/node_modules` already present — **no install was needed or performed**.

## 3. Safety determination (Step 2/3 gate)

- `app/.env` exists. Its `DATABASE_URL` was checked using the same narrow, secret-safe technique as prior sessions (parse only `host`/`port`/`database name`, never read or print the credentials): **`host: 127.0.0.1, port: 5433, database: constrowell, isLocalHost: true`.** Confirmed local, not shared, not production.
- The local Postgres instance was confirmed **reachable** (raw TCP connect to `127.0.0.1:5433` succeeded) before any DB-gated test was run.
- On this basis: lint, typecheck, build, and the **full** Vitest suite (including DB-gated suites) were judged safe to execute. Migrations, seeds, and any destructive command were explicitly not run, per instruction — confirmed by checking the *existing* `prisma/migrations/` state was not touched (no new migration files appeared; `npm run db:migrate`/`db:seed` were never invoked this phase).

## 4. Commands executed and results (Step 3)

| Command | Result | Detail |
|---|---|---|
| `npm run lint` | **PASS** | `eslint src` — exit 0, zero output (no warnings or errors) |
| `npx tsc --noEmit` | **PASS** | Zero errors, zero output |
| `npm run test` | **PASS** | **19 test files, 116 tests, all passed**, including all 8 DB-gated integration suites (auth, catalog, cart, seller inventory, seller profile, seller delivery, seller order lifecycle incl. payments/performance, checkout/orders, driver lifecycle). Duration 43.46s. |
| `npm run build` | **PASS** | `next build`, exit code 0. 46 routes generated (static/dynamic/partial-prerender mix unchanged from both prior phases' observations), no error or warning in the full captured log. |
| Playwright (`app/tests/example.spec.ts`) | **NOT RUN** | Confirmed (not re-executed) to be the unmodified `npm init playwright` scaffold testing `playwright.dev`'s own site, not this application — running it would add no verification value for this codebase and was correctly out of scope for "existing quality gates" relevant to this app. |

**No test, lint rule, or type error failed.** This is a genuinely clean, fully-green baseline, now actually observed rather than assumed.

## 5. Existing failures vs. newly discovered failures

- **Existing failures found by running the suite: none.** Every pre-existing automated check (lint/typecheck/test/build) passes as-is.
- **Newly discovered issue, found by this phase's own fresh investigation, not by the automated suite** (because no existing test covers it): the seller-inventory lost-update race (Step 4, §6 below) — **this is a real defect in the current implementation that the existing test suite does not catch**, confirmed by empirical reproduction, not merely by reading code. It is "newly discovered" in the sense that no automated test currently fails because of it; it was already noted as a code-reading-level finding in Phase 02, and this phase upgrades it from "found by reading" to "reproduced on the real database."

## 6. Focused investigation of the six critical findings (Step 4)

### 6.1 Seller inventory lost-update race — **CONFIRMED, reproduced empirically**
Direct re-read of `src/server/seller/inventory.ts`'s `updateSellerProduct` (lines ~111-144) and `updateSellerStock` (lines ~146-169): both read the current offer via an unlocked `findFirst`, then `update` using an **absolute** stock value — for `updateSellerStock`, that absolute value is the caller-supplied `stock` parameter, used as-is regardless of what the function's own internal (fresh) read just saw. The actual race is therefore not "the function reads stale data internally" (its own read is always fresh) but **"the seller's browser decided on an absolute new-stock number based on a page load that is now stale, and the server blindly trusts that absolute number,"** silently overwriting any stock change (e.g. a concurrent customer checkout decrement) that happened in between.

**Empirically reproduced this phase** via a disposable script (created, run, and deleted within this session; zero trace left in the repository): seeded a throwaway seller+product+offer with `stock=10`; simulated a concurrent checkout decrementing 3 units (real stock → 7, via the same conditional `updateMany` pattern `placeOrderTx` itself uses); then called the real, unmodified `updateSellerStock(sellerId, offerId, 15, db)` (simulating the seller's stale browser, which saw `stock=10` and wanted to add 5, submitting the absolute value `15`). **Result: final real stock = 15, not 12.** The customer's 3-unit decrement was silently and completely erased. Output captured directly from the run:
```
--- initial stock: 10
--- stock after concurrent checkout: 7
--- seller PATCH /stock result.stock: 15
--- final real stock in DB: 15
RACE REPRODUCED: customer's 3-unit decrement was silently lost.
```
**Important, precise scoping of this finding**: the identical "conditional `updateMany`" pattern is used safely elsewhere (`orders/service.ts:256-259`, inside `placeOrderTx`) — there it is safe specifically because the relevant `SellerOffer` rows are already `SELECT ... FOR UPDATE`-locked beforehand (`service.ts:225`), serializing concurrent checkouts against each other. **The bug is the absence of an equivalent lock (or a relative/delta-based update) on the seller-inventory-edit path, not the conditional-update pattern itself.**

**Proposed minimal regression test** (for the actual codebase, to be added by the implementation team — not added by this phase, per the "do not modify tests" restriction): a new case in `src/server/seller/inventory.test.ts`, following the file's existing `withRollback` transaction-rollback pattern:
```ts
it("does not let a stale-based seller stock edit silently erase a concurrent checkout decrement", async () => {
  await withRollback(async (tx) => {
    const seller = /* existing fixture helper */;
    const offer = await tx.sellerOffer.create({ data: { /* stock: 10, ...(same literal fixture shape as the describe's other cases) */ } });

    // Simulate a concurrent checkout's conditional decrement, landing between
    // the seller's (simulated) page load and their stock-edit submission.
    await tx.sellerOffer.updateMany({
      where: { id: offer.id, stock: { gte: 3 }, status: "active" },
      data: { stock: { decrement: 3 } },
    });

    // Seller, unaware of the above, submits an absolute new value based on
    // their stale view (saw stock=10, wants +5 => submits 15).
    const result = await updateSellerStock(seller.id, offer.id, 15, tx);

    // A race-safe implementation must not let this silently erase the
    // checkout's legitimate decrement — the real stock should still reflect
    // it (e.g. by rejecting the stale write, or by the caller sending a
    // relative delta instead of an absolute value).
    expect(result.stock).not.toBe(15); // documents the current (buggy) behavior as a FAILING assertion once fixed
  });
});
```
This test is written to **fail against the current implementation** (as empirically shown above, `result.stock` is currently `15`) and to **pass once the race is fixed** — it is a true regression test, not merely a characterization test, which is the correct form for a known bug being tracked toward a fix.

### 6.2 Checkout stock reservation and idempotency — **CONFIRMED sound, re-verified fresh**
`src/server/orders/service.ts:144-146`: `idempotencyOrderId(userId, key) = "ord_" + sha256("{userId}:{key}").hex.slice(0,24)` — deterministic, re-confirmed by direct read. Stock reservation (`service.ts:255-259`): conditional `updateMany({where:{id, stock:{gte:qty}, status:"active"}, data:{stock:{decrement:qty}}})`, `count!==1` → `409 insufficient_stock` — re-confirmed, and re-confirmed **safe** because it executes only after the relevant offer rows are locked in sorted order (`service.ts:222-226`, `FOR UPDATE`) earlier in the same transaction. No change from Phase 02's findings; this phase adds direct re-verification at the exact current line numbers.

### 6.3 Authentication/session compatibility requirements — **CONFIRMED unchanged, re-verified fresh**
`src/server/auth/session.ts:10` `SESSION_COOKIE = "cw_session"`; `:11` 7-day TTL; `:13` `BCRYPT_COST = 12`; `src/server/auth/current.ts:20-22` `httpOnly:true, secure: NODE_ENV==="production", sameSite:"lax"`. All re-confirmed by direct read this phase, unchanged from Phase 02's Authentication Migration Plan, which remains valid as written.

### 6.4 Escrow aggregation precision — **CONFIRMED, exact lines re-verified**
Two `Number(entry.amount)` coercions before native `+=` summation, re-confirmed at `src/server/orders/service.ts:108-110` and `src/server/orders/sellerService.ts:474`. Both remain display-only aggregations (no write-back to the database), consistent with Phase 02's risk classification (cosmetic/display precision, not ledger-corrupting).

### 6.5 Missing settlement transitions — **CONFIRMED absent, triple-verified across three sessions at this same commit**
Fresh greps this phase: `"settled"` appears only inside `DELIVERED`/`SHIPPED` classification `Set`s (`lifecycle.ts:7-8`), never as a write target anywhere in `src/server`. Zero matches for `type: "commission"` or `type: "released"` escrow-entry creation anywhere outside `prisma/seed.ts`. `reviewEnds`/`acceptBy` are written once (at delivery/dispatch time) and read for display only — never compared against the current time to drive any transition. **There remains no code path anywhere that can advance a real shipment to `settled` or a timed-out order to `missed`.**

### 6.6 Direct Prisma access from Server Components and layouts — **CONFIRMED, re-verified fresh**
`src/app/product/[id]/page.tsx` (Server Component, header comment confirms "all data comes from the catalog API facade" — meaning the internal `catalogDb.ts` facade, not an HTTP `/api/` call); `src/app/seller/layout.tsx:14-16,26,30,35` directly imports and calls `sellerSummary`/`resolveSellerForUser`/`getCurrentUser`; `src/app/delivery/layout.tsx:12-14,19,23,26` directly imports and calls `listDriverJobs`/`resolveDriverForUser`/`getCurrentUser`. All re-confirmed this phase by direct grep/read, unchanged from Phase 02's Dependency Inventory finding.

## 7. Test coverage limitations (unchanged from Phase 01/02, re-affirmed)

- Zero real end-to-end/browser coverage — the only Playwright spec is the unmodified scaffold.
- The seller-inventory lost-update race (§6.1) has **no existing automated test** — this phase's empirical reproduction was a one-off script, not a permanent addition to the suite (per this phase's restrictions).
- No coverage-percentage reporting is configured in `vitest.config.ts` — "116 tests pass" is not the same claim as "X% of code paths are exercised," and this report does not claim the latter.

## 8. Migration blockers

1. **CI is non-functional** (wrong directory) — should be fixed before any migration PR relies on an automated gate (Phase 01/02's own prior recommendation, re-affirmed as a literal blocker now that a real green baseline exists to protect).
2. **The seller-inventory race is a real, reproducible defect** that must be explicitly decided on (preserve vs. fix during the FastAPI port, per Phase 02's `RISKS_DECISIONS_AND_OPEN_QUESTIONS.md` item A.3) before that specific workflow (Business Workflow Migration Plan workflow 6) is migrated — now with empirical proof behind the decision, not just a code-reading inference.
3. **No `typecheck` npm script exists** — trivial to add, but should be added before/alongside CI being fixed, so the baseline this report establishes can be mechanically re-verified by anyone, not just by someone who knows to run `npx tsc --noEmit` manually.

No other blocker was found. The rest of the codebase is in the clean, green state both prior phases' analysis assumed but never actually confirmed by execution.

## 9. Recommended first implementation work package

**WP-0 (Migration Roadmap Phase 0), now substantially complete as of this report**: this phase's execution of lint/typecheck/test/build **is** the baseline-verification step Phase 02's roadmap called for. Remaining to fully close WP-0: (a) add the missing `typecheck` script to `package.json` (a one-line, low-risk change); (b) relocate/fix the CI workflow (Phase 01 `WP-P0-2`); (c) commit this report and today's confirmed-green result as the recorded reference point future migration PRs are diffed against. **Once (a)-(c) land, Migration Roadmap Phase 1 (FastAPI skeleton + catalog migration + net-new Admin/Notifications work) can begin immediately** — it has no dependency on the seller-inventory race decision (item 2 above), which only blocks Phase 3's seller-inventory workflow specifically, not the overall start of migration work.

## 10. Verdict

# **GO**

The existing baseline is genuinely green: lint, typecheck, build, and the full test suite (116 tests, including every DB-gated integration suite) all pass, executed for real against a confirmed-local, isolated database, not assumed from static analysis. The one real defect found (§6.1) is narrowly scoped, does not affect the currently-passing test suite, has a precise, proposed regression test, and only blocks one specific future migration workflow (seller inventory, Phase 3) rather than the start of migration work overall. CI being non-functional and the missing `typecheck` script are both small, fast fixes that should land alongside Phase 0's closure, not reasons to withhold a GO on the baseline itself.
