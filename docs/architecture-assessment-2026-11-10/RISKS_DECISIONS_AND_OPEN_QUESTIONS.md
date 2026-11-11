# RISKS_DECISIONS_AND_OPEN_QUESTIONS.md

Phase 02 — Deliverable 10 of 10. Consolidates every risk and every decision flagged across Deliverables 1-9 into one place for the owner review session.

## A. Decisions requiring explicit owner approval (carried forward or new this phase)

1. **Deployment target** (carried from Phase 01, still unresolved): Docker (D10, approved) vs. Render (actually deployed) vs. GCP (this phase's brief). Deployment Plan §1 presents the conflict without choosing; needs an explicit, dated decision before any infrastructure provisioning begins.
2. **Same-origin reverse-proxy vs. separate-subdomain deployment** for the Next.js/FastAPI pair (Deployment Plan §3) — this document recommends same-origin; needs sign-off since it affects CORS/cookie design materially if ever revisited.
3. **The lost-update stock race in seller inventory editing** (Database/ORM Migration Plan §5, Business Workflow Migration Plan workflow 6): preserve as-is, or fix during the port? This document recommends fixing (low cost, well-precedented pattern already in the codebase) but it is a real behavior change from "faithfully preserve existing implementation," so it needs explicit sign-off, not a unilateral engineering call.
4. **Final migration-authority cutover for schema migrations** (Prisma → Alembic, Database/ORM Migration Plan §1, Migration Roadmap Phase 5): explicitly out of scope for this phase's plan; needs its own future decision once FastAPI owns all application logic, not before.
5. **Whether to fix the two Decimal-summation display-precision exceptions** found this phase (Database/ORM Migration Plan §6, Business Workflow Migration Plan workflow 11) during the port, vs. faithfully reproducing the existing `Number()`-coercion behavior. Recommended: fix (no behavior-compatibility downside, strict improvement) — flagged for sign-off since it is, technically, a deliberate deviation from "preserve existing implementation exactly."
6. **Scope and timeline of the Admin portal build** (carried from Phase 01: full 8-section reference vs. the minimal dispute-resolution + overview slice proposed as the first FastAPI-built feature) — unchanged open question, now additionally relevant as the literal first real FastAPI workload.
7. **Whether SMS (D5) or any other scope beyond this plan's explicit "notifications = email only, no SMS" boundary** should be reconsidered — not changed by this phase, re-flagged only to prevent scope creep being silently assumed one way or the other during FastAPI build-out.

## B. Critical technical risks (ranked)

1. **Checkout/order-placement and escrow-ledger migration (Business Workflow Migration Plan workflows 5 and 10)** — the single highest-consequence piece of this entire migration. A subtle Decimal-arithmetic or lock-ordering discrepancy here is a real money bug, not a cosmetic one. Mitigated by this plan's explicit "migrate last, after every other pattern is proven" sequencing (Migration Roadmap Phase 4) and its specific, hard-gated acceptance tests.
2. **OTP/AES-256-GCM cross-implementation compatibility (Business Workflow Migration Plan workflow 9)** — if the Python and Node AES-GCM implementations don't produce/consume byte-compatible ciphertext against the same key, an order dispatched by one backend could have an unreadable OTP when read by the other during the coexistence window. Mitigated by an explicit, named pre-migration compatibility test (Migration Roadmap Phase 3 gate).
3. **Session/auth continuity (Authentication Migration Plan, explicitly flagged by the user)** — mitigated by reusing the identical token/hash/cookie scheme rather than any new auth paradigm, plus the bcrypt cross-verification and session-portability smoke tests as hard, named gates before any login traffic moves.
4. **Database ownership conflict (Database/ORM Migration Plan §1, explicitly flagged by the user)** — mitigated by the explicit "Prisma remains sole migration authority throughout" rule, with Alembic kept in reflect-only mode and (recommended) pointed at a migration-restricted DB role in non-local environments as a practical enforcement mechanism, not just written policy.
5. **No verified baseline exists today** (explicitly flagged by the user in their closing note) — mitigated by this document's new Phase 0 (Migration Roadmap), which must execute and record a real pass/fail baseline before any other phase begins, something neither this audit nor Phase 01's could do itself under its own read-only mandate.
6. **Server-Component-direct-DB-access pages (customer catalog, Dependency Inventory §1a) require a frontend code change, not just a backend swap** — a risk specifically because it's easy to underestimate as "just repoint the fetch" when it's actually "rewrite how these 6 files fetch data at all." Mitigated by explicitly scoping this as its own migration step with its own acceptance criteria (Business Workflow Migration Plan workflow 2), not folding it silently into the backend-only work.
7. **Shared-secret distribution between two independently-deployed services** (Deployment Plan §4) — a configuration-only bug class (mismatched `OTP_ENCRYPTION_KEY` or session-related secrets between the two services) that would be silent and hard to diagnose. Mitigated by the explicit single-source-of-secrets recommendation.
8. **No working CI today** (Phase 01, re-affirmed) — directly threatens the entire incremental-migration strategy's safety net, since "route traffic back to Next.js if FastAPI misbehaves" only works if regressions are caught before a rollback is needed, not after. Mitigated by making CI-fix a literal Phase 0 prerequisite (Migration Roadmap), not a someday-nice-to-have.

## C. Newly-surfaced findings this phase, not previously documented

- The seller-inventory lost-update race (Database/ORM Migration Plan §5) — a real, pre-existing bug independent of any migration, found via this phase's fresh transaction/concurrency inventory.
- The two Decimal→`Number()` display-precision exceptions (same source).
- The Server-Component-direct-Prisma-access pattern for the customer catalog and both portal layouts (Dependency Inventory) — not a "bug," but a materially important migration-planning fact that a route-by-route-only inventory (Phase 01's, and most naive migration plans) would miss entirely.
- `SESSION_SECRET` env var is defined in `.env.example` but, per its own comment and confirmed by this phase's auth re-verification, is not actually read by any application code — a small but real stale-documentation item worth cleaning up alongside the migration rather than carrying forward confusion about what's actually load-bearing.

## D. What this phase could not verify (limitations)

- No code was executed — no test suite, no build, no FastAPI code was written or run, per this phase's own strictly-read-only mandate. Every "acceptance criteria" and "gate" in Deliverables 7 and 9 is a **design for verification to be done**, not evidence that it has been.
- The actual production database target (host/provider) was not determined in this phase either, consistent with Phase 01's own deliberate choice not to read `.env` contents.
- Whether any additional Server Action or Server Component beyond those found exists was checked by grep-based methods across the full `src/` tree (confirmed exhaustive for the specific patterns searched: `"use server"`, `new PrismaClient`, `from "@/server/db"`, `from "@/server/**"` in components) — high confidence, but not a line-by-line read of every one of the ~100+ page/component files in the repository.

## E. Implementation readiness

**CONDITIONALLY READY**, same framing as Phase 01, now with a more specific condition: **Phase 0 (baseline verification) must execute and produce a real, recorded pass/fail result before Phase 1 of the Migration Roadmap begins.** Once that baseline exists, and decisions A.1-A.2 (deployment target, proxy topology) are made, Phase 1 (catalog migration + FastAPI skeleton + net-new Admin/Notifications work) can begin immediately — it is the lowest-risk, highest-learning-value starting point, and does not depend on any of the other open decisions in §A.
