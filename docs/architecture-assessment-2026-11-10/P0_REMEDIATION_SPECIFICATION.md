# P0_REMEDIATION_SPECIFICATION.md

Phase 03B — strictly a specification document (revised following mandatory engineering review). **No application code, test, package manifest, CI workflow, or database schema was modified to produce this document.** All claims below are VERIFIED by direct reading of the current repository at HEAD `1f0f61f` (unchanged throughout Phases 03A/03B) unless marked PROPOSED or UNVERIFIED ASSUMPTION.

---

## Revision note (this pass)

The prior version of this document contained a real internal contradiction, caught correctly by review: Option A proposed a relative `stockDelta` applied via atomic `increment`, but its own regression test (A.5) asserted that a *positive* `stockDelta` should be rejected with `409 stock_changed` — those two claims cannot both be true (a relative increment is, by construction, immune to the exact conflict that test was trying to trigger). The review also correctly identified that wrapping a read-then-write in a Prisma `$transaction` does **not**, by itself, prevent a second transaction from modifying the same row in between, at Postgres's default READ COMMITTED isolation (confirmed unchanged from Phase 02's transaction inventory) — my prior design's "re-read inside the same transaction" language implied a protection that READ COMMITTED does not actually provide without an explicit lock.

This revision corrects both issues by **splitting the two frontend call sites into two distinct, intentionally different operation semantics** (relative delta for the stepper; absolute value with an explicit compare-and-swap guard for the dialog), and by being precise about **which of the two actually needs an explicit row lock and which does not, and why** — this turns out to be a materially simpler and more consistent design than my first attempt, not a more complicated one, once the two operations are no longer conflated. It also corrects the CI section's secret-handling design (a hardcoded, clearly-labeled test-only value instead of a GitHub Actions secret, which would silently be unavailable on forked pull requests) and the branch-filter design (verified, not assumed, which branches actually exist in this repository).

**Remaining, explicitly-flagged unresolved assumptions** (not resolved by this revision, carried forward honestly rather than guessed at): (1) whether any caller *other than* this repository's own `ProductsView.tsx`/`ProductDialog.tsx` currently depends on `updateSellerStock`'s existing absolute-value contract — Phase 02's Dependency Inventory found none, but that inventory was not re-run exhaustively in this pass, so this is stated as a carried-forward, previously-established finding, not a freshly re-verified one in this specific revision; (2) the exact pre-existing numeric fixture values inside `src/server/seller/inventory.test.ts`'s current cases (needed to compute the precise delta each adapted call site should use) were cited by line number and by the general transformation required, not hand-recomputed digit-by-digit in this document, since doing so correctly requires reading the full fixture setup in the actual implementation pass, not inferring it here.

---

# Work Package A — Inventory Concurrency Correction (revised)

## A.1 Verified existing behaviour (unchanged from the prior pass, re-stated for context)

### A.1.1 `updateSellerStock` (`src/server/seller/inventory.ts`, lines ~146-169)
Reads the offer fresh via `findFirst`, then writes the **caller-supplied absolute value** as-is, with `status` auto-pausing only when the absolute value is exactly 0 and otherwise left at whatever `current.status` already was (**no auto-reactivation** — confirmed precisely this pass: `status: stock === 0 ? "paused" : current.status`, meaning a positive resulting stock never, on its own, flips a paused listing back to active in this function today).

### A.1.2 `updateSellerProduct` (`src/server/seller/inventory.ts`, lines ~111-144)
Same shape; when `input.stock` is omitted, `nextStock` correctly falls back to the fresh `current.stock` (no race in that sub-case); when provided, identical exposure to A.1.1.

### A.1.3 Both frontend call sites send an absolute value computed from stale data
- `ProductsView.tsx:83-88` (`handleStock`, the Stepper): sends the **resulting absolute number** after a ±10 step, computed client-side from `product.stock` (the last fetch).
- `ProductDialog.tsx:40,114`: seeds its form's `stock` field from `product.stock` at dialog-open time and submits that value in **every** save, even a price-only edit.

### A.1.4 Checkout's stock decrement (`src/server/orders/service.ts:222-226,256-259`) — confirmed safe, and precisely why
Safe for two independent, compounding reasons, both re-confirmed this pass: (1) it is a **relative** `{decrement: qty}`, never an application-computed absolute literal; (2) it additionally takes an explicit, sorted-order `SELECT ... FOR UPDATE` lock on every distinct offer row before touching any of them. **Correction from the prior pass, important for A.4 below: reason (1) alone is already sufficient for safety against a single-row lost-update** — a pure DB-side relative expression (`stock = stock + :delta`) cannot lose a concurrent update even with zero explicit application-level locking, because Postgres's own row-level UPDATE locking (implicit, per-statement, requiring no `FOR UPDATE` clause at all) already serializes two concurrent relative updates to the same row correctly. Checkout's *additional* explicit `FOR UPDATE` lock exists for a **different** reason — to serialize *multiple, different offer rows* in a deterministic order across one multi-item cart, preventing cross-item deadlocks between two concurrent checkouts — not because a single relative update needs it. This distinction is the key correction underpinning A.4's revised design.

### A.1.5 Offer status transitions — existing lifecycle behaviour, inspected precisely (correction: this pass actually inspects it, rather than asserting a rule)
Two call paths exist, with **two different, both-pre-existing, both-intentional behaviours**, confirmed by direct reading:
- **`restoreReservedStock`** (`src/server/orders/lifecycle.ts:45-64`, called from `rejectShipment`/`cancelOrder`): a relative `{increment: qty}` update, followed by an unconditional re-activation (`if (offer.stock > 0 && offer.status === "paused") → "active"`). **This is the system's existing, intentional rule for order-cancellation/rejection-triggered restores specifically**: a listing that ran out of stock and got auto-paused is automatically un-paused the moment a cancellation/rejection gives it stock back. This behaviour is pre-existing and **this specification does not propose changing it.**
- **`updateSellerProduct`/`updateSellerStock`** (the seller-initiated edit paths): confirmed, by direct reading (A.1.1), to **never** auto-reactivate — they only ever auto-*pause* at exactly zero, and otherwise leave `status` exactly as it already was, regardless of whether the resulting stock is positive. **This is also the system's existing, intentional behaviour today, and must be preserved exactly** — per the review's explicit instruction, this specification's correction **must not** introduce new auto-reactivation logic into the seller-edit paths that does not exist in the current code. My prior draft's wording ("apply the... stock-restored-reactivation logic... against the now-correct value") incorrectly implied reactivation belonged in these two functions at all — it does not, today, and the corrected design below removes that implication entirely.

### A.1.6 Fields with no related concurrency risk (unchanged): `price`, `minOrderQty`, `reorderLevel`, `leadTimeDays` (single-writer, the seller only); `createSellerProduct`'s duplicate check (already DB-constraint-safe).

## A.2 Root cause (unchanged): a client-supplied **absolute** target value is trusted without verifying it was computed from still-current data, while a second actor (checkout, or lifecycle restoration) legitimately mutates the same column via a relative change in the interim. Empirically reproduced in Phase 03A (disposable script, deleted after use; final stock `15` instead of the correct `12`, demonstrating the customer's `-3` was silently discarded).

## A.3 Intended behaviour (unchanged, re-stated): first-committed-wins; a write based on data that is no longer current is **rejected**, never silently applied, and the caller is told to retry against fresh data — matching the `409 invalid_transition` philosophy already used for shipment-status transitions elsewhere in this codebase.

## A.4 Corrected design — two distinct operations, two distinct guarantees

### A.4.0 Evaluation: one endpoint with a discriminated contract, vs. two endpoints with one clear semantic each

Evaluated both; **recommending two single-purpose contracts, matching the two existing, already-separate endpoints and their two already-separate, single real call sites** (`PATCH .../stock` ← Stepper only; `PATCH .../[offerId]` ← Dialog only), rather than one combined, mode-discriminated schema on either endpoint. Reasoning: each endpoint already has exactly one real caller in this codebase (confirmed, Phase 02's Dependency Inventory), each caller already has one clear intent (the Stepper is inherently relative — it is a `±10` control; the Dialog is inherently absolute — it is a typed-number field), and forcing either endpoint to support both modes via a discriminated union would add branching complexity to satisfy a use case (another, unknown future caller wanting the *other* mode on the *same* endpoint) that does not exist today — directly against requirement 8 ("do not introduce unnecessary architectural changes").

### A.4.1 Stepper (`PATCH /api/seller/products/[offerId]/stock`) — relative delta, no explicit lock needed

**Deliberate, named exception to "preserve existing contracts," explicitly sanctioned by this review's own direction ("treat ± adjustments as relative operations"):** this endpoint's single request field changes meaning, from `stock` (absolute) to `stockDelta` (signed relative integer). This is scoped to exactly one endpoint with exactly one known caller, which this specification also updates (A.4.3); it is not applied to `updateSellerProduct`.

**Service logic** (no explicit `FOR UPDATE` needed — see A.1.4's corrected reasoning: a pure relative DB-side expression is already safe):
```
updated = tx.sellerOffer.updateMany({
  where: { id: offerId, sellerId, stock: { gte: stockDelta < 0 ? -stockDelta : 0 } },
  data: { stock: { increment: stockDelta } },
});
if (updated.count !== 1) {
  const exists = await tx.sellerOffer.findFirst({ where: { id: offerId, sellerId }, select: { id: true } });
  if (!exists) throw new ApiError(404, "offer_not_found", "Listing not found");
  throw new ApiError(409, "insufficient_stock", `Not enough stock to remove ${-stockDelta} units`); // reuses the existing error code already used by checkout/cart for the same concept, rather than inventing a new one
}
if (stockDelta !== 0) {
  // Safe to read "our own" just-committed value within this same transaction;
  // this does NOT need a lock because we are only ever pausing (never
  // reactivating) based on this read — see A.1.5 for why reactivation must
  // not happen here at all, lock or no lock.
  const after = await tx.sellerOffer.findUnique({ where: { id: offerId }, select: { stock: true, status: true } });
  if (after.stock === 0 && after.status === "active") {
    await tx.sellerOffer.update({ where: { id: offerId }, data: { status: "paused" } });
  }
  // Deliberately no "else if (after.stock > 0 && after.status === 'paused') → active" branch:
  // preserves A.1.5's confirmed existing no-auto-reactivation rule exactly.
}
```
**Why the existence pre-check (for 404 vs. 409 disambiguation) is itself safe without a lock**: `SellerOffer` rows are never deleted anywhere in this codebase (confirmed, FK `onDelete: Restrict`, and no delete function exists for this model — Phase 02's Backend Dependency Inventory), and `sellerId` is immutable once set, so a row that exists at the pre-check cannot have stopped existing or changed owner by the time of the guarded update a moment later — the only thing that can have changed is `stock`, which is exactly what the guarded `updateMany`'s own `WHERE` clause already re-checks atomically.

### A.4.2 Dialog (`PATCH /api/seller/products/[offerId]`) — absolute value, explicit compare-and-swap, **requires** an explicit row lock

This is the one case that genuinely needs `SELECT ... FOR UPDATE` (reusing the exact existing `lockOffer` primitive currently private to `src/server/cart/service.ts:264-266` — **proposed to be relocated to a shared location, e.g. `src/server/db/locks.ts` or exported from `lifecycle.ts`, and imported by both `cart/service.ts` and `inventory.ts`, rather than duplicated** — a small, additive refactor, not a new technique), because it is fundamentally a "read something, let the application decide a new absolute value, write that absolute value" pattern — the one class of operation a pure relative DB-side expression cannot express.

**Schema**: `updateSellerProductSchema` gains one new optional field, `expectedStock: number`, coupled to `stock` via a `.refine()`: **if `stock` is present, `expectedStock` must also be present, and vice versa** (both-or-neither) — this is stricter than my prior draft's "optional guard," specifically closing the footgun of a client silently sending `stock` without the matching guard.

**Service logic**:
```
await lockOffer(tx, offerId); // reused, shared primitive — SELECT "id" FROM "SellerOffer" WHERE id=? FOR UPDATE
const current = await tx.sellerOffer.findFirst({ where: { id: offerId, sellerId }, include: offerInclude });
if (!current) throw new ApiError(404, "offer_not_found", "Listing not found");

if (input.stock !== undefined) {
  if (current.stock !== input.expectedStock) {
    throw new ApiError(409, "stock_changed", "Stock was changed by another process — reload and try again");
  }
}

const nextStock = input.stock ?? current.stock;              // unchanged shape from today
let nextStatus = input.status ?? current.status;              // unchanged shape from today
if (nextStock === 0 && input.status === undefined) nextStatus = "paused"; // unchanged: auto-pause only
// Deliberately NO auto-reactivation branch here either — same A.1.5 rule applies.

const data = { stock: nextStock, status: nextStatus, ...(other optional fields unchanged) };
const offer = await tx.sellerOffer.update({ where: { id: current.id }, data, include: offerInclude });
```
Because the row is locked from `lockOffer` through to this `update`, and both happen inside one transaction that only commits (releasing the lock) after the write, **no other transaction can modify this row in between the guard check and the write** — this is the precise fix for the review's core correctness concern, which a bare `$transaction` wrapper alone (my prior draft's mistake) does not provide at READ COMMITTED.

**"Omit all stock fields entirely" (price-only save)**: when `input.stock === undefined`, the code path above never touches `expectedStock`, never compares anything, and writes exactly the same unconditional (lock-free, since there is no concurrent writer of `price`/`minOrderQty`/etc. per A.1.6) update it does today. **The frontend change required** (out of scope to implement in this phase): `ProductDialog.tsx`'s submit handler must only include `stock`/`expectedStock` in its payload when the seller actually changed the stock field in that dialog session (e.g. compare `form.stock !== product.stock` at submit time), never send them unconditionally as it does today.

### A.4.3 Frontend call-site changes required (specified, not implemented)
- `ProductsView.tsx`'s `handleStock`: change from `updateSellerStock(product.offerId, stock)` (absolute) to `updateSellerStock(product.offerId, stockDelta)` where `stockDelta` is computed from the Stepper's own already-known step direction/amount (the Stepper component already tracks `value` vs. its prior value; `handleStock` gains a one-line `const delta = newValue - product.stock`).
- `ProductDialog.tsx`: only populate `stock`/`expectedStock` in the submitted payload when the dialog's stock field was actually touched; otherwise omit both entirely.
- Both files must handle the new `409 stock_changed` error via the existing `messageOf(error)` pattern already used throughout `ProductsView.tsx` for every other `ApiClientError` case (Phase 01/02, confirmed present) — surfacing a clear "stock changed, please reload" toast, not a generic failure message.

### A.4.4 Requirement-by-requirement check (corrected)
1. **No silent overwrite**: satisfied by both paths — the stepper can never discard a committed change (pure relative math); the dialog explicitly rejects a stale write.
2. **Intended behaviour defined**: A.3, unchanged from the prior pass, now correctly implemented by two mechanisms matched to their actual needs rather than one conflated mechanism.
3. **Preserve contracts**: `SellerProductDto` (response) fully unchanged; `updateSellerProduct`'s existing non-stock fields fully unchanged; the one deliberate, named, scoped exception is the stepper endpoint's single field (A.4.1), explicitly called out rather than silently introduced.
4. **Zero-stock pause preserved**: both paths auto-pause at exactly zero, computed from the correct (post-guard, in the dialog's case lock-protected) value.
5. **Checkout/transactions untouched**: confirmed — this design touches only `inventory.ts`, its validation schema, and `lockOffer`'s export location; `src/server/orders/**` and `src/server/cart/service.ts`'s own logic are unmodified (only `lockOffer`'s visibility changes, not its behaviour).
6. **No new deadlocks**: the dialog path locks exactly one row per request (no multi-row lock ordering is introduced, unlike checkout's multi-offer case); the stepper path takes no explicit lock at all. Neither introduces a new deadlock surface.
7. **Correct Postgres primitives, now precisely justified**: relative DB-side expressions for the stepper (inherently safe, no lock needed — A.1.4's corrected reasoning); explicit `SELECT ... FOR UPDATE` for the dialog (the one case that genuinely requires it, correctly identified this pass).
8. **No unnecessary architectural change**: two endpoints, two matched semantics, one relocated (not duplicated) existing primitive — no new technique is introduced that this codebase doesn't already use somewhere.

## A.5 Deterministic regression test design (corrected and expanded — 6 new specified cases + 1 execution/acceptance requirement, per the review's 7-item list)

**Determinism principle, stated once, applying to every test below**: every "concurrent" scenario is constructed by performing the two actions **sequentially, in a specific, deliberately-chosen order, as two separate awaited statements within one test function** — never via real parallel execution, `Promise.all` races, or any timing-based sleep. This deterministically reproduces a specific interleaving of interest (e.g., "a checkout commits, and only afterward does a seller's stale-based request arrive") by construction, not by chance — the same technique already used, and already proven reliable, by this repository's own existing concurrency tests (e.g. `driverService.test.ts`'s "cannot deliver twice under concurrent submissions") and by Phase 03A's own empirical reproduction script.

All six new tests below are proposed additions to `src/server/seller/inventory.test.ts`, following its existing `withRollback` transaction-scoped-rollback pattern (leaves no trace; matches every existing case in that file).

**1. Relative stock increase preserves a previously committed checkout decrement.**
```
seed offer stock=10 →
simulate a committed checkout: updateMany({where:{id,stock:{gte:3},status:"active"}, data:{stock:{decrement:3}}}) — real stock now 7 →
call the corrected updateSellerStock(seller.id, offerId, +5, tx) →
assert result.stock === 12 and a fresh findUnique also reads 12.
```

**2. Relative stock decrease rejects a resulting-negative stock.**
```
seed offer stock=5 →
call updateSellerStock(seller.id, offerId, -8, tx) →
expect rejection: { status: 409, code: "insufficient_stock" } →
assert real stock is still 5 (the rejected call had zero effect).
```

**3. Stale absolute stock update returns `409 stock_changed`.**
```
seed offer stock=10 →
simulate a committed checkout decrement of 3 (real stock now 7) →
call updateSellerProduct(seller.id, offerId, { stock: 15, expectedStock: 10 }, tx) →
expect rejection: { status: 409, code: "stock_changed" } →
assert real stock is still 7 (the rejected write had zero effect, unlike today's reproduced bug).
```

**4. ProductDialog price-only save leaves stock unchanged.**
```
seed offer stock=10, price=100.00 →
call updateSellerProduct(seller.id, offerId, { price: new Prisma.Decimal("120.00") }, tx) — no stock, no expectedStock →
assert price is now 120.00 and stock is still exactly 10 (unexamined, unguarded, untouched).
```

**5. ProductDialog stock edit succeeds when `expectedStock` matches current reality.**
```
seed offer stock=10 →
call updateSellerProduct(seller.id, offerId, { stock: 20, expectedStock: 10 }, tx) →
expect success; assert real stock is now exactly 20.
```

**6. Concurrent stock restoration and seller edits preserve correct status in both directions** (two sub-cases, both needed per A.1.5's two distinct, both-preserved behaviours):
```
6a. (restoreReservedStock DOES reactivate — existing, unchanged behaviour):
seed offer stock=0, status="paused" (simulating a prior auto-pause from stockout) →
call restoreReservedStock(tx, [{ sellerOfferId: offerId, qty: 5 }]) (simulating an order cancellation) →
assert status is now "active" (matches today's existing, confirmed, unmodified lifecycle.ts behaviour).

6b. (a seller's own relative edit does NOT reactivate — the rule this correction must not violate):
seed offer stock=5, status="paused" (simulating a seller's OWN intentional pause, unrelated to stockout) →
call the corrected updateSellerStock(seller.id, offerId, +5, tx) (stock becomes 10) →
assert status is STILL "paused" — the seller's own stock-increasing edit must not silently un-pause
a listing the seller (or the system, for any reason) had set to paused.
```

**7. Existing checkout idempotency and inventory tests remain green — execution requirement, not a new test design, and the one item in this list that is honestly not yet verifiable from a specification alone:**
- `src/server/orders/service.test.ts` (checkout idempotency and all its other cases) is **not modified by this work package at all** (A.4.4 point 5) and is expected to continue passing unchanged — this is a re-run requirement for the actual implementation phase, not something this specification can claim has been executed.
- `src/server/seller/inventory.test.ts`'s **two existing cases must be adapted**, not left byte-for-byte identical, because `updateSellerStock`'s third parameter's meaning is deliberately changing (A.4.1): the existing call at line ~87 (`updateSellerStock(seller!.id, created.offerId, 0, tx)`, setting an absolute target of 0) must become a delta equal to *negative the fixture's then-current stock value* at that point in the test (the exact number depends on the fixture's own prior stock value as set earlier in that same test, which this specification does not re-derive here — flagged explicitly in the Revision Note as an unresolved-in-this-pass detail for the implementer to read directly off the fixture). The existing call at line ~114 (`updateSellerStock(seller!.id, otherOffer!.id, 999, tx)`, the cross-seller-ownership-rejection case) needs **no numeric change at all** — it asserts a `404` before any stock arithmetic is ever reached, so its behaviour is identical regardless of whether `999` is interpreted as absolute or delta. **This specification does not claim these adapted tests have been run; it specifies precisely what must change and why, for the implementation phase to execute.**

## A.6 Work Package A — GO / NO-GO

# **GO**, conditioned on this revised design (A.4) being the one implemented — not the prior, internally-contradictory draft.

Acceptance criteria (revised): (1) all 6 new tests in A.5 are added and, run against the corrected implementation, pass; (2) the 2 existing `inventory.test.ts` cases are adapted per A.5 item 7 and pass; (3) `orders/service.test.ts` passes unmodified; (4) a manual or automated check confirms non-stock edits (price/minOrderQty/reorderLevel/leadTimeDays) are provably unaffected by either guard path. **None of these four have been executed in this phase** — this remains a specification.

**Rollback consideration** (revised): the stepper endpoint's contract change (A.4.1) is a **deliberate, non-additive** change to one field's meaning on one endpoint — rolling back requires reverting both the service function and its one known caller (`ProductsView.tsx`) together, not merely deleting new code, since the old caller would no longer compile/function correctly against a reverted absolute-value service function if the frontend had already been updated to send a delta. This is a precise, bounded, two-file rollback (service + one component), not a data-level concern (no schema change is part of either path).

---

# Work Package B — CI and Typecheck Correction (revised)

## B.1 Verified existing behaviour (corrected/expanded this pass)

- **Workflow discovery failure**: unchanged finding — no `.github/` directory exists at the actual repository root at all.
- **Branch reality, verified this pass (not assumed)**: `git branch -a` confirms three branches exist: `main`, `feature/backend-mvp` (current, checked-out), `feature/customer-portal`. **`master` does not exist in this repository at all.** `git rev-list --count main..feature/backend-mvp` = **15** (feature/backend-mvp is 15 commits ahead of main); `git rev-list --count feature/backend-mvp..main` = **0** (main has nothing feature/backend-mvp lacks). **Correction to the prior draft**: the original (undiscovered) workflow's branch filter, `[main, master]`, would — even if correctly relocated with no other change — **still never trigger for the actual, active development branch** (`feature/backend-mvp`), only for the stale `main`. The corrected workflow design (B.2.1) must explicitly include `feature/backend-mvp`.
- **Node version, dependency strategy**: unchanged findings (Node 22 confirmed via `Dockerfile`/`render.yaml`; `npm ci` already correct in the original workflow).
- **Why `typecheck` has no script**: unchanged finding — simple omission, no technical blocker; `npx tsc --noEmit` confirmed (Phase 03A) to run cleanly with zero errors.

## B.2 Proposed changes (corrected)

### B.2.1 Relocated, corrected workflow (repo root: `.github/workflows/ci.yml`)
```yaml
name: CI
on:
  push:
    branches: [ main, feature/backend-mvp ]   # verified-existing branches only; "master" removed (confirmed not present)
  pull_request:
    branches: [ main, feature/backend-mvp ]   # covers PRs targeting either the stale default branch or the active work branch
jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    defaults:
      run:
        working-directory: app
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: constrowell_ci
        ports: [ "5432:5432" ]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://test:test@localhost:5432/constrowell_ci?schema=public
      # TEST-ONLY KEY — a fixed, 32-zero-byte value, base64-encoded. Never a
      # real secret: committed in plaintext intentionally, since this CI
      # database is ephemeral and destroyed at the end of every run, and no
      # production OTP value is ever encrypted/decrypted with this key. A
      # production deployment must never source OTP_ENCRYPTION_KEY from this
      # file — it is sourced from the platform's real secret store (Render
      # env var / GCP Secret Manager per the Phase 02 deployment plan),
      # which this workflow never reads from and has no access to.
      OTP_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: app/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npx prisma migrate deploy
      - run: npm run test
      - run: npm run build
```

**Forked-PR assessment (new this pass, directly addressing the review's instruction)**: GitHub Actions does **not** expose `secrets.*` to workflows triggered by a `pull_request` event from a forked repository (a deliberate GitHub security restriction, to prevent an external contributor's PR from exfiltrating a repository's real secrets). My prior draft's `secrets.CI_OTP_ENCRYPTION_KEY` reference would therefore have resolved to an **empty string** for any fork-originated PR, causing `OTP_ENCRYPTION_KEY`'s own startup validation (confirmed, Phase 01/02: the module throws if the key is absent or not exactly 32 bytes) to fail — meaning CI would report a failure that has nothing to do with the actual code change being reviewed, for the specific and easily-missed reason of "this PR came from a fork." **Corrected**: a plain, hardcoded `env:` value (not a `secrets:` reference) is available identically to every workflow trigger, fork-originated or not, and is the right choice here specifically *because* it is not meant to be a real secret at all.
- **Confirmation that the test key cannot be used in production**: the value above is a trivially-recognizable, all-zero-byte placeholder, present only in a world-readable CI workflow file; the real production key is provisioned exclusively through the platform's own secret-management mechanism (Render environment variable today; GCP Secret Manager if that migration proceeds per Phase 02), which this CI workflow has no credentials to read from and no code path that could cause it to be overwritten. **Recommended follow-up safeguard, out of scope to implement in this read-only phase**: add an application-level startup check that rejects this exact known test value (or any value matching an obviously-synthetic pattern) whenever `NODE_ENV === "production"`, as defense-in-depth against a future copy-paste mistake — noted here as a PROPOSED hardening recommendation, not claimed as done.

### B.2.2 `typecheck` script (unchanged from the prior draft — this part of the review raised no objection)
```json
"typecheck": "tsc --noEmit"
```

### B.2.3 Second-run freshness (requirement 4, "a second run starting from a fresh database")
Because `services.postgres` is a fresh container created per job run (standard GitHub Actions behaviour — the service container does not persist between separate workflow runs, only within the steps of one single run) and `prisma migrate deploy` is the only schema-affecting command executed against it, **every run of this workflow starts from an empty, freshly-migrated database by construction** — this is a property of using a `services:` container (not a persistent, externally-provisioned database) rather than something that needs a separate mechanism to enforce. This satisfies the requirement without any additional step.

## B.3 Work Package B — GO / NO-GO

# **GO**

Acceptance criteria (carried forward, one corrected): (1) a push/PR to `main` or `feature/backend-mvp` (verified-correct branch names, not the prior draft's unverified `[main, master]`) shows a discovered, running GitHub Actions check; (2) `typecheck`/`lint`/`test`/`build` steps each reproduce this phase's already-observed local PASS results, inside the CI environment specifically; (3) a PR opened from a fork of this repository (if the hosting plan/visibility allows forking at all — UNVERIFIED ASSUMPTION, not checked in this phase, since this repository's current visibility/fork settings were not inspected) completes successfully using the hardcoded test key, with no dependency on any repository secret being configured; (4) two independent workflow runs each start from a schema-only, zero-row database, verified by asserting row counts immediately after `prisma migrate deploy` and before any test executes.

**Rollback consideration** (unchanged): purely additive files/lines; reverting is a plain deletion with no data or schema implication.

---

## Files the implementer is permitted to modify (unchanged scope, revised to reflect A.4's exact design)
- `app/src/server/seller/inventory.ts` (the corrected fix)
- `app/src/server/seller/validation.ts` (the `stockDelta` field on the stock-only schema; the coupled `expectedStock` field on the product schema)
- `app/src/server/cart/service.ts` (relocating/exporting `lockOffer` only — no behavioural change to any function in this file)
- `app/src/server/seller/inventory.test.ts` (the 6 new cases in A.5, plus the 2 adapted existing-case call sites)
- `app/src/components/seller/ProductsView.tsx`, `app/src/components/seller/ProductDialog.tsx` (call-site updates per A.4.3)
- `app/package.json` (the new `typecheck` script — additive line only)
- `.github/workflows/ci.yml` (new file, repo root)

## Files that must remain untouched (unchanged from the prior draft)
- `app/prisma/schema.prisma` and everything under `app/prisma/migrations/`
- `app/src/server/orders/**` (confirmed, this revision still touches nothing here — `lockOffer`'s relocation only changes its export visibility in `cart/service.ts`, not any orders-domain file)
- Real environment files or credentials
- `render.yaml`, `app/Dockerfile`, `app/docker-compose.yml`
- The existing, currently-undiscovered `app/.github/workflows/playwright.yml` (leave in place until the new root-level workflow is confirmed working)

No code was implemented, no dependency was installed, no database was written to, and nothing was committed, pushed, or deployed in the production of this revision.
