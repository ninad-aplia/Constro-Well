# MIGRATION_ROADMAP.md

Phase 02 — Deliverable 9 of 10. Sequenced, incremental, workflow-by-workflow, per `UPDATED_ARCHITECTURE_DECISION.md §3`. **Phase 0 is new in this document and was not part of Phase 01's roadmap**: it directly addresses the user's own closing note that no test suite or build has ever actually been executed as part of either audit, and that a verified baseline must exist before any migration work begins.

## Phase 0 — Establish a verified baseline (prerequisite to everything below)

**Neither this audit nor Phase 01's audit has executed the existing test suite, linter, type-checker, or build.** Both were strictly read-only by their own mandate. This is a real gap the user has correctly identified: **"we must establish a verified baseline before migration work begins"** — migrating against an unverified starting point means any later test failure can't be attributed with confidence to the migration vs. a pre-existing, latent defect.

- **WP-0.1 — Run the existing full verification suite** (lint, typecheck [note: Phase 01 found no `typecheck` script exists — add one first, `tsc --noEmit`], `npm run build`, and the full Vitest suite including the DB-gated integration tests) **against a confirmed-local/non-production database**, exactly the safety discipline Phase 01's own earlier session in this project demonstrated (verify `DATABASE_URL`'s host before running anything DB-touching; never run DB-gated tests against an unconfirmed target). Record the actual pass/fail result for every test — if anything fails today, that is a pre-existing defect to fix or explicitly accept **before** attributing any future failure to the migration.
- **WP-0.2 — Fix CI** (Phase 01 `WP-P0-2`, re-affirmed here as a literal prerequisite, not just a good idea): once Phase 0.1 establishes a passing baseline, CI must be the thing that keeps it passing — migration work without a working CI gate is building on sand.
- **WP-0.3 — Record the verified baseline** in a short, dated note (e.g. `docs/BASELINE_VERIFICATION_2026-XX-XX.md`) stating exactly which commit, which commands, and their actual output — this becomes the reference point every subsequent migration PR is diffed against.

**This document does not execute Phase 0** (this remains a read-only planning phase per its own instructions) — it is sequenced here as the mandatory first implementation step, before Tranche T1 below begins.

## Phase 1 (Tranches T1 + T5-early) — Low-risk reads and net-new builds, in parallel

Rationale (Updated Architecture Decision §3, Business Workflow Migration Plan's cross-workflow ordering summary): lowest-regression-risk work first, builds real FastAPI delivery experience on this codebase's actual domain before any money-handling logic is touched.

- Stand up the FastAPI skeleton (Target FastAPI Architecture §1), the SQLAlchemy models (read-only initially against the existing schema), the Alembic reflect-only baseline (Database/ORM Migration Plan §1).
- Migrate **Workflow 2 (Catalog)**: `GET /categories`, `/products`, `/products/[id]`, `/products/[id]/offers`, **plus** the 6-file frontend rewrite (Dependency Inventory §1a) converting direct Prisma access to HTTP calls.
- Build **Workflow 12 (Admin)** minimal slice, **Workflow 13 (Notifications)**, directly in FastAPI — zero regression risk, real team learning.
- Begin **Workflow 1 (Auth)**: build the FastAPI session-validation dependency chain and prove it against the shared `Session` table (Authentication Migration Plan's acceptance criteria) — but do **not** yet move the login/register/logout *write* routes; prove read-side (`GET /me`-equivalent) compatibility first.

**Gate to exit Phase 1**: the bcrypt cross-verification smoke test and the session-portability test (Authentication Migration Plan §5) both pass; the catalog domain's contract-equivalence test (Business Workflow Migration Plan workflow 2 acceptance) passes; Admin's non-admin-rejection test passes.

## Phase 2 (Tranche T2) — Customer write paths

- **Workflow 1 continued**: migrate login/register/logout write routes, now that read-side compatibility is proven.
- **Workflow 3 (Addresses)**.
- **Workflow 4 (Cart and coupons)** — including the concurrency (`lockOffer`-equivalent) test.
- **Workflow 14 (File uploads/KYC)** can begin here in parallel (net-new, no ordering dependency) once the deployment-target decision (storage provider) is made.

**Gate to exit Phase 2**: all Phase-2 workflows' acceptance criteria met; the deterministic idempotency-key hash function (needed for Phase 4) is unit-tested for byte-identical output between the two implementations, even though order placement itself hasn't moved yet — proving this piece early, in isolation, de-risks the highest-stakes migration later.

## Phase 3 (Tranche T3) — Seller and driver write paths, in parallel

- **Workflow 6 (Seller inventory)** — including the explicit, recorded decision on the lost-update race (Database Migration Plan §5 / Business Workflow Migration Plan workflow 6).
- **Workflow 7 (Seller order processing)**.
- **Workflow 8 (Driver assignment)** and **Workflow 9 (OTP/delivery issues)** — including the AES-GCM cross-implementation compatibility test, which is a hard gate given it's a correctness property, not a nice-to-have.
- **Workflow 11 (Seller performance/payments)** — including the deliberate Decimal-precision fix.

**Gate to exit Phase 3**: every ported Vitest test for these domains has a passing pytest equivalent against real test Postgres; the OTP cross-compatibility test passes; the lost-update-race decision is implemented (whichever way) and tested.

## Phase 4 (Tranche T4) — Checkout and order placement, escrow

**The single highest-risk phase, deliberately last among business-logic migrations.**

- **Workflow 5 (Checkout and order placement)** — full acceptance criteria per Business Workflow Migration Plan workflow 5, including the manual, recorded full-flow test.
- **Workflow 10 (Escrow and financial records)**, including finally building the settlement/timeout job (Phase 01's confirmed-missing `review→settled`/`missed` mechanism) — this is the natural point to build it, directly in FastAPI, since it's new logic living alongside the newly-migrated order/escrow code it operates on.

**Gate to exit Phase 4**: the complete-ledger-balance reconciliation test (Business Workflow Migration Plan workflow 10) passes for every lifecycle path including the newly-built settlement path; a real order, migrated end-to-end, reaches `settled` automatically for the first time in this project's history.

## Phase 5 — Cutover of remaining Next.js-only concerns, documentation, and final migration-authority decision

- Any remaining Next.js API routes not yet covered (re-verify against the Contract Matrix — this roadmap's tranches should cover all 39 inventoried routes plus the Server-Component-direct-access cases by the end of Phase 4, but explicitly re-check before declaring this phase done).
- Decide and execute (separately, deliberately, out of this document's scope per `DATABASE_AND_ORM_MIGRATION_PLAN.md §1`) whether/when to transfer schema-migration authority from Prisma to Alembic, now that FastAPI owns all application logic.
- Retire (or explicitly keep, if a reason emerges) the Next.js API-route layer; Next.js becomes a pure frontend consuming FastAPI exclusively.
- Update project documentation (`HANDOFF.md`, `TASKS.md`, `DECISIONS.md`) to reflect the new, completed architecture — directly addressing Phase 01's own repeatedly-flagged documentation-drift pattern, applied to this migration's own record-keeping this time.

## Cross-cutting, ongoing throughout every phase
- Every workflow's "acceptance criteria" in the Business Workflow Migration Plan is a **hard gate**, not a suggestion — do not advance a workflow's traffic to FastAPI until its specific tests pass against real Postgres.
- The reverse-proxy routing (Deployment Plan §2-3) means **any phase can be paused or rolled back** by routing its workflow's traffic back to the still-present Next.js implementation, without a data migration or code revert — this is the practical safety net this incremental approach buys, and should be exercised deliberately (a planned rollback drill at least once, ideally during the lower-stakes Phase 1-2 work) to prove it actually works before it's ever needed under real pressure in Phase 4.
