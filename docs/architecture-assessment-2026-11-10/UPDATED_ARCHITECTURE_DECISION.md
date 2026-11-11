# UPDATED_ARCHITECTURE_DECISION.md

Phase 02 — Deliverable 1 of 10. Status: **PROPOSED** (architecture/planning document; the organizational stack requirement itself is stated as confirmed by the owner in this phase's brief, not proposed by this document).

## 1. What changed since Phase 01

Phase 01's `BACKEND_ARCHITECTURE_DECISION.md` treated "is Python/FastAPI a genuine organizational requirement, or a preference to weigh against migration cost" as the single most load-bearing open question (listed in `OPEN_QUESTIONS_AND_ASSUMPTIONS.md` §1.1), and recommended, *conditional on that question*, a narrowly-scoped hybrid (new work only in FastAPI, existing Next.js business logic untouched).

**This phase's brief answers that question directly and unconditionally: "The company has now confirmed that Constro-Well must follow the technology stack used by its other products" — React frontend, Python backend, PostgreSQL database — stated as "non-negotiable."** This supersedes Phase 01's conditional framing. It does **not**, by itself, answer the second-order question Phase 01 also raised (full rewrite vs. incremental/hybrid) — that is what this phase's blueprint exists to design.

## 2. Target architecture, as now confirmed

- **Frontend**: Next.js + React + TypeScript — **unchanged, explicitly approved, explicitly not to be replaced with plain React/Vite.** This is a material constraint this document takes as fixed: every migration-sequencing decision below assumes the frontend keeps running exactly as it does today throughout the migration, consuming a mix of old (Next.js) and new (FastAPI) endpoints at different points in the timeline.
- **Backend**: Python, FastAPI specifically named (consistent with, not contradicting, Phase 01's own FastAPI-component evaluation in `BACKEND_ARCHITECTURE_DECISION.md §2`, which remains valid and is not re-litigated here).
- **Database**: PostgreSQL — unchanged, the one layer that was already shared infrastructure and needs no migration of the data store itself, only of the ORM/migration tooling that manages its schema (Deliverable 5).

## 3. Decision: incremental migration, not a rewrite, and why

**Recommendation: incremental, workflow-by-workflow migration, keeping both Next.js API routes and FastAPI endpoints live simultaneously for an extended coexistence period, not a big-bang cutover.**

Reasoning, each point directly addressing this phase's own stated scrutiny priorities:

1. **Authentication continuity** (explicitly named as a scrutiny priority): a big-bang cutover would require every existing session token to remain valid at the exact moment of cutover, with zero tolerance for a bug in the reimplemented auth check. An incremental migration can instead stand up the identical session-validation logic in FastAPI *first*, run it side-by-side against the same `Session` table the Next.js app already writes to, and prove equivalence (same user, same role, same session, validated two ways, compared) *before* any real traffic depends on it exclusively. This is categorically safer than "migrate auth last because it's scary" or "migrate everything including auth in one deploy."
2. **Database ownership** (explicitly named as a scrutiny priority): a rewrite-everything-then-cut-over approach tempts a team into letting both Prisma and Alembic "own" the schema simultaneously for the whole migration window, which is exactly the two-migration-system conflict this phase explicitly forbids. An incremental approach makes it possible to designate **Prisma as the sole schema-migration authority for the entire migration period** (Deliverable 5 elaborates), with Alembic only ever applied to a frozen, already-Prisma-created schema in a read/write-but-never-migrate capacity until a final, deliberate, separately-decided cutover of migration ownership itself — which this document does not assume happens in the same project phase as the application-logic migration.
3. **Financial correctness** (explicitly named as a scrutiny priority): checkout/escrow/settlement are the single highest-risk, highest-consequence domain in this codebase (Phase 01 found zero defects here and a genuinely sound design — Decimal-exact money, row-locked concurrency, idempotent order placement). The incremental plan deliberately sequences this domain **last among business-logic migrations, not first** (Deliverable 9), migrating lower-risk, currently-nonexistent-or-mock domains (Admin, notifications, file uploads — all net-new, zero regression risk by definition) before ever touching the one area where a reimplementation bug has real financial consequence.
4. **A big-bang rewrite would also contradict this phase's own stated principle** ("We are migrating the backend architecture of an existing product, not rebuilding Constro-Well from scratch... prioritize correctness and controlled migration over speed of rewriting") and this repository's own demonstrated process risk (Phase 01 found stale documentation and an inactive CI as recurring patterns — a large, fast, all-at-once migration is exactly the kind of effort that this specific team's demonstrated documentation/process discipline is least equipped to execute safely without a regression surfacing silently).

## 4. What this decision does NOT resolve (carried into Deliverable 10)

- The exact calendar/organizational timeline for the migration (business decision, not architectural).
- Whether the *final* state is "100% FastAPI, Next.js is a pure frontend with zero API routes" or "Next.js retains a small number of routes indefinitely for frontend-only concerns" (e.g., anything that's really just Server-Component data-fetching convenience with no independent business meaning — see Deliverable 2). This document assumes the former as the eventual target (consistent with "the entire backend" in this phase's own title) but treats the exact boundary of "is this really backend logic, or frontend rendering convenience" as something Deliverable 2's findings should settle case-by-case, not as a premise.
- Who (team composition, Python expertise level) actually executes the FastAPI side — an organizational/staffing question, not an architectural one, but one that should inform how aggressively Deliverable 9's roadmap can be sequenced.
