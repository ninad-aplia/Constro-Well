# HANDOFF.md - current checkpoint for the next IDE

**Last updated:** 2026-11-12 (release candidate commit; production verified read-only) · **Writer agent:** OpenCode

## Release candidate (2026-11-12) - committed, deliberately not pushed

- **Commit:** `6895884` "feat: seller-collected COD finance, disputes/refunds and portal workflows" on `feature/backend-mvp` (90 files: WP-1 finance, WP-2 disputes/refunds, C4/C5/D6/D8/B8, migrations, tests, docs). Excluded from the commit: `app/check-*.cjs`, `app/tmp-*.cjs`, `app/tests/tmp-diag*.spec.ts`, `app/tests/example.spec.ts`, `artifacts/` (generated demo media/build logs), `app/.github/`, and `app/.env` (git-ignored).
- **Verification before commit:** `pytest tests` **350 passed** (the 4 catalogue contract-equivalence tests need a live Next API; they pass 14/14 with `NEXT_API_URL` set), Vitest **182/182**, `tsc --noEmit` 0, `eslint src` 0, `npm run build` 0. Fixed one release-blocking test defect: `tests/finance/test_collection.py` asserted a global audit count; it now asserts the delta. Also removed the local E2E orders/collections/assessments created during the previous phase (they made the assessment-run suite depend on an empty finance table).
- **Push state:** `origin/feature/backend-mvp` is at `344f16b`; a dry-run push shows a clean fast-forward `344f16b..6895884` (no force, credentials available via the Windows manager helper).
- **Why it is not pushed yet:** the new code selects `SellerOffer.bulkTiers` and uses the `picked_up` / `commission_credit` enum values. The production database's migration level cannot be confirmed from this environment (no Supabase connection string or dashboards here), and migrations `20261112120000_add_picked_up_shipment_status`, `20261112180000_add_seller_offer_bulk_tiers`, `20261112190000_add_commission_credit_adjustment_type` must be applied to Supabase **before** this code serves traffic or product/seller pages will fail on the missing column/values. Pushing first would deploy un-migrated code against live data, so the deploy is deliberately held.
- **Production snapshot (read-only, 2026-11-12):** Render service `constro-well` (Blueprint `render.yaml`, rootDir `app`, Node 22, `node .next/standalone/server.js`, health check `/api/health`) is live at `https://constro-well.onrender.com`; `/api/health` → `200 {"status":"ok","database":"ok"}`; `/`, `/search?q=cement`, `/product/0`, `/login`, `/register`, `/cart` → 200. Demo seed accounts do not exist there (admin/seller/driver login → 401), so authenticated portal and workflow smoke tests could not run against production.
- **Render branch evidence:** `render.yaml` exists only on `feature/backend-mvp` (committed in `75ecef0`), not on `main`; the service therefore deploys that branch. No Render/Supabase API credentials exist in this environment, so services, env values and logs could not be inspected directly.
- **Owner action to finish the release (in order):** 1) apply the three pending migrations to Supabase from `app/` with the production `DATABASE_URL` (`npx prisma migrate deploy` — never `migrate dev`/`db push`/reset); 2) confirm `APP_ORIGIN`, `DATABASE_URL`, `OTP_ENCRYPTION_KEY` on the Render service; 3) `git push origin feature/backend-mvp` (fast-forward, no force); 4) watch the Render deploy and re-run `/api/health` plus the authenticated smoke checks; 5) optionally seed demo accounts on a database that is intended to be a demo.

## Cross-portal workflow verification (2026-11-12) - no defects found, no code changed

Method: production build on `:3022` (`next start`, `FASTAPI_BASE_URL`/`FINANCE_API_URL` → fresh FastAPI `:8022`), driven with real HTTP sessions for the seeded demo accounts (no mocks, no browser). Ran the actual customer → seller → driver → admin journey.

- **Customer:** `/api/products/0/offers` → add to cart (min-order enforced) → cart totals → COD checkout (`POST /api/orders`, idempotency key) → order detail with per-seller shipment, `review` OTP visibility, stage tracking. Cancellation before dispatch: stock 380 → 370 → 380, shipment and `CodCollection` cancelled, repeat cancel `409`.
- **Seller:** orders board → accept → pack → dispatch (bulk order correctly demands a weighbridge reference) → COD collections list → confirm collection.
- **Driver:** jobs list → pickup → deliver with the customer-visible OTP → shipment `review`, order stage advances.
- **Admin:** `/api/admin/{orders,shipments,disputes,users,sellers,audit-events}` and finance reads all `200`; `/admin`, `/admin/orders`, `/admin/shipments`, `/admin/disputes`, `/admin/finance`, `/admin/users`, `/admin/sellers`, `/admin/activity` all render `200` authenticated.
- **Live WP-2 chain re-proved on real data** (order `BG-282342`, COD confirmed 3982): customer report issue → shipment `disputed`; admin detail shows cap 3982 and COD `confirmed`; seller refund request with evidence; admin approves 100 → shipment `settled`, `customer_refund` + `commission_credit` 5.00 applied, seller statement `creditApplied 5.00 / creditBalance 5.00`; duplicate resolution `409`. The temporary 5% policy was deleted afterwards; the refund records are genuine bookkeeping for that dev order.
- **Suites:** `pytest tests` **374/374** with a live Next server (`NEXT_API_URL=http://127.0.0.1:3022`); without one, the 4 catalogue contract-equivalence tests fail only because they compare FastAPI against the Next API (environmental, not a defect). Focused admin+finance **295/295**, dispute suite **11/11**.

Dev-data notes: E2E orders `BG-750947` (delivered + settled dispute), `BG-971564` (cancelled), `BG-282342` (delivered, settled with a 100.00 refund and 5.00 commission credit) exist in the local DB; no policies remain.

## Last completed task (WP-2 - Admin dispute & refund resolution - 2026-11-12)

Branch `feature/backend-mvp` @ `344f16b` - nothing committed, staged, pushed or deployed. C4, C5, D6, D8, B8 and the other uncommitted work are untouched.

**Owner policy applied (decision #3 now resolved, see `OPEN_OWNER_DECISIONS.md`).** Sellers request a `customer_refund` with reason + evidence; an admin authorises and applies it; the seller/driver pays the customer in cash; the platform records and audits only. Approvals are capped by `ShipmentIssue.claim` (damaged goods with no claim: confirmed COD), the COD collection must be `confirmed`, and an approved refund reduces commission proportionally at the policy rate.

- **Schema:** one additive migration `20261112190000_add_commission_credit_adjustment_type` (adds `SellerAdjustmentType.commission_credit`). No table/column changes.
- **Backend:** `backend/fastapi_app/domains/disputes/service.py` + `routers/disputes.py` + `schemas/disputes.py` + `models/orders.py` (`ShipmentIssue` read mapping) + `models/finance.py` enum. `GET /api/admin/disputes`, `GET /api/admin/disputes/{shipmentId}`, `POST /api/admin/disputes/{shipmentId}/resolve`. Resolution is row-locked, admin-only, requires a reason (evidence too when approving), validates `0 < amount ≤ cap` server-side, is idempotent (a resolved dispute is 409 and disappears from the queue but stays readable), and writes `ShipmentEvent` + `admin.disputes.resolve` audit + finance audit rows in one transaction.
- **Accounting:** an approval creates an applied `customer_refund` (seller-funded cash; the platform never moves money) plus an applied `commission_credit` = refund × rate (the assessment's rate when one exists, else the active policy rate), `Decimal` 2dp half-up. Statement: `outstanding = max(0, assessed − netAllocated − credits)`, surplus exposed as `creditBalance`, `creditApplied`/`commissionCredits` on `/seller/finance`. The original `CommissionAssessment` is never mutated; a duplicate credit is 409; reversing the refund auto-reverses its credit (manual refunds without a credit are a no-op). Rejection closes the shipment `settled` with no adjustments; full approval closes it `refunded`, partial `settled`.
- **UI:** `Disputes` admin nav item, `/admin/disputes` queue, `/admin/disputes/[shipmentId]` detail (issue/claim/COD/lines/events, refund cap + commission source, seller request) and `AdminDisputeResolveForm` (server-recomputed preview, blocked-approval banner that still allows rejection). Seller refund form now requires evidence and can link the request to a shipment.
- **Verified 2026-11-12:** focused `backend/tests/admin/test_admin_disputes.py` **11/11**; full `pytest tests/admin tests/finance` **295/295**; Vitest **182/182**; `npx tsc --noEmit` 0; `npx eslint src` 0; `npm run build` 0. Authenticated browser walkthrough (Playwright, chromium, production build on `:3015` + FastAPI `:8030`) **5/5**: seller records an evidenced request linked to a dispute; admin approves in full (INR 60 → refund 60.00, commission reduction 3.00, shipment `refunded`); admin cannot approve an unconfirmed-COD dispute but can reject it (`settled`); seller statement shows the commission credits; unauthenticated `/admin/disputes` redirects to login. Fixture rows (`BG-WP2-1/2`) and the temporary 5% policy used for the walkthrough were deleted afterwards, restoring the seeded DB.
- **Fixed during verification:** the detail route read `params.id` while the folder is `[shipmentId]` (always 404); resolving then refreshing 404'd because detail only served open disputes; rejection was wrongly gated on confirmed COD + policy (a stuck collection could trap a dispute forever); a no-claim cap was applied to non-damaged issue types.
- **Local data note:** the walkthrough's own rows (`BG-WP2-1`, `BG-WP2-2`) and the temporary 5% policy were deleted afterwards. The seeded damaged-goods dispute `BG-50221` is now `settled` with an "Admin rejected the refund claim" `ShipmentEvent` from the rejection walkthrough (its issue/claim/history are intact); re-seeding the demo data restores it to `disputed`.
- **Next:** finish task 7.4's remaining admin-console scope (reassign rejected/timed-out shipments, late nudges, failed attempts, vendor scorecards) - see `TASKS.md`.

### Environment notes discovered this session
- Local Postgres 18 listens on `127.0.0.1:5433` (Windows service `postgresql-x64-18`). Its `max_connections` is 100 and every `next start`/`uvicorn` process holds a pool - running several verification servers concurrently exhausts it (`sorry, too many clients already`). Run one backend + one frontend, and stop the ones you are done with.
- For browser verification prefer the production build: `next start -p <free port>` from `app/` with `FASTAPI_BASE_URL`/`FINANCE_API_URL` pointing at the FastAPI port. `next start` warns about `output: standalone`, but it serves correctly; `next dev` on a copied instance went into a Fast Refresh reload loop, so avoid multiple dev servers.
- Killing **all** `python -m uvicorn` processes also stops the pre-existing `:8000` dev backend; restart it with `uvicorn fastapi_app.main:app --host 127.0.0.1 --port 8000 --log-level warning` if the `:3000` dev server is in use.

## Last completed task (B8 - Per-offer bulk pricing - task 6.7 - 2026-11-12)

Branch `feature/backend-mvp` @ `344f16b` - nothing committed, staged, pushed or deployed.

**Scope:** matrix B8. Previously every offer used the same global tiers; `Product.bulkFlag` only marks bulk goods. No owner decision needed.

- **Schema:** `SellerOffer.bulkTiers` JSON via additive migration `20261112180000_add_seller_offer_bulk_tiers`. Empty means the marketplace defaults (10+/3%, 50+/6%, 200+/10%) so existing offers are unchanged.
- **Server:** seller create/edit validation normalises tiers (≤5, qty 2..100000, 1..90%, distinct ascending); inventory persists/returns them. Cart/order pricing resolves the offer's tiers in Prisma Decimal; the client never supplies prices. FastAPI catalogue exposes the same field.
- **UI:** ProductDialog has a per-listing tier editor (add/remove, validation, defaults note); `/product/[id]` shows the selected offer's tiers in the BuyBox/bulk panel and SellerTable labels each offer's tiers.
- **Verified:** full Vitest **182/182**; focused pricing/cart/inventory/validation **37/37**; FastAPI catalogue **42/42** (contract against the current dev server); `tsc`, ESLint and production build clean. Live check: UltraBuild offer 390.00 with `10+ 15%` → cart unit price **331.50**; custom tier rendered on `/product/0`; offer restored afterwards.
- **Next:** the highest-priority unblocked MVP workflow remaining is **WP-2 admin dispute/refund resolution**, but its refund policy is an open owner decision (`OPEN_OWNER_DECISIONS.md` #3). Recover that decision/requirements before implementation; otherwise D8/B8 are both complete.

## Last completed task (D8 - Admin actor investigation - task 9.16 - 2026-11-12)

Branch `feature/backend-mvp` @ `344f16b` - nothing committed, staged, pushed or deployed.

**Scope:** the parity matrix's D8 ("actor filter exists; no drill-down profile"). No owner decision or schema change needed; reuses `AuditEvent` and the existing Admin read/audit patterns.

- **Backend:** `GET /api/admin/actors/{actor_id}` returns the administrator profile, summary (total events, distinct actions, first/last recorded), top 20 action counts and the latest 20 events (safe metadata only). Administrator accounts only - an unknown or non-admin id is `404 actor_not_found`; the role check runs in Python because `User.role` is a native PostgreSQL enum. The read and its `admin.actors.detail` audit row commit together (fail-closed 500). `GET /api/admin/actors/{id}/exists` is a non-auditing helper for the Next proxy.
- **Frontend:** `/admin/actors/[id]` shows profile, totals, most frequent actions and latest activity with loading/error/unauthorized/forbidden states; activity-log actor names now link to it. `proxy.ts` returns a real HTTP 404 for unknown actors and keeps the existing seller/order 404s.
- **Verified:** focused FastAPI `tests/admin/test_admin_actor_detail.py` **20/20** (auth, 404 scope, contract/ordering/privacy, audit-once, rollback, exists) and full admin suite **110/110**; Vitest actor-link helpers **2/2**; `tsc`/ESLint clean. HTTP check: activity actor link → page 200 with drill-down sections; unknown actor 404; page read wrote `admin.actors.detail` (targetType `User`).
- **Next:** **B8 - per-offer bulk pricing** (PARTIAL: `Product.bulkFlag` exists; per-offer bulk edit is not exposed). Inspect the B8 definition and pricing architecture before changing anything.

## Hotfix (2026-11-12) - blank homepage / continuous refresh in dev

Root cause: Next 16 blocks dev-only resources for origins other than `localhost`; the app was opened at `127.0.0.1:3001`, so `/_next/hmr` was refused (`ERR_INVALID_HTTP_RESPONSE`), the dev overlay showed its "1 Issue" indicator, and Fast Refresh retried/reloaded the page. A second, stale `next start` process (PID 26732, started 16:51) still serves `:3000` from an old build whose CSS chunks 500/404, so opening `:3000` shows an unstyled/blank page.

Fix: `app/next.config.ts` now sets `allowedDevOrigins: ["127.0.0.1"]` (dev-only; no production effect). Verified on `http://127.0.0.1:3001`: styled homepage, 20s with 1 load/0 HMR errors/0 Suspense errors; customer `/orders`, seller `/seller/orders`, driver `/delivery/jobs`, admin `/admin/shipments` all 200 with content and one load each; `tsc` clean. Use the dev server on `:3001` (or stop the stale `:3000` process) - do not run `next start` against a tree that has been rebuilt by `next dev`.

## Last completed task (demo readiness + driver job decline - task 7.2d - 2026-11-12)

Branch `feature/backend-mvp` @ `344f16b` - nothing committed, staged, pushed or deployed.

### Demonstration readiness (verified over HTTP)
- **Working local stack:** Next `npm run dev` from `app/` (binds **3001** while port 3000 is held by a stale server in this environment) + FastAPI `uvicorn fastapi_app.main:app --host 127.0.0.1 --port 8001` from `backend/`. The long-running `:8000` process predates the `/api/admin/shipments` route - do not reuse it.
- **Note:** start Next with `FASTAPI_BASE_URL` and `FINANCE_API_URL` pointing at the current FastAPI port (both are server-side envs; `.env` only sets `FINANCE_API_URL`).
- **Pages verified authenticated (200 + real rows):** customer `/`, `/search`, `/cart`, `/orders`; seller `/seller`, `/seller/orders`, `/seller/finance`, `/seller/products`, `/seller/delivery`, `/seller/settings`; driver `/delivery`, `/delivery/jobs`, `/delivery/history`, `/delivery/settings`; admin `/admin`, `/admin/users`, `/admin/shipments` (incl. `?status=dispatched`), `/admin/finance`, `/admin/orders`, `/admin/sellers`, `/admin/activity`.
- **Demo accounts** (seed, domain `@demo.constrowell.test`; password = seed `DEMO_PASSWORD`, never committed): admin `constro.well.admin@…`; sellers `imran.shaikh@…` (UltraBuild) + 6 more; drivers `ramesh.kumar@…`, `naveen.r@…`, `imtiyaz.khan@…`; customers `deepa.r@…`, `rohit.s@…`, etc. Demo dispatched jobs `BG-50231` (Ramesh) and `BG-50229` (Naveen) appear in both the seller and driver portals.
- **Known non-blocking noise:** Next 16 dev logs `Date.now()`-during-prerender errors for `/admin*` responses; the pages still return HTTP 200 with correct data, and no admin source calls `Date.now()`. Stale dev processes on `:3000`/`:8000` are environment leftovers, not repo defects.

### C4 - driver job decline (task 7.2d)
- `POST /api/driver/jobs/[shipmentId]/decline` (`declineDriverJob`): driver-ownership scoped (`requireDriver` + cross-driver 404), row-locked, zod reason 3-300 chars.
- `dispatched → packed`: clears `driverId`, `vehicleId`, `otpHash`, `otpEncrypted`, `otpTries` and appends `ShipmentEvent` "Driver declined delivery job: <reason>". COD `CodCollection`, stock and escrow are untouched; parent stage recomputes to `packed`, so the seller's existing re-dispatch path works.
- Prevents duplicates/invalid transitions: after the decline the shipment is no longer assigned to that driver (repeat = 404, same ownership rule as cross-driver); `picked_up`/delivered states return 409.
- Driver UI: `Decline` button on the assigned-jobs list + `DeclineJobDialog` with reasons; store action refreshes the job list (declined job leaves the active queue).
- **Verified:** `vitest run src/server/orders/driverService.test.ts src/lib/delivery/selectors.test.ts` → **16/16** (driver 12 incl. 2 new decline tests: clears assignment/OTP, preserves COD, stage packed, seller re-dispatches; duplicate/non-assigned/picked-up/after-delivery rejections; selector 4 incl. decline eligibility + pickup active list); `tsc --noEmit` 0; ESLint 0. No schema change.

## Last completed task (driver pickup confirmation - task 7.2c - 2026-11-12)

Branch `feature/backend-mvp` @ `344f16b` - nothing committed, staged, pushed or deployed (task rules).

Picked as the highest-priority unfinished **unblocked** business workflow: the parity matrix's C5 "Pickup confirmation" and HANDOFF's own next-candidate list both put it first - the physical flow jumped straight from seller dispatch to OTP delivery with no record that the driver actually collected the goods. No owner decision was needed.

### What shipped
- **Schema/migration:** `picked_up` added to `ShipmentStatus` via additive `20261112120000_add_picked_up_shipment_status` (`ALTER TYPE ... ADD VALUE ... AFTER 'dispatched'`). No table/column/data change; Prisma remains the migration authority. Applied to the local DB only (7 migrations now).
- **API:** `POST /api/driver/jobs/[shipmentId]/pickup` (`confirmDriverPickup`) - driver-ownership scoped, row-locked, idempotent (exactly one `ShipmentEvent`), 409 from any status other than `dispatched`. Delivery and driver issue reporting now accept `picked_up` as an on-road state, so pickup stays optional for in-flight/seed shipments.
- **Customer:** the delivery OTP stays visible while the shipment is `picked_up` (`server/orders/service.ts`), and the parent `Order.stage` remains `shipped` (`lifecycle.ts` SHIPPED set). Customer order page already renders the status generically ("Picked up").
- **Seller:** status label + "On the road" filter include `picked_up`; performance stats treat it as dispatched.
- **Driver portal:** "Confirm pickup" action (store + API client + drawer) after accepting a job, "Picked up" banner/status, active-jobs list and overview count include the state.
- **Admin/FastAPI:** `/admin/shipments` filter and the FastAPI status vocabulary include `picked_up`; while touching that vocabulary the already-real `refunded` value was added to the backend constant/model so the existing UI filter no longer 400s (small correctness fix in the same surface).

### Verified (focused, this session)
| Check | Result |
|---|---|
| `vitest run src/server/orders/driverService.test.ts` | **10/10 passed** (3 new: idempotent pickup keeps OTP + shipped stage; deliver after pickup; cross-driver 404 + post-delivery 409) |
| `pytest tests/admin/test_admin_overview.py tests/admin/test_admin_shipments.py` | **22/22 passed** (overview status tally updated 11→13) |
| `npx tsc --noEmit` / ESLint (touched files) | exit 0 / 0 problems |
| Browser check | Not run |

### Next unblocked candidates
C4 driver reject/decline assigned job (PARTIAL, smallest remaining delivery gap), D8 admin actor investigation (PARTIAL, no owner decision), B8 per-offer bulk pricing UI (PARTIAL). WP-2 admin dispute resolution and KYC remain blocked on owner decisions.

## Release checkpoint (2026-11-11 - pushed)

`feature/backend-mvp` synchronized to `origin/feature/backend-mvp` (fast-forward `1f0f61f` -> `e979357`, 11 commits): AuditEvent + seller-collected COD schema/migrations; FastAPI backend (auth/catalog/admin/finance); Admin console incl. D6 `/admin/shipments`; seller + Admin COD finance consoles; seller-collected COD placement + customer review-window confirm/report; seller failed-delivery redispatch/missed; catalogue cutover + card add-to-cart; auth pre-hydration/header fixes; architecture/UI-fidelity/parity docs; Admin prototype; WP-2 confirm/report endpoints.

Left uncommitted by design (local only): `artifacts/`, `app/tests/` (Playwright incl. finance E2E), `app/.github/`, `app/check-db.cjs`, `app/check-login.cjs`, `app/tmp-diag.cjs`, `app/tmp-overflow.cjs`. No deploy performed - Render/Supabase untouched.

## Last completed task (seller failed-delivery recovery — task 7.2b — 2026-11-11)

Branch `feature/backend-mvp` @ `1f0f61f` — nothing committed, staged, reset, stashed, pushed or deployed.

### Concurrent-IDE note (read this before touching files)

This repo is actively shared with at least one other IDE/agent session right now (per
`AGENTS.md`'s multi-IDE rule). Observed and left untouched this session:
`app/src/components/auth/LoginForm.tsx`, `RegisterForm.tsx` (a `method="post"`
pre-hydration-fallback fix) and `app/src/components/seller/SellerTopBar.tsx` — all
modified by someone else, not reviewed or touched here. A concurrent `next build` was
also running and blocked this checkpoint's own build-verification attempt twice (see
below). Before editing, diff `git status` against the file list in this section to spot
anything new.

### What shipped

Picked as the next highest-priority unblocked item after task 7.3 (previous checkpoint):
`docs/feature-parity-assessment-2026-11-11/BUSINESS_WORKFLOW_GAPS.md` workflow #4
("Failed delivery, reassignment & retry") named a concrete, confirmed dead end —
**nothing** ever happened to a shipment once it reached `status: "failed"` (3 wrong OTP
tries at delivery, or a driver's "failed attempt" report). No reassignment, no retry, and
the `missed` enum value (already modeled in `lifecycle.ts`'s `TERMINAL_CANCEL` set) was
never reachable. This needs no owner policy decision — it's a pure logistics-recovery gap,
unlike the goods-condition (`disputed`) branch which is correctly left alone (WP-2 admin
resolution, gated on the refund/adjustment policy decision).

- `POST /api/seller/orders/[shipmentId]/redispatch` — seller reassigns a (possibly
  different) vehicle/driver and retries: `failed → dispatched`, same vehicle/docs
  validation as the original `dispatchShipment`, a **fresh OTP** generated, `otpTries`
  reset to 0, and the resolved `ShipmentIssue` row deleted (it's the schema's "current
  dispute per shipment" slot, not permanent history — the narrative survives in the
  append-only `ShipmentEvent` log). 409s if the shipment isn't currently `failed`.
- `POST /api/seller/orders/[shipmentId]/missed` — seller gives up: `failed → missed`,
  reusing the **exact same** `restoreReservedStock`/`refundHeldEscrow`/`cancelCodCollection`
  helpers `rejectShipment` already uses (goods never reached the customer, no COD cash was
  ever collected, so there's nothing to refund). 409s if not currently `failed`.
- Both: ownership-scoped through `Seller.id`, in `src/server/orders/sellerService.ts`
  right alongside `dispatchShipment`/`rejectShipment` (same transaction/row-update-count
  pattern, not a new abstraction).
- Frontend: `/seller/orders` row actions and the order drawer (`OrderDrawer.tsx`) show
  "Reassign" / "Mark missed" only for `failed` shipments. Two new dialogs —
  `ReassignDialog.tsx` (same field set as `DispatchDialog`, different copy: no existing
  dialog fit without misleading text — `RejectDialog`'s reasons are pre-dispatch-specific
  and its copy mentions "escrow hold refunded", neither of which fits a post-delivery-
  failure action) and `MissedDialog.tsx` (same shape as `RejectDialog`, failure-appropriate
  reasons: "Customer unreachable after repeated attempts", "Customer declined the
  delivery", "Address could not be located", "Other").
- **Deliberately not touched:** `lib/seller/selectors.ts` (`ORDER_FILTERS`,
  `getNeedsAttention`) — it's explicitly a prototype-ported file (`ORDER_FILTERS` header
  comment: "ported from buildgrid-seller-dashboard.html") and `AGENTS.md`'s fidelity policy
  requires written justification before touching navigation/IA. A `failed` shipment is
  still fully visible and actionable today under the existing "On the road" and "All"
  filters — it just doesn't additionally surface in the Overview's "needs attention" tiles.
  Flagged as a known, intentionally-deferred follow-up, not fixed here.
- **Test-infra fix in the same file:** `sellerService.test.ts`'s `afterAll` cleanup hook
  (now deleting rows for 10 sellers/customers across 6 tests) was flaking on Vitest's
  default 10s hook timeout under concurrent DB load — observed twice this session, in two
  *different* test files (`seller/profile.test.ts` last checkpoint, this one this
  checkpoint), always passing cleanly on an immediate isolated rerun. Bumped this hook to
  30s (matching the describe block's own test timeout); confirmed clean on rerun.

### Verified results

| Check | Command | Result |
|---|---|---|
| New targeted tests | `vitest run src/server/orders/sellerService.test.ts` | **6/6 passed** (2 new: reassign — cross-seller 404, OTP hash/tries reset, issue cleared, re-reassign 409; missed — cross-seller 404, stock restored, COD collection cancelled, re-mark 409) |
| TypeScript | `npx tsc --noEmit` | exit 0 |
| ESLint (touched files) | `npx eslint <10 changed/added files>` | exit 0, 0 problems |
| Full Vitest suite | `npx vitest run` | **158/162 on the first pass** — 4 files failed with `Can't reach database server at 127.0.0.1:5433` / a 5s test-timeout (none in files this checkpoint touched). Re-ran all 4 (`driverService.test.ts`, orders `service.test.ts`, catalog `service.test.ts`, cart `service.test.ts`): 3 passed clean immediately; the 4th (`cart/service.test.ts`) still showed one timeout under load, then passed 3/3 in isolation. All four confirmed transient DB-connectivity/contention flakes, not regressions — consistent with the same pattern noted in the prior checkpoint. |
| Production build | `npm run build` | **Not verified this round.** Hit `⨯ Another next build process is already running` twice in a row (the concurrent IDE session noted above). Did not force a third attempt or touch the other process — relying on the clean `tsc`/ESLint/Vitest results instead. **Next session: run `npm run build` once no concurrent build is active.** |
| Prisma schema | — | No schema change this round (no new migration needed). |
| Whitespace/conflict check | `git diff --check` | exit 0 (CRLF-normalization warnings only, pre-existing) |

### Docs updated

- `TASKS.md`: new row **7.2b** (DONE); **7.1** downgraded from its stale "NOT STARTED" to
  PARTIAL with an accurate note (side-branches now resolve; automatic deadline-based
  transitions still need WP-5 background jobs — 7.1 had never been revisited despite 7.2's
  and 7.3's work already covering most of its scope).
- `docs/feature-parity-assessment-2026-11-11/BUSINESS_WORKFLOW_GAPS.md`: workflow #4
  marked partially resolved, with the still-open sub-gaps (automatic timeout, `disputed`
  resolution, cross-seller reassignment) spelled out so a future session doesn't redo this
  or assume more is covered than actually is.
- `docs/feature-parity-assessment-2026-11-11/FEATURE_PARITY_MATRIX.md`: C6 evidence note
  extended (same COMPLETE status — this was a side-branch completion, not a new
  capability).

### Next unblocked candidates (not started this round)

In rough priority order, all unblocked by owner decisions:
- **C5 Pickup confirmation** (MISSING) — no transition in the state machine between
  seller dispatch and driver delivery; would need a new `ShipmentStatus` enum value
  (schema migration, but not a policy question).
- **D6 Shipment/delivery oversight** (PARTIAL) — dedicated admin view, reusing the 9.11/
  9.12 read-pattern; no owner decision needed.
- **D8 Admin actor investigation** (PARTIAL) — per-administrator audit drill-down, reusing
  existing audit-log data; no owner decision needed.
- **B8 Bulk pricing** (PARTIAL) — per-offer bulk-tier edit UI; `Product.bulkFlag` exists,
  the edit surface doesn't.
- C4's "driver reject" (declining an *assigned* job, distinct from this checkpoint's
  seller-side failed-delivery recovery) is a smaller, separate gap worth a quick look.

## Prior task (customer review-window confirm/dispute — task 7.3 / WP-2 start — 2026-11-11)

Branch `feature/backend-mvp` @ `1f0f61f` — nothing committed, staged, reset, stashed, pushed or deployed.

### What shipped

Picked as the highest-priority unfinished P0 item from `TASKS.md` (7.3) /
`docs/feature-parity-assessment-2026-11-11/FEATURE_PARITY_MATRIX.md` (A13 "customer
dispute initiation missing") that does **not** depend on any open owner decision — unlike
the rest of WP-2 (admin resolution), this is pure engineering execution:

- A shipment that reaches `status: "review"` (full delivery recorded by the driver, no
  shortfall) previously had no customer-facing action at all — the review window just sat
  there with nothing able to move it forward.
- `POST /api/orders/[id]/shipments/[shipmentId]/confirm` — customer confirms delivery:
  `review → settled` + one `ShipmentEvent`. Rejects (409 `not_reviewable`) unless the
  shipment is currently `review`, so confirming twice is a no-op-with-an-error, not a
  silent re-accept.
- `POST /api/orders/[id]/shipments/[shipmentId]/report-issue` — customer reports a
  problem: creates `ShipmentIssue{type:"damaged_goods", auto:false}` (the schema comment
  already reserved `damaged_goods` as "(customer report)" — `short_quantity` is
  system/driver-opened at delivery, `failed_attempt` is a pre-delivery driver report, so
  neither is customer-selectable) + `review → disputed` + one `ShipmentEvent`. Guarded by
  `ShipmentIssue.shipmentId` being `@unique`: a second report attempt gets 409
  `issue_already_reported` instead of overwriting the first (verified at the DB level, not
  just pre-checked, so two concurrent reports can't both win).
- Both actions: ownership-scoped through `Order.userId` (never a client-supplied id),
  `SELECT ... FOR UPDATE` on the shipment row inside the same transaction as the status
  write, matching the existing `cancelOrder` pattern exactly (`app/src/server/orders/service.ts`).
- Frontend: `OrderDetailView.tsx` shows "Confirm delivery" / "Report an issue" buttons
  while a shipment is `review`, a "You confirmed this delivery" line once `settled`, and
  the reported note once `disputed`. Report opens a small dialog (reused `Dialog`
  component, same shape as the existing cancel dialog).
- **Correction to existing code, same file:** the customer order-detail page still showed
  legacy `Escrow: ₹X held/refunded/released` copy unconditionally — meaningless for WP-1
  `seller_collected` orders, which write zero `EscrowEntry` rows by design. `OrderDto`
  gained a `financeModel` field; the page now shows the correct seller-collected-COD line
  ("pay the seller/driver directly on delivery") and only shows the escrow line for
  pre-cutover `escrow`-model orders. The cancellation banner's "escrow hold was refunded"
  claim is likewise now conditional on `financeModel === "escrow"`.
- **What this deliberately does not do:** the original task 7.3 acceptance criterion
  ("report freezes vendor payout in ledger") is written against the retired
  platform-custody escrow model. Task 7.5's payout-release job was never built, and WP-1
  superseded it entirely — commission is assessed from a confirmed `CodCollection`
  independently of shipment status, so there is no "vendor payout" in a ledger to freeze.
  No payout-freeze behavior was invented to satisfy the old wording. Admin *resolution* of
  the resulting `ShipmentIssue` (refund amount, who bears it, reassignment) is WP-2's
  remaining half and is gated on `OPEN_OWNER_DECISIONS.md` #3 (refund/adjustment policy) —
  not attempted here.

### Verified results (all executed this session)

| Check | Command | Result |
|---|---|---|
| New targeted tests | `vitest run src/server/orders/service.test.ts` | **8/8 passed** (2 new: confirm happy-path + re-confirm 409; report happy-path + pre-review 409 + duplicate-report 409 with DB-row count check) |
| TypeScript | `npx tsc --noEmit` | exit 0 |
| ESLint (touched files) | `npx eslint <7 changed/added files>` | exit 0, 0 problems |
| Full Vitest suite | `npx vitest run` | **160 passed** (158 prior + 2 new) / 1 file failed on a `hookTimeout` in `src/server/seller/profile.test.ts` (unrelated — re-ran that file alone immediately after and it passed 3/3; concurrent DB load from running the full suite and this isolated check back-to-back, not a regression from this change) |
| Production build | `npm run build` (Turbopack) | exit 0, twice in a row; both new routes (`/api/orders/[id]/shipments/[shipmentId]/{confirm,report-issue}`) listed as `ƒ` (dynamic) |
| Prisma schema | `npx prisma validate` | valid (no schema change — `ShipmentIssue`, `Order.financeModel` already existed) |
| Migrations | `npx prisma migrate status` | 6 migrations, "Database schema is up to date!" |
| Full FastAPI suite (incl. the never-recorded finance-hardening pass below) | `pytest -q` | **328 passed**, 1 skipped-on-rerun (catalogue contract-equivalence vs a live Next dev server — pre-existing, environmental, unrelated to finance/orders), 2 skipped |
| Whitespace/conflict check | `git diff --check` | exit 0 (CRLF-normalization warnings only, pre-existing across the repo) |

### Backfilled: the finance-hardening pass this checkpoint found already done but unrecorded

A prior session (compacted mid-work) had already implemented and verified a full "Package
2: Finance Hardening" pass but never wrote it to `TASKS.md`/`HANDOFF.md`. Found on disk and
re-verified this session, now recorded in `TASKS.md` under WP-1 ("Admin bulk commission
assessment", "Finance hardening test suites", "Playwright finance E2E" rows):

- `POST /api/admin/finance/assessments/run` (bulk commission assessment — service existed,
  the route did not) + Next client + Admin UI button.
- `backend/tests/finance/{test_authorization,test_integrity,test_assessment_run,
  test_concurrency_transitions}.py` — 19-endpoint role matrix, cross-seller/adjustment
  reference rejection, no-audit-on-failure, DB-enforced reversal uniqueness, assessment-run
  idempotency/concurrency, concurrent-reverse and concurrent-confirm each leaving exactly
  one winner.
- `app/tests/finance-fixtures.ts` + `app/tests/finance-flows.spec.ts` — 7 authenticated
  Playwright flows against isolated seeded data (not smoke/render-only checks).

### Playwright mobile finance test — investigated, recorded, not re-opened as blocking

`finance-flows.spec.ts`'s `"finance pages stay usable on a mobile viewport"` test was
flaky earlier in this engagement. It was **fully root-caused in a prior turn this
session** (see the transcript around the "authenticated server-rendering issue"
investigation) as an **environment/process-hygiene problem, not a product or test defect**:

- The frontend dev port was being served by a stale `next start` (production) process
  whose in-memory build manifest no longer matched the files on disk in
  `.next/static/chunks/*` after a later `next build` ran without restarting it. The
  browser was handed HTML referencing deleted chunk files, those requests 500'd, client
  hydration failed, and React fell back to the nearest ancestor Suspense/error boundary —
  the *root* `loading.tsx`/`error.tsx` (catalogue-flavored copy), not anything
  finance-specific. Confirmed directly: `curl .../_next/static/chunks/<name>.js` → bare
  `500`, and that filename does not appear anywhere in the current `.next/build-manifest.json`.
- **This session, `:3000` is again being served by a `next start`/`npm run start` process**
  (PID 47812 / 27600 at the time of writing, started ~15:49, i.e. **not started by this
  checkpoint's work** — this repo is shared across OpenCode/Antigravity/Freebuff per
  `AGENTS.md`, so another IDE/agent appears to be using it live right now). Running
  `npm run build` for this checkpoint's own verification (above) will have made that
  mismatch worse for whoever owns that process, exactly as previously diagnosed. Per the
  multi-IDE rule ("one IDE writes at a time"), this checkpoint did **not** stop or restart
  that process, and did **not** attempt to re-run the mobile Playwright test against it —
  doing so would both race with the other session and reproduce a known-bad state rather
  than test real behavior.
- **Recommendation for whoever next verifies finance Playwright specs:** confirm no other
  IDE/agent is using the shared dev port, then run a single clean `npm run build && npm run
  dev` (or just `npm run dev` for iteration) before re-running
  `npx playwright test tests/finance-flows.spec.ts`. The test itself needs no changes — all
  7 cases, including the mobile one, passed cleanly in the session that authored them once
  the server was healthy.

## Prior task (stabilisation verification checkpoint — 2026-11-11)

Branch `feature/backend-mvp` @ `1f0f61f` — nothing committed, staged, reset, stashed, pushed or deployed.
Verification-only pass; the only code change is a two-token TypeScript annotation fix (below).

### Verified results (all executed this session)

| Check | Command | Result |
|---|---|---|
| Catalogue contract file | `pytest tests/catalog/test_contract_equivalence.py` | **14 passed** (Next.js dev server reachable on :3000) |
| Four contract edge cases, individually | `category=cement`, `sort=newest`, `page=999`, `/products/10/offers` | **1 passed each (4/4)** |
| Full FastAPI suite | `.venv/Scripts/python.exe -m pytest` | **204 passed**, 0 failed, 177 warnings, 28.3 s |
| Full Vitest suite | `npm run test` | **158 passed / 27 files** |
| TypeScript | `npx tsc --noEmit` | **exit 0** (clean after the fix below) |
| ESLint | `npm run lint` + `npx eslint tests/finance-smoke.spec.ts` | **exit 0**, 0 problems |
| Production build | `npm run build` (Turbopack) | **exit 0**, all routes emitted, Proxy (Middleware) present |
| Prisma schema | `npx prisma validate` | valid |
| Migrations | `npx prisma migrate status` | **6 migrations**, "Database schema is up to date!" (127.0.0.1:5433/constrowell) |
| Whitespace/conflict check | `git diff --check` | **exit 0** |

### Fix made (verified regression, stabilisation-scoped)

`app/tests/finance-smoke.spec.ts` (added by the WP-1B pass) failed `tsc --noEmit` with
`TS7006` on two parameters of its local `login()` helper — Playwright types are not inferred
for a hand-written helper's parameters, so `page` and the `waitForURL` callback `url` were
implicitly `any`. Fixed by importing `type Page` and annotating `login(page: Page, ...)`.
No test logic, assertion or behaviour changed. Two lines.

### Configuration check (task item 8)

- `app/.env` keys present: `DATABASE_URL`, `FINANCE_API_URL`, `OTP_ENCRYPTION_KEY`, `SESSION_SECRET`.
- `FINANCE_API_URL="http://127.0.0.1:8000"` — set, and it is the finance-only switch
  (`lib/api/financeProxy.ts`). `FASTAPI_BASE_URL` is **absent**, which is exactly the
  intended split: `lib/api/catalogSource.ts` gates the catalogue cutover on
  `FASTAPI_BASE_URL`, so the catalogue stays on the Next.js/Prisma reader with no
  `CATALOG_SOURCE` override needed.
- Live confirmation: FastAPI on :8000 (`/health` 200, `/docs` 200, `/openapi.json` 200);
  `GET :3000/api/seller/finance/statement` returns **401** unauthenticated (proxy reaches
  FastAPI — a 503 would mean misconfiguration); `GET :3000/api/categories` 200 from the
  Next.js/Prisma path.
- Correction to the previous checkpoint's wording: it says `FASTAPI_BASE_URL` was added to
  `app/.env`. It was not — `FINANCE_API_URL` was, which is the correct variable for a
  finance-only cutover. The code and `.env.example` agree; only that sentence was wrong.

### Remaining failures

**None in any suite.** Non-failing warnings observed: Prisma 7 deprecation for
`package.json#prisma`; httpx per-request `cookies=` deprecation in the finance tests;
Starlette `TestClient`/`httpx` deprecation. All are upstream warnings, not project defects.

Known non-blocking state, unchanged and not investigated further per scope: `@example.test`
test residue in the dev DB from earlier sessions; owner decisions still open for commission
rate/basis, remittance method/frequency and refund/adjustment policy.

### Readiness for finance hardening

**Ready to proceed.** Both suites are green, the schema and all 6 migrations are applied and
validated, the build is clean, and the finance BFF/authorization path is confirmed reachable
with enforcement intact. The blockers that remain are **product decisions, not defects** —
commission rate/basis, remittance method and frequency, refund/adjustment policy — plus a
live-data browser walkthrough of the finance screens, which this pass did not perform
(no browser verification was in scope).

## Prior task (WP-1B finance hardening + frontend — 2026-11-11)

Branch `feature/backend-mvp` @ `1f0f61f` (nothing committed — no commit/push/deploy/branch switch).

**Part A — hardening:**
- **Migration `20261111200000_relax_allocation_pair_index`** drops the over-strict partial
  unique index so a remittance may allocate to the same assessment repeatedly (partial
  allocations) and a later remittance may top up a partially-allocated assessment. Over-
  allocation is still prevented by `with_for_update()` row locks + balance re-checks.
- **Statement fix:** `outstandingCommission = assessed − netAllocated`; customer-refund
  adjustments are now reported separately and no longer (incorrectly) reduce commission
  owed. New tests: repeated partial allocations, later-remittance top-up, returned
  remittance excluded from platform cash, reverse-one-of-many-partial allocations.

**Part B/C — frontend (BFF to FastAPI):**
- Thin proxy route handlers `app/src/app/api/{seller,admin}/finance/[...path]/route.ts`
  (forward `cw_session` to FastAPI; FastAPI stays the auth boundary).
- Seller `/seller/finance` (statement, collections + confirm + discrepancy, remittances +
  initiate, refund adjustments) and Admin `/admin/finance` (discrepancies + dispute,
  remittance verify/fail/return + allocate/reverse, commission + policy, adjustment
  apply/reverse).
- Added admin list endpoints (`/api/admin/finance/{collections,remittances,assessments,adjustments}`)
  with seller `storeName`.

**Part D — legacy relabel:** seller payments tab and Admin overview/detail escrow are now
labelled "Legacy escrow (pre-cutover)".

**Verified:** FastAPI **200 passed / 4 failed** (the 4 failures are catalog
`test_contract_equivalence` — they compare against a running Next.js dev server and are
environmental, not finance-related); Vitest **158/158**; `tsc` clean; ESLint clean;
production build OK; `prisma validate` OK; 5 migrations applied. `FASTAPI_BASE_URL` added to
the local `app/.env` so the finance BFF can reach FastAPI (uncommitted). FastAPI dev server
running on :8000, Next.js dev server restarted on :3000.

## Next work package

Owner decisions for production commission/remittance configuration (none invented), plus a
live-data browser walkthrough of the new finance screens.

---

## Prior checkpoint (WP-1 seller-collected COD finance foundation — 2026-11-11)

Branch `feature/backend-mvp` @ `1f0f61f` (nothing committed — no commit/push/deploy/branch switch).

**Implemented (backend foundation + order cutover):**

- **Prisma migration `20261110222135_add_seller_collected_cod_finance`** (additive, applied):
  `FinanceModel` enum + `Order.financeModel` (default `escrow`), plus `CodCollection`,
  `CommissionAssessment`, `Remittance`, `RemittanceAllocation`, `SellerAdjustment`,
  `CommissionPolicy`. A partial unique index (`RemittanceAllocation_one_open_per_pair`)
  enforces one open allocation per (remittance, assessment). Legacy `EscrowEntry` is
  untouched and preserved.
- **FastAPI finance domain** (`domains/finance/service.py`, `routers/finance.py`,
  `models/finance.py`, `schemas/finance.py`, wired in `main.py`) — 19 endpoints:
  - Seller: `GET /api/seller/finance/statement`, `collections`, `collections/{id}/confirm`,
    `remittances` (GET/POST), `adjustments` (GET/POST).
  - Driver (seller's agent): `POST /api/driver/finance/collections/{id}/confirm`.
  - Admin: collection discrepancies/dispute, commission assess/waive, remittance
    verify/fail/return, allocation create/reverse/list, adjustment apply/reverse, policy
    create, seller statement.
  - Decimal-only money; commission is policy-driven (fail-closed — no rate invented);
    `with_for_update()` row locks + partial index guard concurrent allocation; every
    financial write is audited via the append-only `AuditEvent`.
- **Next.js cutover**: `placeOrderTx` now writes a `CodCollection` expectation +
  `financeModel:"seller_collected"` and stops writing `held` escrow; cancel/reject mark the
  collection `cancelled` (`lifecycle.cancelCodCollection`). `sellerPaymentsSummary` is
  relabelled as legacy (pre-cutover) read-only history.

**Verified:** FastAPI **200/200** (43 new finance tests incl. a genuine two-connection
concurrency test); Vitest **158/158** (order tests updated to the new model); `tsc` clean;
ESLint clean; production build OK; `prisma validate` OK; `migrate status` up to date (4
migrations); `git diff --check` clean. Migration is additive — existing `Order`/`EscrowEntry`
data preserved (verified no rows modified).

**Known notes:** a small amount of pre-existing `@example.test` test residue exists in the
dev DB from prior sessions (not created by this task — re-running the test suites leaves
the counts unchanged). No seller/Admin frontend screens were added (next package).

## Next work package (WP-1 frontend integration)

Wire the seller portal and Admin console to the finance endpoints above; relabel the legacy
escrow payments tab. Owner decisions still open: commission rate/basis, remittance
method/frequency, refund/adjustment policy — none invented.

---

## Prior checkpoint (feature-parity reconciliation + seller-collected COD architecture - 2026-11-11)

Branch `feature/backend-mvp` @ `1f0f61f` (nothing committed). Planning only — no code,
schema, business-data, branch or deploy changes.

- Produced `docs/feature-parity-assessment-2026-11-11/` (11 documents) reconciling all four
  portals + shared platform against live code, tests and existing audits. Tally: **31
  COMPLETE / 27 PARTIAL / 14 MISSING / 6 BLOCKED** across 78 capabilities. Financial
  semantics validated in `FINANCIAL_ARCHITECTURE_VALIDATION.md` (legacy positive-amount /
  type-signed escrow, retained read-only) and the target seller-collected COD domain
  specified in `SELLER_COLLECTED_COD_ARCHITECTURE.md`.
- **Owner-confirmed (2026-11-11):** COD is collected by the **seller** directly; an assigned
  driver may collect cash as the seller's agent; **Constro-Well does not collect or custody
  COD proceeds.** This replaces the platform-custody escrow/payout model — the target is now
  commission receivable → seller remittance → allocation → reconciliation.
- Key blockers: no commission receivable/remittance/reconciliation (Constro-Well cannot
  collect its commission), no dispute/refund resolution, no KYC document/decision lifecycle,
  no file storage, no notifications, no background jobs; customer gaps: wishlist, review
  submission, guest cart, account page.
- Next work package: **WP-1 (commission receivable + remittance + reconciliation —
  seller-collected COD)** — gated on owner decisions in `OPEN_OWNER_DECISIONS.md`
  (commission rate/basis, remittance frequency/method, refund/adjustment policy).
- All tasks 9.1–9.14 remain DONE and preserved. No schema/business data touched; servers
  not started for this planning task.


## Last completed task (TASK 9.14 - Admin activity log filters - 2026-11-11)

Branch `feature/backend-mvp` @ `1f0f61f` (nothing committed).

- **Backend:** `GET /api/admin/audit-events` accepts `action` (exact), `actorId` (exact), `from` (inclusive), `to` (exclusive) plus page/pageSize. Dates are parsed as ISO 8601; naive values are treated as UTC and normalized to Prisma's naive-UTC storage; `from >= to` and malformed dates → `400 validation_error`. Filters apply in SQL before count/offset, ordering `createdAt DESC, id DESC` unchanged. New `GET /api/admin/audit-events/filters` returns bounded distinct actions + actor `{id,name}` from real audit rows — a non-auditing UI helper; the filtered list read still writes exactly one `admin.audit_events.list` event, fail-closed.
- **Frontend:** `/admin/activity` has a server-rendered GET form (action select, administrator select, From/To date inputs, Apply, Clear); filters live in the URL, pagination links retain them, the filtered empty state explains no matches (Clear link), and a note states “To” is inclusive with the API receiving next-day 00:00 UTC. Options failing degrade to empty selects without breaking the page. Table metadata whitelist and Admin shell unchanged; responsive.
- **Files created:** `backend/tests/admin/test_audit_filters.py`, `app/src/lib/admin/activityFilters.ts` + test. **Modified:** `backend/fastapi_app/domains/admin/service.py`, `schemas/admin.py`, `routers/admin.py`, `app/src/lib/api/adminApi.ts`, `app/src/app/admin/activity/page.tsx`, `app/src/components/admin/AdminAuditTable.tsx`, `backend/README.md`, `TASKS.md`, `HANDOFF.md`.
- **Verification:** FastAPI **157/157** (10 new: auth, exact action/actor, inclusive/exclusive boundaries, combined, invalid/reversed, filtered pagination + tie-break, empty, filter options, audit-once, rollback). Vitest **158/158**; `tsc`, full ESLint, production build, `git diff --check` clean. Live API: 7 action options / 1 actor, action total 11, actor total 88, invalid & reversed dates 400. Browser: action apply, actor apply (90 entries/page 1 of 5), pagination keeps `actorId`, combined action+date view, Clear resets, mobile 390 no overflow, guest login, customer notice, backend down “Activity couldn’t load”; all Admin pages still 200; no sensitive strings or backend URL.
- **Data:** 0 smoke users/sessions after cleanup; `AuditEvent` now 109 append-only verification rows; no business records modified.
- **Known limits:** filter values themselves are not written to the audit metadata (safe whitelist only page/pageSize/total); action/actor options are capped at 200 distinct values; date filtering is by UTC day boundaries (UI converts To to next-day exclusive); no saved filter presets or free-text search.
- **Next recommendation:** Admin **audit metadata safety review + actor activity profile** (per-administrator drill-down reusing the same filters) or, if the owner approves schema additions, the KYC document/decision slice — the latter remains blocked without a schema change.

## Last completed task (TASK 9.13 - Admin overview dashboard - 2026-11-11)

Branch `feature/backend-mvp` @ `1f0f61f` (nothing committed). `/admin` is no longer a redirect; it is the real dashboard.

### Metric definitions (as implemented)

| Metric | DB definition | Window | Rules | Type |
|---|---|---|---|---|
| Users total | `COUNT("User")` | all time | every role | current |
| New users | `COUNT("User" WHERE "createdAt" >= now-30d)` | rolling 30×24h UTC | same | period |
| Sellers total / new | `COUNT("Seller")` / `createdAt >= now-30d` | all / rolling 30d | all sellers | current / period |
| Orders total / new | `COUNT("Order")` / `createdAt >= now-30d` | all / rolling 30d | includes cancelled | current / period |
| Cancelled orders | `COUNT("Order" WHERE cancelled)` | all time | stored flag only | current |
| Order stage distribution | `COUNT(*) GROUP BY stage` | all time | 5 enum values incl zeros | current |
| Shipment status distribution | `COUNT(*) GROUP BY "Shipment".status` | all time | 11 enum values incl zeros; per seller shipment, not order | current |
| Orders per day | `COUNT(*) GROUP BY CAST("createdAt" AS date)` | 30 UTC days ending today | zero-filled buckets | period |
| Escrow by type | `COUNT(*), SUM(amount) GROUP BY type` | all time | actual ledger rows; includes seller-level withdrawals; not revenue/settlement | current ledger |
| KYC pending | `COUNT("Seller")` per flag = `pending` | all time | GST/PAN/cheque counted independently; no overall approval state | current |

Query count: **7 SELECTs** + 1 audit INSERT + COMMIT.

- **Endpoint:** `GET /api/admin/overview` → `{generatedAt, windows, totals, last30Days, orderStages, shipmentsByStatus, ordersPerDay, escrowByType, kycPending}`. `require_admin`; 7 aggregate queries; explicit UTC boundaries; Decimal sums as exact 2dp strings; zero-safe. Read + `admin.overview.read` (`targetType="AdminOverview"`, targetId null) commit together; failure rolls back to 500.
- **Frontend:** `/admin` Server Component forwards `cw_session`; KPI cards, order-stage/shipment-status bar lists, 30-day CSS bar chart with visually hidden data table, escrow table, KYC pending tiles, definitions/limitations note; Overview nav enabled; loading/error/unauthorized/forbidden states; responsive (no mobile overflow).
- **Files created:** `backend/tests/admin/test_admin_overview.py`, `app/src/lib/admin/overview.ts` + `.test.ts`. **Modified:** `backend/fastapi_app/domains/admin/service.py`, `schemas/admin.py`, `routers/admin.py`, `app/src/lib/api/adminApi.ts`, `app/src/app/admin/page.tsx` (was a redirect), `app/src/app/admin/loading.tsx`, `app/src/components/admin/nav.ts`, `backend/README.md`, `TASKS.md`, `HANDOFF.md`.
- **Verification:** FastAPI **147/147** (9 new: 401/403 roles, DB-equivalence, 30-day exclusion of a 40-day fixture, distributions, escrow decimals, KYC, audit-once, rollback, unchanged records). Vitest **153/153**; `tsc`, full ESLint, production build, `git diff --check` all clean. Browser: `/admin` 200 with values matching API (91 users / 37 sellers / 16 orders / 0 cancelled), active Overview nav, all sections, mobile 390 no overflow, customer access notice, guest login, backend-down “Dashboard couldn’t load”; Users/Activity/Sellers/Seller-detail/Orders/Order-detail all 200; no sensitive strings or backend URL.
- **Data:** 0 smoke users/sessions after cleanup; `AuditEvent` now 87 append-only verification rows; no business records modified.
- **Known limits:** no revenue/GMV/active-user/conversion/payout/dispute metrics (no defensible schema definition); `ordersPerDay` uses UTC calendar days while `last30Days` is a rolling 30×24h window (both labelled in UI); KYC is per-document flags only; escrow ledger totals are not settlement.
- **Next recommendation:** **Admin KYC review read slice (per-seller document/decision view) only if the owner approves a Prisma schema addition for KYC documents/decisions** — currently impossible without inventing data. Without that approval, the next cohesive read-only feature is an Admin **audit-log filters** enhancement (action/actor/date filters) because it reuses the existing table, needs no schema change and improves investigation of the workflows now exposed.

## Last completed task (TASK 9.12 - Admin order detail - 2026-11-10)

Branch `feature/backend-mvp` @ `1f0f61f` (nothing committed).

- **API:** `GET /api/admin/orders/{id}` → `{order, customer, money, lines, shipments(+events), financialRecords}`. `require_admin`; 401/403/404 `order_not_found` (no audit); 5 bounded queries; stored order/line/escrow snapshots only (no current prices); Decimal→exact 2dp strings; shipments ordered `createdAt ASC`, events `at ASC`, lines/escrow stable; no addressSnapshot/bank/credentials. Read + `admin.orders.detail` (`targetType="Order"`, `targetId`) commit together; audit failure rolls back to 500.
- **Orders list:** rows now link to `/admin/orders/[id]` via “View details”.
- **Frontend:** `/admin/orders/[id]` sections — order overview, customer (name/ID/email; address intentionally hidden), totals, items, each seller shipment with status/timestamps and recorded events, escrow ledger rows, and an explicit “history may be incomplete / no implied settlement” note. Back link, loading/error/not-found states; responsive (min-w-0 fixes on table cards removed mobile overflow).
- **404:** unknown orders return a real HTTP 404 via a Proxy existence check (`GET /api/admin/orders/{id}/exists`, non-auditing); the customer 403 now passes through to the access notice instead of a misleading 404.
- **Files created:** `backend/tests/admin/test_order_detail.py`, `app/src/app/admin/orders/[id]/{page,loading,error,not-found}.tsx`, `app/src/lib/admin/orders.ts` + `.test.ts`. **Modified:** `backend/fastapi_app/models/orders.py` (detail fields/entities), `domains/admin/service.py` (+`get_order_detail`), `schemas/admin.py`, `routers/admin.py` (+detail/exists), `backend/tests/admin/conftest.py` (line/event/escrow fixtures), `app/src/proxy.ts` (orders matcher, 403 pass-through), `app/src/lib/api/adminApi.ts`, `app/src/components/admin/AdminOrdersTable.tsx`, `backend/README.md`, `TASKS.md`, `HANDOFF.md`.
- **Verification:** FastAPI **138/138** (10 new detail tests incl. snapshot values, multi-shipment, event order, escrow, audit-once, rollback, unchanged records). Vitest **150/150** (one transient failure on the first run, clean rerun); `tsc`, full ESLint, production build OK; `git diff --check` clean. HTTP/browser: admin orders list → detail → back, sections/money/line snapshots/events/financial visible, unknown order 404 with links, customer notice, guest login, backend down “Order couldn’t load”, mobile no overflow; users/activity/sellers/seller-detail still work; no sensitive strings or backend URL.
- **Database:** 0 `test_%` orders/lines/shipments/events/escrow/users/sessions after cleanup; `AuditEvent` now 74 append-only verification rows; no business rows modified.
- **Known limits:** shipment events/escrow reflect stored rows only (seeded history may be sparse); address snapshots deliberately hidden; no order actions, disputes, refunds or escrow operations; proxy adds one lightweight existence request per detail navigation (non-auditing).
- **Next:** owner review before any order mutations, dispute/refund workflows or escrow operations.

## Last completed task (TASK 9.11 - Admin order monitoring - 2026-11-10)

Branch `feature/backend-mvp` @ `1f0f61f` (nothing committed). Includes the verified TASK 9.10 404 correction.

- **9.10 correction:** unknown sellers now return **HTTP 404** (known seller 200). The root `loading.tsx` streams a shell before `notFound()` can set a status, so `app/src/proxy.ts` performs a fast, non-auditing existence check (`GET /api/admin/sellers/{id}/exists`) and returns a self-contained 404 document with Back/View-all links; the page still performs the single audited read. Removed the now-unused detail `loading.tsx`; guest/customer/backend-down behaviour unchanged.
- **9.11 backend:** `GET /api/admin/orders` → `{orders:[{id,code,customer:{id,name},stage,cancelled,grossTotal,lineCount,shipmentCount,shipments:[{code,sellerName,status}],createdAt}], pagination}`; `require_admin`; ordered `createdAt DESC, id DESC`; 4 bounded queries (orders+customer, line counts, shipments+sellers); stored `OrderStage` + `cancelled` and raw `ShipmentStatus` values, no invented unified status; Decimal→2dp strings. Read + `admin.orders.list` commit together (500 rollback on audit failure).
- **9.11 frontend:** `/admin/orders` server page forwards `cw_session`; Orders nav enabled desktop+mobile; responsive table (order, customer, stage/cancelled, total, lines, per-seller shipment chips, placed), pagination, out-of-range message, loading/empty/error/unauthorized states. No mutations.
- **Files created:** `backend/fastapi_app/models/orders.py`, `backend/tests/admin/test_admin_orders.py`, `app/src/proxy.ts`, `app/src/app/admin/orders/{page,loading,error}.tsx`, `app/src/components/admin/AdminOrdersTable.tsx`. **Modified:** `backend/fastapi_app/domains/admin/service.py`, `schemas/admin.py`, `routers/admin.py` (+exists), `app/src/lib/api/adminApi.ts`, `app/src/lib/admin/pagination.ts` + test, `app/src/components/admin/nav.ts`, `AdminIcon.tsx`, `app/src/app/admin/sellers/[id]/page.tsx` (generateMetadata + cached loader, real-404 handoff), removed `app/src/app/admin/sellers/[id]/loading.tsx`, `backend/README.md`, `TASKS.md`, `HANDOFF.md`.
- **Verification:** FastAPI **128/128** (9 new order tests + existing). Vitest **148/148**; `tsc` clean; full ESLint clean; production build OK. HTTP: seller known=200 / unknown=404 with links; orders 200 (“16 orders · page 1 of 1”), page 2 out-of-range, customer/guest blocked, backend-down honest, users/activity/sellers/detail still 200. Playwright desktop 1440 (orders table, 404 status via navigation, seller detail → Back) and mobile 390 (sidebar hidden, bottom nav, scroll) passed; no sensitive strings or backend URL in HTML.
- **Data:** real seeded orders are single-seller (16 orders, 1 shipment each); multi-seller representation is covered by isolated tests. 0 `test_%` users/sessions/sellers/orders/shipments after cleanup; `AuditEvent` now 60 append-only rows from verification; no business rows modified.
- **Known limits:** proxy existence check adds one lightweight request per detail navigation/prefetch; the 404 document is standalone (not the React shell) because of the streaming constraint; no order detail page (not supported by an existing contract); no cancellation/refund/escrow views; escrow intentionally omitted.
- **Next:** owner decision needed for order detail/actions, disputes/escrow, or KYC document schema.

## Last completed task (TASK 9.10 - Admin seller detail - 2026-11-10)

Branch `feature/backend-mvp` @ `1f0f61f` (nothing committed).

- **API:** `GET /api/admin/sellers/{seller_id}` → `{seller:{id,storeName,city,phone,vacationMode,kycGst,kycPan,kycCheque,createdAt}, owner:{id,name,email,createdAt}, auditHistory:[last 5 seller-scoped events]}`. `require_admin`; 401/403/404 `seller_not_found`; no GSTIN/bank/pickup/documents; KYC values are the stored enum only. The read + `admin.sellers.detail` (`targetType="Seller"`, `targetId=seller_id`) commit together; 404 writes no audit; audit failure rolls back to 500. No seller/user rows mutate.
- **History limitation:** only audit rows with `targetType='Seller'` **and** a `targetId` are shown (currently seller detail reads). List views are not seller-scoped and prior activity predates the feature — the UI labels this as incomplete, and it is not a business history.
- **Frontend:** `/admin/sellers/[id]` server page forwards `cw_session`; cards for profile, owner, KYC checks and recorded admin activity; Back-to-sellers link; loading, not-found, unauthorized, forbidden, unconfigured and backend-down states; responsive 2-column grid. `AdminSellersTable` rows gained a “View details” link. No approval/mutation controls, no documents.
- **Files created:** `backend/tests/admin/test_seller_detail.py`, `app/src/app/admin/sellers/[id]/{page,loading,error}.tsx`, `app/src/lib/admin/sellers.ts` + `.test.ts`. **Modified:** `backend/fastapi_app/models/seller.py` (+phone), `domains/admin/service.py`, `schemas/admin.py`, `routers/admin.py`, `backend/tests/admin/test_seller_detail.py` (new), `app/src/lib/api/adminApi.ts`, `app/src/components/admin/AdminSellersTable.tsx`, `backend/README.md`, `TASKS.md`, `HANDOFF.md`.
- **Verification:** FastAPI **117/117** (10 new detail tests: 401/403, contract, owner linkage, KYC, 404-not-audited, audit-once, bounded history, audit failure, unchanged records). Vitest **148/148**; `tsc` clean; full ESLint clean; production build OK. Production smoke: admin detail 200 with store/owner/KYC/history and Back link; unknown → “Seller not found”; customer → access notice; guest → login; FastAPI stopped → “Seller couldn’t load”; users/activity/sellers still 200; `/`, `/product/0`, `/cart`, `/seller`, `/delivery`, `/orders` all 200. Playwright desktop 1440 (list → detail → Back) and mobile 390 (no horizontal overflow, bottom nav) passed; no sensitive strings or backend URL in HTML.
- **Database:** 0 `test_%` sellers/users/sessions after cleanup; `AuditEvent` now **44** append-only rows from verification reads; no seller/user records modified.
- **Limits:** no KYC documents/decisions exist in the schema, so no document viewer or approval is possible; phone/email are shown as business contact (admin-only). Detail history is incomplete by design.
- **Next:** owner decision required before any seller/KYC approval workflow (needs document/decision schema); otherwise 9.11 admin order monitoring or dispute read slice.

## Last completed task (TASK 9.9 - Admin sellers/KYC read slice - 2026-11-10)

Branch `feature/backend-mvp` @ `1f0f61f` (nothing committed). Includes the TASK 9.8 pagination correction verified first.

- **9.8 correction:** out-of-range activity pages no longer render "page 2 of 1". `listPageState(page,total,totalPages)` returns `empty` / `out-of-range` / `page`; the page shows an explicit “requested page N is outside the available range (1–M)” message, the empty component keeps a working “Back to latest activity” link, and zero records show “No activity recorded yet” with no page count. Backend contract and audit transaction untouched. Admin layout guest redirect changed to `/login?next=/admin` (the layout cannot see the requested path; the old hardcoded `next=/admin/users` was wrong for other admin pages).
- **9.9 backend:** `GET /api/admin/sellers` → `{sellers:[{id,storeName,ownerUserId,ownerName,city,vacationMode,kycGst,kycPan,kycCheque,createdAt}], pagination}`; `require_admin`; ordered `createdAt DESC, id DESC`; 2 queries; KYC = stored enum values only; no GSTIN/bank/pickup/documents; read + `admin.sellers.list` audit commit together (500 on audit failure). SQLAlchemy `Seller` mapping gained `kycGst/kycPan/kycCheque/createdAt` (read-only, no DDL).
- **9.9 frontend:** `/admin/sellers` server page forwards `cw_session`; Sellers nav enabled (desktop + mobile); responsive table (store, owner, city, KYC pills, vacation, joined), pagination, loading/empty/error/unauthorized states; KYC pills show actual enum values with no inferred labels.
- **Files created:** `backend/tests/admin/test_admin_sellers.py`, `app/src/app/admin/sellers/{page,loading,error}.tsx`, `app/src/components/admin/AdminSellersTable.tsx`. **Modified:** `backend/fastapi_app/models/seller.py`, `domains/admin/service.py`, `schemas/admin.py`, `routers/admin.py`, `backend/tests/admin/conftest.py` (seller fixture) + `test_audit_events.py` (delta-based audit assertions), `app/src/lib/admin/pagination.ts` + test, `app/src/lib/api/adminApi.ts`, `app/src/components/admin/nav.ts`, `app/src/app/admin/activity/page.tsx`, `app/src/components/admin/AdminAuditTable.tsx`, `app/src/app/admin/layout.tsx`, `backend/README.md`, `TASKS.md`, `HANDOFF.md`.
- **Verification:** FastAPI **106/106** (11 new sellers tests incl. 401/403, contract, KYC, ordering/tie-break, bounds, audit-once, audit failure, unchanged records). Vitest **145/145**; `tsc` + full ESLint clean; production build OK. Production smoke: sellers 200 with 20 rows, “37 sellers · page 1 of 2”, page 2 valid, page 3 out-of-range with link; customer blocked; guest → `/login?next=/admin`; backend down → honest error; users/activity still 200. Playwright desktop 1440 and mobile 390 (sidebar hidden, bottom nav, table scroll) passed; no sensitive strings or backend URL in HTML.
- **Schema findings / limits:** `KycStatus` has only `verified | pending`; there is no KYC document table, no review/decision record, no seller onboarding-status column and no overall “verified seller” flag. The list therefore exposes only the three stored KYC flags; nothing is inferred. No approval/rejection actions, document viewer or seller mutations were built.
- **Database:** 0 smoke users/sessions after cleanup; `AuditEvent` now 29 append-only rows (verification reads); no seller/user rows changed.
- **Next:** 9.10 — seller detail/KYC review read slice, or explicit owner decision on adding KYC documents/decisions (schema change) before any approval workflow.

## Last completed task (TASK 9.8 - Admin activity log - 2026-11-10)

Branch `feature/backend-mvp` @ `1f0f61f` (nothing committed).

- **API:** `GET /api/admin/audit-events?page=1&pageSize=20` → `{events:[{id,action,actor:{id,name},targetType,targetId,metadata,createdAt}], pagination:{page,pageSize,total,totalPages}}`; `require_admin`; newest first (`createdAt DESC, id DESC`); 2 queries; metadata whitelisted to `page`/`pageSize`/`total` (drops tokens, passwords, nested/unknown keys); the read and its `admin.audit_events.list` row commit in one transaction (500 + rollback on audit failure). Append-only triggers still reject UPDATE/DELETE/TRUNCATE.
- **Frontend:** `/admin/activity` server page forwards `cw_session` to FastAPI; Activity log nav item enabled; table shows when, administrator (name + id), action (label + code), target, safe details; windowed pagination; loading/empty/error/unauthorized/forbidden states. Shared `AdminNotice` extracted; users page unchanged behaviour.
- **Files created:** `backend/tests/admin/test_audit_events.py`, `app/src/app/admin/activity/{page,loading,error}.tsx`, `app/src/components/admin/{AdminAuditTable,AdminNotice}.tsx`, `app/src/lib/admin/activity.ts` + `activity.test.ts`. **Modified:** `backend/fastapi_app/{domains/admin/service.py,schemas/admin.py,routers/admin.py}`, `backend/tests/admin/test_admin_users.py` (pre-existing audit rows now counted by delta), `app/src/lib/api/adminApi.ts`, `app/src/lib/admin/pagination.ts` + test, `app/src/components/admin/nav.ts`, `app/src/app/admin/users/page.tsx` (shared notice), `backend/README.md`, `TASKS.md`, `HANDOFF.md`.
- **Verification:** FastAPI **95/95** (11 new). Frontend Vitest **141/141** (23 files), `tsc --noEmit` clean, full ESLint clean, `npm run build` succeeded. Production smoke: admin page 200 with header “8 entries · page 1 of 1”, safe details (`page 1 · pageSize 20 · total 91`), page 2 → empty-page state, customer → access notice, FastAPI stopped → “Activity couldn’t load” (no mock data), `/admin/users` still 200. Browser (Playwright): desktop 1440 (11 rows, active “Activity log” nav, safe details, no backend URL), mobile 390 (sidebar hidden, bottom nav, table scrolls), non-admin blocked.
- **Database:** 0 smoke users/sessions after cleanup. `AuditEvent` now holds 14 legitimate append-only rows (the 8 from 9.7 plus 6 from verification reads); none modified or deleted.
- **Known limits:** no filters/search/date range; page size fixed 20; audit metadata outside the whitelist is hidden by design; viewing the log adds an entry (expected). The user list remains a separate slice.
- **Next:** 9.9 — next Admin read slice (sellers + KYC status) or extend audit-log filtering, owner to choose.

## Last completed task (TASK 9.7 - Admin console frontend - 2026-11-10)

Branch `feature/backend-mvp` @ `1f0f61f` (nothing committed).

- **Routes:** `/admin` redirects to `/admin/users`; `/admin/users` is a Server Component that forwards the existing `cw_session` cookie to FastAPI `GET /api/admin/users`. The layout gates on the Next session role for UX only; FastAPI `require_admin` remains the authorization boundary (no client-side role trust).
- **UI:** dark-navy admin sidebar + mobile bottom nav matching the seller/driver shells; prototype IA preserved (Overview, Approvals, Deliveries, Payouts, Sellers, Users, Activity log, Settings) with unimplemented items visibly disabled and titled “Available in a later task”; no fabricated metrics. Users table shows name, ID, email, phone, role pill and joined date; page size fixed at 20; windowed pagination; loading skeleton, empty page, error (backend down / unconfigured), unauthorized and forbidden states.
- **API config:** `FASTAPI_BASE_URL` is read server-side only (never `NEXT_PUBLIC_`); no mock fallback.
- **Files created:** `app/src/app/admin/{layout,page}.tsx`, `app/src/app/admin/users/{page,loading,error}.tsx`, `app/src/components/admin/{AdminIcon,AdminSidebar,AdminBottomNav,AdminTopBar,AdminAccessNotice,AdminUsersTable}.tsx`, `app/src/components/admin/nav.ts`, `app/src/lib/admin/pagination.ts` + `.test.ts`, `app/src/lib/api/adminApi.ts`. **Modified:** `TASKS.md`, `HANDOFF.md`, `backend/README.md`.
- **Verification:** `tsc --noEmit` clean; ESLint clean on all new/changed files; `npm run build` succeeded (`/admin`, `/admin/users` in the route manifest); Vitest **137/137** (22 files; two consecutive clean runs — the first full run had one transient failure that did not reproduce, likely the DB concurrency test). Production `next start` smoke: guest → `/login?next=/admin/users`; customer → “Administrator account required” with no table; admin → 20 rows, “91 accounts · page 1 of 5”, page 2 via link; FastAPI stopped → “Users couldn’t load”, no mock data; page-size/pagination query handling; no `FASTAPI_BASE_URL`/backend URL in HTML. Browser (Playwright, installed): desktop 1440 (table, 20 rows, page 2 click) and mobile 390 (sidebar hidden, bottom nav visible, table horizontally scrollable). Existing portals `/`, `/product/0`, `/cart`, `/search`, `/seller`, `/delivery`, `/orders` all 200.
- **Data note:** verification created **8 legitimate `AuditEvent` rows** (`admin.users.list`) against a real admin session; they are append-only and were intentionally left in place. Temporary smoke sessions/customer were deleted (0 residue). No real user rows modified.
- **Known limits:** only the Users slice exists; no search/filter/sort, no user actions (edit/suspend/roles), no other admin destinations; page size fixed at 20; `page` beyond the end renders the empty state with a link back.
- **Next:** 9.8 — next Admin read slice (e.g. sellers + KYC status with the same audit pattern) or admin audit-log browsing, owner to choose.

## Last completed task (TASK 9.6 - Admin users slice + audit - 2026-11-10)

Branch `feature/backend-mvp` @ `1f0f61f` (nothing committed). The approved AuditEvent migration is applied to the local DB only.

- **Endpoint:** `GET /api/admin/users?page=1&pageSize=20` → `{users:[{id,email,name,phone,role,createdAt}], pagination:{page,pageSize,total,totalPages}}`. Protected by `require_admin` (401 `unauthenticated` / 403 `forbidden`); page 1–10000, `pageSize` 1–50 (default 20), invalid input → 400 `validation_error`; deterministic `createdAt DESC, id DESC`; 2 queries (count + page), no N+1; no password hashes/tokens/emails beyond the admin overview fields.
- **Audit:** new SQLAlchemy mapping `models/audit.py` (no DDL; `metadata` column mapped as `audit_metadata`). `domains/admin/service.py` writes one `admin.users.list` event per successful read with actor from `require_admin`, `targetType="User"`, metadata `{page,pageSize,total}` only, `db.flush()` and **no internal commit**. The router commits the read + audit together in the request session; any failure rolls back and returns 500 `internal_error` without internals. Append-only triggers make the row immutable.
- **Files created:** `backend/fastapi_app/models/audit.py`, `domains/admin/{__init__,service}.py`, `schemas/admin.py`, `routers/admin.py`, `tests/admin/{conftest,test_admin_users}.py`. **Modified:** `fastapi_app/main.py` (router + tag), `TASKS.md`, `HANDOFF.md`, `backend/README.md`.
- **Verification:** new admin tests **15/15**; full FastAPI suite **84/84**; auth suite still green. Fixtures use one outer transaction + savepoint join so the endpoint's commit only releases a savepoint; after the run: **0** `AuditEvent` rows and **0** `test_admin_*` users/sessions. `compileall` exit 0; `git diff --check` exit 0. `ruff`/`mypy` are not installed in the backend venv (no Python lint/type tool configured). No browser or production verification.
- **Known limits:** this is the first Admin vertical slice only — no frontend, no dispute resolution, no seller/KYC/audit-log browsing. `page` beyond the last page returns an empty list with the true total (no clamp), consistent with the catalogue API. Audit metadata is unvalidated JSONB at the DB level; the service keeps it minimal.
- **Next:** 9.7 — next Admin read slice (e.g. paginated sellers + KYC status with the same audit pattern), or migrate the remaining catalogue write paths; owner to choose.

## Last completed task (TASK 9.5 - reviews + rating histogram read path - 2026-11-10)

Branch `feature/backend-mvp` @ `1f0f61f` (nothing committed).

- **Contract finding (important):** the Next.js app has **no HTTP route** for reviews or the rating histogram — `/product/[id]` calls `server/catalog/service.ts#listProductReviews` / `getReviewHistogram` directly. The preserved contract is therefore the existing service DTO (`ProductReviewDto`, `number[5]`), not a legacy endpoint. Recorded in `backend/README.md`; no Next.js endpoint was invented as "legacy".
- **New FastAPI endpoints:** `GET /api/products/{id}/reviews` → `{reviews:[{name,stars,title,body,postedOn}]}`; `GET /api/products/{id}/rating` → `{histogram:[5★..1★]}`. Lookup by id **or** code, 404 `product_not_found`, 400 `validation_error` for an over-long id, newest-first ordering, en-IN date, `5−stars` buckets, JS `Math.round` percentages, batched queries (no N+1). Read-only.
- **Facade:** `catalogDb.getProductReviews` / `getRatingBreakdown` call FastAPI when `FASTAPI_BASE_URL` is set; a FastAPI 404 maps to the existing `[]` / `[0,0,0,0,0]` (no fallback), other failures use the existing `catalogSource.ts` fallback and log label + error name only.
- **Files created:** `backend/tests/catalog/test_reviews.py`. **Modified:** `backend/fastapi_app/models/catalog.py` (Review fields), `schemas/catalog.py`, `domains/catalog/service.py`, `routers/catalog.py`, `backend/tests/catalog/test_contract_equivalence.py` (default Next URL → `:3000`), `backend/README.md`, `app/src/lib/api/catalogApi.ts`, `app/src/lib/api/catalogDb.ts`, `TASKS.md`, `HANDOFF.md`.
- **Verification:** FastAPI **69/69** (14 live catalogue contract cases vs Next on :3000, 10 new review tests). Next Vitest **132/132**. `tsc --noEmit` clean; ESLint clean; `git diff --check` clean. Cutover-vs-Prisma probe on products 0 and 10: **byte-identical** (`reviews:2`, histogram `[50,0,50,0,0]`, dates `5 November 2026`/`26 October 2026`), unknown product → `[]`/zeros. FastAPI stopped + fallback on → identical data; fallback off → `TypeError`. PDP HTML 200 with the review section rendered; no `127.0.0.1:8001`/`FASTAPI_BASE_URL` in the HTML. **No browser/visual inspection was performed.**
- **Known gaps:** the running Next dev server on :3000 was pre-existing and not restarted with cutover env, so the cutover was verified through the exact facade functions the page calls, not via page-level FastAPI traffic (uvicorn logs do confirm the probe's requests). Review writes, moderation and helpful votes remain unimplemented/Next-side.
- **Next:** 9.6 — Start the net-new Admin slice in FastAPI (`GET /api/admin/...` with `require_admin`, audit logging), per `MIGRATION_ROADMAP` Phase 1 "Workflow 12 minimal slice".

## Last completed task (TASK 04 - frontend catalogue cutover - 2026-11-10)

Branch `feature/backend-mvp` @ `1f0f61f` (nothing committed).

- **Data flow before:** page → `lib/api/catalogDb.ts` → `server/catalog/service.ts` → Prisma → PostgreSQL.
- **Data flow after:** page → `catalogDb` → (FastAPI HTTP `/api/products*`, `/api/categories`) when `FASTAPI_BASE_URL` is set → SQLAlchemy → PostgreSQL. On network/5xx failure it logs `[catalogue] FastAPI <label> request failed; using the Next.js implementation` (label + error name only, never the URL) and calls the unchanged Prisma path.
- **Files:** new `app/src/lib/api/catalogSource.ts` (config + fallback), new `app/src/lib/api/catalogSource.test.ts`; modified `app/src/lib/api/catalogDb.ts` (list/detail/offers + `getCategories`, FBT/similar now use the shared detail loader), `app/src/app/api/categories/route.ts` (delegates to `catalogDb.getCategories`), `app/.env.example`, `TASKS.md`, `HANDOFF.md`.
- **Config (server-only, never `NEXT_PUBLIC_`):** `FASTAPI_BASE_URL` (empty ⇒ old behaviour), `CATALOG_SOURCE=next` (force rollback), `CATALOG_FALLBACK=off` (surface FastAPI errors).
- **Unchanged:** all public facade signatures/types, query params, DTO shapes, not-found → `null`/`[]` semantics, and the Prisma implementation (kept as fallback). Reviews, rating histogram, recently-viewed batch lookup and search facets stay on Prisma.
- **Verification:** Next Vitest **132/132** (21 files, +7 fallback tests); FastAPI **59/59**; `tsc --noEmit` clean; ESLint clean on changed files; `git diff --check` clean. Live run with FastAPI on :8001 and Next on :3000 under cutover env: home 200 with product rows, `/search?q=cement` 200, `/search?cat=Cement` 200, `/product/0` 200 with seller offers and buy box; uvicorn access log showed the `/api/products` traffic (proves FastAPI served it). FastAPI stopped → home still 200 via fallback. Direct facade probe: fallback OFF + dead URL throws (`TypeError`), fallback ON returns 10 deals rows + product detail. No `127.0.0.1:8001`/`FASTAPI_BASE_URL` string in rendered HTML. No visual/browser-screenshot check was performed.
- **Known gaps:** search facets and reviews not migrated; FastAPI must be reachable at `FASTAPI_BASE_URL` in each environment (deployment config not set); recently-viewed cards still use the Prisma batch lookup.
- **Next:** 9.5 — migrate reviews/rating histogram read path (workflow 2 remainder) or start Workflow 12 admin slice; roadmap next listed item is `GET /api/products/[id]` reviews + rating histogram.

## Last completed task (TASK 03 - catalogue read-side in FastAPI - 2026-11-10)

Branch `feature/backend-mvp` @ `1f0f61f` (nothing committed).

- **Endpoints (paths/envelopes identical to Next.js):** `GET /api/categories`; `GET /api/products` (`q`, `category` by id or name case-insensitive, `sort` = relevance/price_asc/price_desc/name_asc/newest, `page`, `pageSize` 1–50 default 12); `GET /api/products/{id}` (id **or** code); `GET /api/products/{id}/offers` (offers duplicated at top level and inside `product`). Invalid input → `400 validation_error`; unknown product → `404 product_not_found`.
- **New files:** `fastapi_app/models/catalog.py` (Category, Product, SellerOffer, SellerPincode, Review), `fastapi_app/domains/catalog/service.py`, `fastapi_app/schemas/catalog.py`, `fastapi_app/routers/catalog.py`, `tests/catalog/{test_catalog_api,test_contract_equivalence}.py`. Modified: `main.py` (router), `tests/conftest.py` (shared `db`/`api_client` fixtures, moved from auth conftest), `README.md`, `TASKS.md`, `HANDOFF.md`.
- **Parity preserved:** public-offer rule (active + stock ≥ 1 + seller not on vacation), cheapest-offer price/stock/min/lead time, offerCount filter, price sorts computed over the full filtered set then paginated, `total` counted before the offerCount filter for non-price sorts (the existing quirk), exact 2-decimal money strings, no private seller fields.
- **Queries:** batched per request (products → offers → review aggregate → pincodes); no N+1. Status enum compared as text because PostgreSQL `ProductStatus` has no implicit `=` varchar operator.
- **Verification:** FastAPI suite **59/59** (27 previous + 32 catalogue). **14/14 live contract-equivalence cases matched the running Next.js dev API** (`127.0.0.1:64704`) with deep JSON equality after normalising pincode order. Existing Vitest catalogue suite **4/4**. Read-only: no Next.js change, no Prisma change, no schema mutation.
- **Known gaps:** catalogue writes, reviews, wishlist, search facets (brand/price/rating) and the frontend cutover are still Next.js; price sorts still load the full filtered set (same trade-off as today, fine at 48 rows); contract test skips if no Next API is running.
- **Next:** 9.4 — cut the Next.js catalogue facade (`lib/api/catalogDb.ts`) over to the FastAPI endpoints behind configuration, keeping the Vitest suite green.

## Last completed task (TASK 02 - authentication read-side parity - 2026-11-10)

Branch `feature/backend-mvp` @ `1f0f61f` (nothing committed). Foundation from TASK 01 unchanged.

- **New:** `fastapi_app/models/{base,identity,seller}.py` (read-only SQLAlchemy mappings of `User`, `Session`, `Seller`, `Driver` — exact quoted camelCase columns, no DDL), `fastapi_app/core/security.py` (cookie/token/bcrypt/role deps), `fastapi_app/schemas/auth.py`, `fastapi_app/routers/auth.py`, `tests/auth/{conftest,test_me,test_security,test_dependencies}.py`. Modified: `fastapi_app/main.py` (router + tag), `requirements.txt` (+bcrypt), `pyproject.toml` (session-scoped asyncio loops for the shared async engine), `README.md`.
- **Behaviour:** validates the existing `cw_session` cookie by `sha256(token)` against the shared `Session` row, strict future-expiry (no renewal), naive Prisma timestamps treated as UTC, returns the exact Next `PublicUser` contract. `require_user`, `require_customer`, `require_role`, `require_seller`→`(user,seller)`, `require_driver`→`(user,driver)`, `require_admin` mirror `session.ts`/`current.ts` error codes. bcrypt hashes verified as-is (bcryptjs `$2b$12$` vector passes); login/register/logout untouched and still Next.js.
- **Tests:** **27/27 passed**. New coverage: valid/missing/invalid/expired/revoked session, all four roles, seller+driver profile scoping, contract shape (no `passwordHash`/token leakage), Node sha256 token vector, bcryptjs/Python bcrypt round-trip, malformed-hash fail-closed, naive/aware expiry. Fixtures create `test_*` rows and delete them; residue check after the run: 0 User/Session/Seller/Driver test rows.
- **Live check:** `/api/auth/me` → `401 {"error":{"code":"unauthenticated",...}}` without a cookie, `401` with a bogus cookie; OpenAPI lists `/health`, `/health/db`, `/api/auth/me`.
- **Files:** `backend/fastapi_app/{models,core/security.py,schemas/auth.py,routers/auth.py,main.py}`, `backend/tests/auth/**`, `backend/{requirements.txt,pyproject.toml,README.md}`, `TASKS.md`, `HANDOFF.md`. No Prisma/Next.js/audit change; no schema mutation; no commit/push/deploy.
- **Next:** 9.3 catalogue domain in FastAPI (categories, product list/detail/offers) with contract-equivalence tests.

## Last completed task (TASK 01 - FastAPI foundation - 2026-11-10)

Branch `feature/backend-mvp` @ `1f0f61f` (nothing committed). Target architecture is owner-confirmed (`docs/architecture-assessment-2026-11-10/`); this is its first implementation step, not another audit.

- **Created `backend/`** (Python 3.12.4, venv-local deps): `fastapi_app/main.py` (app factory, CORS, exception handlers, lifespan), `core/{config,db,errors,logging}.py`, `routers/health.py`, `tests/` (4 files), `requirements.txt`, `requirements-dev.txt`, `pyproject.toml`, `README.md`, `.env.example`, `.gitignore`.
- **Config:** reads `DATABASE_URL` from `backend/.env` then the existing `app/.env` (same contract as Next.js); Prisma URL query params (`schema`, `connection_limit`, …) are stripped and the scheme rewritten to `postgresql+asyncpg`. Credentials are never logged or returned.
- **Endpoints:** `GET /health` (liveness), `GET /health/db` (executes `SELECT 1`; 503 when unreachable or unconfigured). `/docs` and `/openapi.json` generated.
- **Conventions:** error body `{"error":{code,message,field?}}` matching `apiFetch`; single-line JSON logs with `x-request-id`; CORS origins from `CORS_ORIGINS`.
- **Schema:** untouched. Prisma remains the only migration authority; Alembic deliberately not initialised, no migrations run.
- **Verification:** `.venv\Scripts\python.exe -m pytest` → **6/6 passed** (includes the real-DB `/health/db` test). Live uvicorn run: `/health` 200, `/health/db` 200 `{"status":"ok","database":"ok","latency_ms":381}`, `/docs` 200, `/openapi.json` 200 with paths `/health`, `/health/db`. Server stopped afterwards; port 8000 released.
- **Files:** all under `backend/` plus `TASKS.md`, `HANDOFF.md`. No Next.js, Prisma, production config or audit file touched. No commit/push/deploy.
- **Next:** 9.2 auth read-side parity (bcrypt + shared `Session` validation, `GET /api/auth/me` equivalent), per `AUTHENTICATION_MIGRATION_PLAN.md`.

## Last completed task (Phase 04B - WP-UI-01 product-card Add to cart - 2026-11-10)

Branch `feature/backend-mvp` @ `1f0f61f` (nothing committed). Baseline: accepted Phase 04A audit in `docs/ui-fidelity-audit-2026-11-10/` (11/11 deliverables, 130 evidence files). The earlier "Fix card Add to cart - 19 files changed" Freebuff claim was verified as **false** in the prior checkpoint; the card CTA was still `disabled` at HEAD.

- **What changed:** `ProductSummaryDto` now exposes the cheapest purchasable offer (`offerId`, `stock`, `minOrderQty`, `purchasable`), derived in `summarize()` from the offers query that already ran - no schema, migration, endpoint or cart-rule change. `catalogDb.cardOf` copies them onto `ProductCardData`; `ProductCard` (still a server component) renders a new client `AddToCartButton`.
- **Behaviour:** adds the seller's `minOrderQty` via the existing `addCartItem`/`RemoteCartProvider`; header badge updates from the returned cart. Guests redirect to `/login?next=<current path>`; signed-in non-customers get a toast; unavailable cards are disabled and read "Out of stock"; duplicate clicks blocked while in flight; server 409/422 messages (stock, min qty, paused listing) shown verbatim. PDP buy box untouched.
- **Tests:** new `src/lib/cart/cardAddToCart.test.ts` (9 cases: success, min-qty clamp, unavailable, guest redirect, role refusal, duplicate, session loading, server error, unknown error) plus 4 assertions on the summary offer fields in `server/catalog/service.test.ts`. Full suite **125/125**, `eslint src` clean, `tsc --noEmit` clean.
- **Not verified:** no browser click-through this pass (per task instruction not to repeat captures); the audit's CUST-09 finding is addressed in code and unit tests only. Legacy local `CartProvider` (unused by any view) would render mock-facade cards as "Out of stock" - dead code path, no user-facing surface.
- **Files:** `app/src/server/catalog/service.ts`, `app/src/lib/api/{dto,catalog,catalogDb}.ts`, `app/src/components/home/ProductCard.tsx`, new `app/src/components/cart/AddToCartButton.tsx`, new `app/src/lib/cart/cardAddToCart.ts`, new `app/src/lib/cart/cardAddToCart.test.ts`, `app/src/server/catalog/service.test.ts`, `TASKS.md`, `HANDOFF.md`. No commit, push or deploy. Stop before WP-UI-02.

## Last completed task (integration & pre-push stabilization — 2026-11-08)

Branch `feature/backend-mvp` @ `2831af7`; the Phase 2 Seller Portal work remains **uncommitted in the working tree** (18 tracked files + untracked new routes/services/tests), preserved exactly as found.

- **Test-data leak fixed (confirmed defect from the 2026-11-08 audit):** cleanup in `src/server/orders/{sellerService,driverService,service}.test.ts` created `Address` and `SellerPincode` rows (plus one seller-scoped `withdrawn` EscrowEntry in the payments test) but never deleted them; Prisma's default `Restrict` FK then made `seller.deleteMany`/`user.deleteMany` fail silently under `.catch(() => {})`, leaking rows on every DB-backed run. Cleanup now also deletes `address` (by userId list), `sellerPincode` (by sellerId list) and, in sellerService.test, `escrowEntry` (by sellerId list). Verified by row-count before/after a full test run: zero new residue. Fix pattern mirrors the already-correct `src/server/seller/delivery.test.ts`.
- **Negative balance display fixed:** payments page and Overview payouts card flag `available < 0` ("Bank transfers on record exceed escrow released so far") in text-bad tone instead of showing it as a clean withdrawable figure. No clamping — nothing hidden.
- **Docs reconciled with code:** TASKS.md 6.1/6.3/6.4/6.5/6.6 no longer describe the seller work as client-only preview; each row now records which parts are server-backed (`/api/seller/summary|delivery*|payments|performance|settings`) and what remains preview (vehicles/drivers, KYC upload, seller-attributed reviews, notification prefs, sales charts, top products).
- **Not touched:** production deployment/Render config, schema/migrations, `artifacts/`, `app/tests/`, `app/.github/` (excluded from staging per owner rule), Phase 1 behavior, seeded DB content.
- **Production is live (owner-verified, 2026-11-08):** the Render deployment is up and independently verified — homepage returns HTTP 200 and renders in the browser, `GET /api/health` returns HTTP 200 with `database: ok`, and all four referenced CSS/JS assets return HTTP 200. **These checks cover the deployed commit (`2831af7`); the uncommitted Phase 1 (cart/checkout wiring) and Phase 2 (Seller Portal) working-tree changes have NOT been deployed and go live only after review, approve-to-stage, commit/push and redeploy.** No further Render blocker exists for this branch.
- **Verification (this session):** `tsc --noEmit`, `npm run lint`, `npm run test` and `npm run build` all run after the fixes — see final report.

## Last completed task (FINAL MVP — order lifecycle closure, live portal counts, deployment-ready — 2026-11-08)

Branch `feature/backend-mvp`. **Phase 1 and Phase 2 complete and verified. *(Correction 2026-11-08: this section's "deployment blocked, no public URL" statement is outdated — production is now live and owner-verified; see the stabilization checkpoint above.)*** No schema change, no seed, no commit/push.**

- **Cancellation:** `POST /api/orders/[id]/cancel` (customer-only, strict Zod reason) cancels an order only while every shipment is `new|accepted|packed`. It locks shipments, restores reserved stock exactly once, creates `refund` escrow entries per held entry, writes a customer `ShipmentEvent`, sets `Order.cancelled`, and returns 409 after any dispatch. Customer order detail now has a real cancel dialog, cancellation/refund banner and escrow status.
- **Stage sync:** new `server/orders/lifecycle.ts` derives parent `Order.stage` from all shipments and is used by customer cancellation, seller accept/pack/reject/dispatch and driver deliver/issue. Mixed deliveries stay `shipped` until every shipment is delivered; all-cancelled/rejected orders are marked cancelled, never delivered.
- **Seller live counts:** new `GET /api/seller/summary` + `SellerLiveProvider`. Overview cards and sidebar badges now use real shipment/inventory counts; they refresh after every order action. Sales charts/payout figures remain preview data and are disclosed.
- **Health/deploy:** `/api/health` now verifies PostgreSQL (`database: ok`, 503 otherwise). Added `render.yaml`, updated `docker-compose.yml` with Postgres, and added `docs/FINAL_MVP_DEPLOYMENT.md` (Render Free web + Neon Free Postgres, paid upgrade caveat, exact env checklist).
- **Tests:** `tsc` 0, `eslint` 0, `npm run test` **106/106** (new cancellation, duplicate, post-dispatch block and mixed-stage tests), `npm run build` 0.
- **Browser:** disposable seller with two orders. Seller Overview showed live New 1 / Ready 1 and the Orders badge was 1. Customer cancelled one pre-dispatch order from `/orders/BG-939730` with a reason; UI showed cancelled + refund note, DB showed shipment `cancelled`, `Order.cancelled=true`, refund ₹299, stock restored 18→19. Seller Overview then showed New 0 / Ready 1. All disposable records removed; DB restored to `User=24`, `Seller=7`, `SellerOffer=48`, `Order=16`, `Shipment=16`, `Session=0`.
- **Deployment status:** no Render/Neon/Vercel/Fly credentials or authenticated CLIs exist in this environment; Docker daemon is not running. No paid resources were created and no public URL is claimed. Owner must approve push/accounts and set `DATABASE_URL`, `APP_ORIGIN`, `OTP_ENCRYPTION_KEY`; run `npx prisma migrate deploy` once, then deploy from `render.yaml`. See `docs/FINAL_MVP_DEPLOYMENT.md`.
- **Files:** `app/src/server/orders/{lifecycle.ts,service.ts,service.test.ts,sellerService.ts,driverService.ts,validation.ts}`, `app/src/app/api/orders/[id]/cancel/route.ts`, `app/src/app/api/seller/summary/route.ts`, `app/src/app/api/health/route.ts`, `app/src/lib/api/{orderApi,orderDto,sellerOrderDto}.ts`, `app/src/components/cart/OrderDetailView.tsx`, `app/src/components/seller/{SellerLiveProvider,SellerSidebar,OrdersView}.tsx`, `app/src/app/seller/{layout,page}.tsx`, `app/docker-compose.yml`, `app/.env.example`, `render.yaml`, `docs/FINAL_MVP_DEPLOYMENT.md`, `TASKS.md`, `HANDOFF.md`.

## Last completed task (TASK 4.3 — driver assignment, delivery & OTP — 2026-11-08)

Branch `feature/backend-mvp`. **Driver delivery and OTP verification now persist to PostgreSQL; no schema change, no seed, no commit/push.**

- **APIs:** `GET /api/driver/jobs`, `GET /api/driver/jobs/[shipmentId]`, `POST .../accept`, `POST .../deliver`, `POST .../issue`. Every route uses `requireDriver()` and queries by the authenticated `Driver.id`; another driver's shipment returns 404.
- **Assignment:** seller dispatch already writes `Shipment.vehicleId`/`driverId` from the selected seller-owned vehicle. Dispatch now also validates that the linked driver belongs to the same seller. A shipment has one `driverId`, so it cannot be assigned to two drivers at once; no public reassignment endpoint was added.
- **OTP:** `src/server/security/otp.ts` generates a cryptographically secure 4-digit code, bcrypt-hashes it into `otpHash`, and AES-256-GCM encrypts a copy into `otpEncrypted` using `OTP_ENCRYPTION_KEY`. Dispatch resets `otpTries`. Only `getOrder` (owning customer) decrypts the code and only while that shipment is `dispatched`; seller/driver/list APIs never expose it.
- **Delivery:** transactional `SELECT … FOR UPDATE` on the shipment; verifies assigned driver + `dispatched` status, bcrypt OTP, max 3 tries (third wrong commits `failed` + `failed_attempt` issue), delivered quantity, `deliveredAt`, `reviewEnds`, `ShipmentEvent`, and parent `Order.stage` derived across all shipments. Concurrent submissions deliver at most once. Escrow stays held.
- **Issues:** customer unavailable, address/serviceability (mapped to `failed_attempt` with a note), damaged goods and short quantity. Short quantity records the delivered quantity, opens a `short_quantity` issue with a proportional claim and `disputed` status; reporting an issue never marks the shipment delivered.
- **Customer UI:** `/orders/[id]` shows a shipment-level delivery OTP box for the owning customer only while dispatched, plus each seller shipment's status/events.
- **Driver UI:** `/delivery`, `/jobs`, `/history`, `/settings` now read the real driver API with an auth gate (`/login?next=/delivery`) and driver-role notice. Jobs support Accept, OTP entry (no demo code), photo checkbox, delivered quantity, Confirm delivery and issue reporting. All mock delivery mutations and the deterministic demo OTP were removed.
- **Config:** `OTP_ENCRYPTION_KEY` was missing from the local `app/.env`; a random 32-byte base64 key was added locally (gitignored, never printed). `.env.example` explains it is required for dispatch.
- **Tests:** `tsc` clean; `eslint` 0; `npm run test` **103/103** across 16 files; `npm run build` exit 0. New `driverService.test.ts` covers driver ownership (cross-driver 404), idempotent accept, wrong-OTP attempt limit, successful delivery + order stage, short-quantity dispute/escrow, issue blocking and concurrent delivery.
- **Browser:** disposable seller/driver/customer. Customer order page showed OTP `5815` while dispatched. Driver accepted the job, submitted a wrong OTP (UI showed “Incorrect OTP. 2 tries left.”, DB tries=1), then the correct OTP; UI moved to “Delivered, in review”. DB confirmed `status=review`, `deliveredAt`, `deliveredQty=1`, `Order.stage=delivered`, escrow still `held` (₹299). Disposable records deleted; DB restored to `User=24`, `Seller=7`, `SellerOffer=48`, `Cart=0`, `CartItem=0`, `Order=16`, `Shipment=16`, `Session=0`.
- **Files:** `app/src/server/orders/{driverService,driverService.test,driverValidation}.ts`, `app/src/app/api/driver/jobs/**`, `app/src/lib/api/{driverApi,driverDto}.ts`, `app/src/components/delivery/{driverAdapter,DeliveryStoreProvider,DeliveryJobDrawer,DeliveryJobsView,DeliveryHistoryView,DeliveryAccessNotice,PreviewDisclosure,DeliverySidebar,DeliveryTopBar}.tsx`, `app/src/lib/delivery/{types,rules}.ts`, `app/src/app/delivery/{layout,page,error}.tsx`, `app/src/app/delivery/settings/page.tsx`, `app/src/components/cart/OrderDetailView.tsx`, `app/src/lib/api/orderDto.ts`, `app/src/server/orders/service.ts`, `app/src/server/orders/sellerService.ts`, `app/prisma/seed.ts`, `TASKS.md`, `HANDOFF.md`.
- **Known limits:** OTP has no expiry (D5 open); no SMS/WhatsApp/GPS or photo storage (checkbox is client-attested only); delivery does not release/settle escrow (later admin/settlement task); seller accept/pack/dispatch still does not advance `Order.stage`; driver dashboard/history counts come from real jobs but review-window settlement is not implemented.

## Last completed task (TASK 4.2 — seller order lifecycle & dispatch — 2026-11-08)

Branch `feature/backend-mvp`. **Seller shipment accept/reject/pack/dispatch now persist to PostgreSQL; no schema change, no seed, no commit/push.**

- **APIs:** `GET /api/seller/orders` (own shipments + vehicles/drivers/rules), `GET /api/seller/orders/[shipmentId]`, `POST .../accept`, `POST .../reject`, `POST .../pack`, `POST .../dispatch`. Every route uses `requireSeller()` and scopes by the authenticated Seller.id; cross-seller ids return 404.
- **Transitions:** accept only `new` → `accepted` (sets 24h dispatch deadline + event); pack only `accepted` → `packed`; dispatch only `accepted|packed` → `dispatched` (vehicle/driver/slot/docs/e-way/weighbridge, late flag, event); reject only `new` → `rejected` with reason, exactly-once stock restoration, auto-reactivation when stock returns, and an escrow `refund` entry. Duplicate/concurrent actions are guarded by status-scoped updateMany and return 409. Accept never deducts stock or releases escrow.
- **Multi-seller:** one customer order still has independent per-seller shipments; each seller sees only their shipment/lines/events. List/detail DTOs include buyer snapshot, seller lines, vehicle/driver, docs and timeline.
- **UI:** `/seller/orders` now uses the API, with loading/empty/error states, Accept, Mark packed, Reject and Dispatch actions, real status/deadlines, timeline, vehicles/drivers from the DB, and no `SellerStoreProvider` order mutations. Existing layout/dialogs preserved; dispatch button no longer claims OTP/SMS.
- **Tests:** `tsc` clean; `eslint` 0; `npm run test` **96/96** across 15 files (new seller lifecycle tests cover ownership, accept/pack/dispatch, duplicate action, reject stock restoration and escrow refund); `npm run build` exit 0.
- **Browser:** disposable seller with two orders. Accepted first order (stock unchanged), packed it, dispatched with vehicle/slot/challan/invoice/weighbridge; rejected second order with reason (stock restored 20→19 for the dispatched order only; refund entry created). UI showed correct statuses/timeline. All disposable order/seller/customer/vehicle/driver records deleted; DB restored to `User=24`, `Seller=7`, `SellerOffer=48`, `Cart=0`, `CartItem=0`, `Order=16`, `Shipment=16`, `Session=0`.
- **Files:** `app/src/server/orders/{sellerService,sellerService.test,sellerValidation}.ts`, `app/src/app/api/seller/orders/**`, `app/src/lib/api/{sellerOrderDto,sellerOrderApi}.ts`, `app/src/components/seller/{OrdersView,OrderDrawer,DispatchDialog,RejectDialog,orderAdapter}.tsx`, `app/src/lib/seller/types.ts`, `TASKS.md`, `HANDOFF.md`.
- **Known limits:** deadline labels are relative at fetch time, not live-ticking; dispatch does not generate an OTP (Driver/OTP task); customer Order.stage is not advanced by seller actions yet; seller Overview/sidebar badges still use the mock provider.

## Last completed task (TASK 4.1 — real checkout + multi-seller orders — 2026-11-08)

Branch `feature/backend-mvp`. **Checkout now creates real PostgreSQL orders in one transaction; no schema change, no seed, no commit/push.**

- **Addresses:** `GET/POST /api/addresses`, `PATCH/DELETE /api/addresses/[id]`; customer-only ownership, strict Zod validation, default-address handling.
- **Preview:** `POST /api/checkout/preview` re-reads the DB cart, validates offer/stock/min-order/seller vacation, seller pincode serviceability, coupon and COD cap; returns seller groups/totals/errors/canPlaceOrder. No client totals are trusted.
- **Placement:** `POST /api/orders` requires `Idempotency-Key`; single `$transaction`: address/cart load, deterministic `FOR UPDATE` locks, revalidation, stock decrement + auto-pause, Order + immutable OrderLine snapshots, one Shipment per seller + initial event, per-seller EscrowEntry (coupon discount allocated proportionally), cart cleanup, rollback on any failure. `paymentMethod=COD`, ₹50,000 cap.
- **Idempotency (D23, no schema change):** deterministic internal `Order.id = ord_ + SHA-256(userId:key)`, primary-key enforced; duplicate/retried requests return the same order and the second stock decrement rolls back. Browser key lives in `sessionStorage` until success.
- **Read APIs:** `GET /api/orders` (newest-first) and `GET /api/orders/[id]` (code or id), customer-scoped; order DTO includes lines, per-seller shipments/events, address snapshot and financial totals.
- **UI:** `/checkout` migrated to real addresses/preview/place APIs with loading/validation/error/empty states and server-driven totals; `/orders`, `/orders/[id]`, `/thanks/[id]` read the real order API (no `cw-orders` source of truth); confirmation shows the real `BG-######` code; disabled checkout until preview is valid; duplicate submission blocked. `OrderCard` adapter preserves the existing visual design.
- **Defects found/fixed during verification:** missing order stock decrement (added inside the locked transaction); stale `cw_coupon` cookie leaking between accounts (now cleared on login/logout/success); order tracker timestamp adapter no longer labels the placement event as “Packed”.
- **Tests:** `tsc` clean; `eslint` 0; `npm run test` **94/94** across 14 files (new order tests cover multi-seller split, price re-read, transaction rollback, ownership, idempotent duplicate, concurrent submit); `npm run build` exit 0.
- **Browser:** disposable customer + temp seller/offer. Successful checkout: preview canPlace, order created `BG-494861`, total ₹299, stock decremented, cart cleared, `/thanks` showed the real code, `/orders` and detail showed shipment/events. Rejected checkout: unserviceable pincode 999999 → preview error “does not deliver”, place button disabled, order count unchanged. All disposable order/seller/customer records deleted; DB restored to `User=24`, `Seller=7`, `SellerOffer=48`, `Cart=0`, `CartItem=0`, `Order=16`, `Shipment=16`, `Session=0`.
- **Files:** `app/src/server/orders/{addresses,service,validation}.ts`, `app/src/app/api/{addresses,checkout,orders}/**`, `app/src/lib/api/{orderDto,addressApi,orderApi}.ts`, `app/src/components/cart/{CheckoutView,OrdersView,OrderDetailView,ThanksView,orderAdapters,OrderCard}.tsx`, auth routes (coupon clear), tests, `TASKS.md`, `DECISIONS.md`, `HANDOFF.md`.
- **Remaining:** order cancel/reorder not implemented (hidden); Coupon expiry still unmodelled; no Seller accept/dispatch, Driver OTP/delivery or Admin work yet.

## Last completed task (TASK 3.5 — persistent multi-seller cart — 2026-11-08)

Branch `feature/backend-mvp`. **Cart is now PostgreSQL-backed for authenticated customers; no schema change, no seed, no commit/push.**

- **APIs:** `GET /api/cart`, `POST /api/cart/items`, `PATCH/DELETE /api/cart/items/[itemId]`, `POST/DELETE /api/cart/coupon`. All require `requireCustomer()`; seller/driver/admin get 403, guests 401.
- **Model:** existing `Cart`/`CartItem` rows by `sellerOfferId`; one row per offer (adds merge quantity); save-for-later supported; cart survives logout/login/restarts. Every query is scoped by `cart.userId`; client `userId` is never accepted.
- **Pricing (Decimal):** bulk tiers reuse `BULK` from `lib/shop/pricing.ts`; per-seller delivery uses `Seller.freeAbove/fee`; coupon from DB `Coupon` (with a fallback for the three approved codes while the table is empty); GST 18/118 inclusive; all money serialized as fixed strings.
- **Coupon validation:** active, min subtotal, flat/percent, max cap, first-order-only, free-delivery. Invalid/min/first-order errors are 422. Coupon selection persists in an HTTP-only `cw_coupon` cookie (the schema has no Cart.coupon column; no schema change was made). **Schema gap: Coupon has no expiry columns, so expiry cannot be validated until a future approved migration.**
- **Concurrency/stock:** every mutation re-reads the offer inside a transaction and locks the `SellerOffer` row with `FOR UPDATE`; quantity cannot exceed stock. Cart operations never decrement stock.
- **Frontend:** `RemoteCartProvider` + `lib/api/cartApi.ts`; `BuyBox` now posts the selected `SellerOffer.id` (guests redirect to login, non-customers get a message), `CartBadge` reads server count, `CartView` re-rendered into seller groups with qty/save/delete/coupon/totals states. Guest `cw-cart` is untouched and a merge prompt maps eligible `s:0` entries to current offers; unmapped entries stay in localStorage. Checkout button is disabled because checkout/order creation is the next task.
- **Tests:** `tsc` clean; `eslint` 0; `npm run test` **91/91** across 13 files (pricing, coupon, multi-seller persistence, duplicate merge, ownership 404, save/move/remove, coupon validation, concurrent-add serialization); `npm run build` exit 0. Browser: temp customer add 10 units of product 0 → cart showed seller group/subtotal ₹3,783 + delivery ₹199 + GST; BUILD10 applied; quantity 10→11 recalculated totals/coupon; logout/login preserved 11 items + BUILD10; guest-cart banner appeared and “Keep for later” left `cw-cart` intact. Temp customer deleted; final DB `User=24`, `Cart=0`, `CartItem=0`, `Session=0`.
- **Files:** `app/src/server/cart/{pricing,service,validation}.ts`, `app/src/app/api/cart/**`, `app/src/lib/api/{cartDto,cartApi}.ts`, `app/src/components/cart/{RemoteCartProvider,CartView,CartBadge,index}.ts`, `app/src/components/product/BuyBox.tsx`, `app/src/app/product/[id]/page.tsx`, `app/src/app/layout.tsx`, tests, `TASKS.md`, `HANDOFF.md`.
- **Remaining:** checkout/order creation (5.2) still not connected; Coupon expiry/model support; guest merge only maps primary (`s:0`) entries; cart price/stock are not stock reservations.

## Last completed task (TASK 3.4 — authentication UI — 2026-11-08)

Branch `feature/backend-mvp`. **Customer and seller auth UI implemented and browser-verified; no schema/seed/commit/push.**

- **Pages:** `/login` and `/register` (server pages with `instant = false`, redirect already-signed-in users), shared `AuthShell` in the existing navy/yellow design. `LoginForm` / `RegisterForm` call `/api/auth/login` and `/api/auth/register` with `credentials: "include"`; no password/token is written to localStorage. `PasswordField` has Show/Hide, both forms validate client-side and map API field errors, show loading/disabled states and a server-error panel.
- **Session-aware UI:** `SessionProvider` fetches `/api/auth/me` on mount with `cache: "no-store"`; `SessionNav` in the storefront header shows guest Sign in/Create account or the signed-in name, role portal link and Sign out. `SignInTile` is now session-aware. `logout` posts `/api/auth/logout` and clears client session state.
- **Redirects:** successful login/register honours a safe relative `next`; otherwise sellers go to `/seller`, drivers to `/delivery`, customers/admins to `/`. Login/register pages redirect already-authenticated users.
- **Seller access:** `/seller` layout calls `getCurrentUser()` (request-time via `connection()`), redirects unauthenticated visitors to `/login?next=/seller`, and renders `SellerAccessNotice` for signed-in non-sellers. Seller top bar now has a working Sign out. All seller API/data ownership remains enforced server-side from the session (no client role/sellerId trust).
- **Verification (production build server):** register customer with empty-form validation errors → valid registration redirected `/`; header/home tile showed signed-in state; logout returned guest state; login with `next=/orders` redirected to `/orders`; seller login redirected to `/seller`; unauthenticated `/seller` redirected to `/login?next=/seller`; customer hitting `/seller` saw “Seller account required”; logout from notice returned home; no credentials visible in page text. Test customer deleted; DB back to `User=24`, `Session=0`.
- **Validation:** `tsc --noEmit` clean (rerun after build), `npm run lint` 0, `npm run test` 84/84, `npm run build` exit 0.
- **Files:** `app/src/app/{login,register}/page.tsx`, `app/src/components/auth/*` (SessionProvider, SessionNav, LogoutButton, AuthShell, PasswordField, LoginForm, RegisterForm, redirect), `app/src/components/home/SignInTile.tsx`, `app/src/components/ui/SiteHeader.tsx`, `app/src/app/layout.tsx`, `app/src/server/auth/current.ts` (`connection()`), `app/src/app/seller/layout.tsx`, `app/src/components/seller/{SellerAccessNotice,SellerTopBar}.tsx`, `TASKS.md`, `HANDOFF.md`.
- **Local dev note:** the long-running dev server on port 3102 kept a stale Fast Refresh module context (`useSession must be used within SessionProvider`) until a restart. A fresh production build/server works with no such error; restart the dev server before further UI testing.
- **Not done:** password reset, email verification, login rate limiting, seller self-registration (must be provisioned), guest-cart merge on login.

## Last completed task (TASK 3.3 — catalogue + seller inventory UI on PostgreSQL — 2026-11-08)

Branch `feature/backend-mvp`. **Customer catalogue/search/product and Seller Products screens now read/write PostgreSQL.** No schema change, no seed, no commit/push.

- **Customer migration:** `src/lib/api/catalogDb.ts` adapts the existing UI shapes to the catalog service. Homepage deal tiles and product rows (deals, best sellers, finishing touches, recently viewed) are DB-backed; `/search` applies q/category/brand/price/rating/deal/sort/pagination over DB rows; `/product/[id]` reads product, multi-seller offers, reviews/histogram, FBT and similar products from DB. `SellerTable` shows real price/stock/min order/lead time/serviceable pincodes; `BuyBox` shows selected offer price/stock/min order/lead time; empty/no-review and unavailable states added; root `error.tsx` + `loading.tsx` added.
- **Seller migration:** `ProductsView` now uses `lib/api/sellerApi.ts` for `GET/POST /api/seller/products` and `PATCH .../[offerId]` + `/stock`; stock stepper, status toggle, add-listing and edit-listing call the API; loading/empty/error states with retry; 401/403 messages. `ProductDialog` now selects a canonical catalogue product for new listings and keeps canonical fields read-only (seller owns price/stock/MOQ/reorder/lead time only). `PreviewDisclosure` accepts a page-specific accurate message.
- **Remaining mock dependencies (explicit):** hero carousel, featured category tiles, market/trust/sign-in tiles, promotional artwork (ART/HUE) and bulk-tier rules; Customer cart/checkout/orders remain localStorage mock (out of scope); Seller sidebar badges, overview, orders, delivery, payments, performance, settings remain `SellerStoreProvider` preview data; `lib/api/catalog.ts` still holds mock functions used by cart/hero.
- **Verification:** `tsc --noEmit` clean; `npm run lint` 0; `npm run test` **84/84**; `npm run build` exit 0. HTTP page checks: home/search/product 200 with DB disclosures; product 0 shows min order/stock and DB reviews; product 2 shows no-review state; unknown product renders not-found UI. Browser flow with a temporary seeded seller: seller login → `/seller/products` shows the DB listing → stock stepper persisted 25→35 → edit price persisted 380→385 → add listing persisted a second offer → status toggle persisted paused. Unauthenticated reload shows the 401 error state. Temporary seller/offers deleted; final DB counts `Product=48`, `SellerOffer=48`, `Seller=7`, `User=24`, `Session=0`.
- **Files:** `app/src/lib/api/catalogDb.ts`, `app/src/lib/api/dto.ts` (`unitWeightKg`), `app/src/server/catalog/service.ts` (by-code/review helpers), `app/src/components/home/{TodaysDealsRow,BestSellersRow,FinishingTouchesRow,DealTiles,ProductRow}.tsx`, `app/src/app/{search/page.tsx,product/[id]/page.tsx,error.tsx,loading.tsx}`, `app/src/components/product/{SellerTable,BuyBox,ProductReviews}.tsx`, `app/src/components/seller/{ProductsView,ProductDialog,PreviewDisclosure}.tsx`, `app/src/lib/api/recentlyViewedAction.ts`, `TASKS.md`, `HANDOFF.md`.
- **Known limits:** brand facets hidden until seed rerun populates `Product.brand`; search fetches up to 50 active products for in-memory facet/filter math (fine at 48); cart still mock so DB price/stock is display-only on the buy box; no login UI yet.

## Last completed task (TASK 3.2 — PostgreSQL catalogue + seller inventory — 2026-11-08)

Branch `feature/backend-mvp`. **Implemented and verified against PostgreSQL; no schema/migration change, no seed, no commit/push.**

- **Public APIs:** `GET /api/categories`, `GET /api/products` (`q`, `category`, `sort=relevance|price_asc|price_desc|name_asc|newest`, `page`, `pageSize`), `GET /api/products/[id]` (accepts DB id or catalogue code, e.g. `0`), `GET /api/products/[id]/offers`. Reads `Product` + `Category` + active `SellerOffer`; excludes paused, zero-stock and vacation-mode offers; offers expose price/stock/minOrderQty/leadTimeDays/verified/rating/serviceable pincodes and `purchasable`, never seller phone/GSTIN/bank/owner fields. Money serialized as fixed decimal strings. No N+1 (included relations).
- **Seller APIs:** `GET/POST /api/seller/products`, `PATCH /api/seller/products/[offerId]`, `PATCH /api/seller/products/[offerId]/stock`. Identity comes from `requireSeller()`; every query is scoped by `sellerId`; cross-seller offer IDs return 404; `productId`/`sellerId` are not accepted in updates; strict Zod schemas validate price/stock/min order/reorder/lead time/status; stock 0 auto-pauses; activating at 0 stock is 400; duplicate listing is 409; unknown product is 404.
- **Service layer:** `src/server/catalog/service.ts` (+ `validation.ts`), `src/server/seller/inventory.ts` (+ `validation.ts`); shared DTOs in `src/lib/api/dto.ts`.
- **Frontend migration path:** new DB-backed clients `src/lib/api/catalogApi.ts` and `src/lib/api/sellerApi.ts` (shared `client.ts`) with typed fetch helpers. Existing `src/lib/api/catalog.ts` and `src/lib/api/seller.ts` remain **mock-backed**; no page/UI changes.
- **Verification executed:** `tsc --noEmit` clean; `eslint src` 0; `npm run test` **84/84** across 11 files (new catalogue service 4, seller inventory 2, all DB writes inside rolled-back transactions); `npm run build` exit 0 with all new routes dynamic and no swallowed framework errors. HTTP checks: public categories 13, filtered cement price sort/pagination, product `0` detail/offers, unknown 404; seller list 200 (8 offers), no cookie 401, customer/driver/admin 403, cross-seller PATCH 404, negative stock 400, duplicate 409, cross-origin 403; successful create 201 → stock PATCH 200 → price/status PATCH 200 with persisted values; test offer deleted afterwards.
- **Data safety:** final counts back to `Product=48`, `SellerOffer=48`, `User=24`, `Session=0`, `test_offers=0`; migration history unchanged.
- **Files:** `app/src/server/{catalog,seller}/*`, `app/src/app/api/{categories,products,seller}/**`, `app/src/lib/api/{dto,client,catalogApi,sellerApi}.ts`, tests, `TASKS.md`, `HANDOFF.md`.
- **Pending:** UI still consumes mock facades; cart/order/shipment/delivery/admin APIs out of scope; brand is null on existing seeded rows because the seed was not rerun after the schema change.

## Last completed task (TASK 3.1 — authentication foundation — 2026-11-08)

Branch `feature/backend-mvp`. **Implemented and verified against PostgreSQL; not committed/pushed.**

- **Dependencies:** `zod@^3.25.76` added; `bcryptjs@^3.0.3` moved from devDependencies to dependencies. No schema change, no migration, no seed run.
- **Server modules:** `src/server/auth/session.ts` (token generation, SHA-256 token hash, bcrypt register/login, session create/delete/lookup with expiry, role assertion, seller/driver profile resolution), `src/server/auth/current.ts` (async `cookies()`, HTTP-only `cw_session` cookie, `requireUser`/`requireRole`/`requireCustomer`/`requireSeller`/`requireDriver`/`requireAdmin`, `destroyCurrentSession`), `src/server/auth/validation.ts` (strict Zod schemas; registration rejects a `role` field), `src/server/http.ts` (`ApiError`, error shape, JSON parsing, same-origin/CSRF check, `unstable_rethrow` so Next control-flow errors are not swallowed), `src/server/auth/index.ts`.
- **Routes:** `POST /api/auth/register` (customer-only, 201 + session cookie), `POST /api/auth/login` (all roles, 401 on bad credentials), `POST /api/auth/logout` (DB row deleted + cookie cleared), `GET /api/auth/me` (401 when unauthenticated).
- **Security:** opaque 32-byte token, only SHA-256 digest stored in `Session.tokenHash`; bcrypt cost 12; cookie `httpOnly`, `sameSite=lax`, `path=/`, `secure` in production, 7-day maxAge; no password hash/token in responses; unknown/`role` fields rejected; origin/`sec-fetch-site` checks on mutations.
- **Verification executed:** `tsc --noEmit` clean; `eslint src` 0; `npm run test` **78/78** across 9 files (includes DB integration tests that create data inside a Prisma transaction and roll back); `prisma validate` valid; `npm run build` exit 0 with `/api/auth/*` listed dynamic and no swallowed framework error. HTTP checks against the existing dev server: register 201/customer, `/me` 200, logout 200 → `/me` 401, wrong password 401, re-login 200, role-injection 400, cross-origin 403. Seeded users of all four roles authenticate with `DEMO_PASSWORD`; test users cleaned up (0 remain).
- **Files:** `app/src/server/{http.ts,auth/*}`, `app/src/app/api/auth/{register,login,logout,me}/route.ts`, `app/package.json` + lockfile, `app/.env.example` (`APP_ORIGIN`), `src/server/auth/*.test.ts`, `src/server/http.test.ts`, `TASKS.md`, `HANDOFF.md`.
- **Not done:** protected business endpoints and ownership-scoped handlers (3.2 route-level test pending); password reset/email verification; rate limiting; no commit/push.

## Last completed task (Database foundation: multi-seller + financial/OTP schema — 2026-11-08)

Branch `feature/backend-mvp` (no upstream). **Schema/migration/seed authored; the multi-seller migration was applied by an external session at `2026-11-07T18:47:05Z` (DB checksum matches the file SHA-256 exactly). This task did not apply it.** No frontend behaviour changed, no API implemented, no commit/push.

- **Schema (`app/prisma/schema.prisma`, 21 → 22 models):** `Product` is now the canonical catalogue row (code, category, name, brand, unit, MRP, specs, image). New `SellerOffer` holds every seller-specific field moved off `Product`: `price`, `stock`, `minOrderQty`, `status`, `reorderLevel`, `soldCount`, plus `leadTimeDays`, `verified`, `rating`, `@unique([sellerId, productId])`. `CartItem` now references `sellerOfferId` only; `OrderLine` gained nullable `sellerOfferId` while keeping product/seller/name/unit/unitPrice/lineValue snapshots. `Shipment` keeps one row per seller per order.
- **Approved schema additions:** `Address.name/phone/state` (+ `userId,isDefault` index); `Coupon.discountAmount/maxDiscount/minSubtotal/firstOrderOnly` (preserves BUILD10/FIRST250/FREESHIP); `Order.discount/couponCode/taxAmount/taxRate`; `Shipment.otpEncrypted` (AES-256-GCM customer copy) alongside existing `otpHash` (D20 amends D17). `OTP_ENCRYPTION_KEY` name added to `app/.env.example` only; `.env` not read or modified.
- **Seed (`app/prisma/seed.ts`)** updated to write canonical `Product` + one `SellerOffer` per catalogue row, and to attach `sellerOfferId` to seeded order lines. Not executed.
- **Migration:** `app/prisma/migrations/20261108090000_multi_seller_and_financial_snapshots/migration.sql` generated offline via `prisma migrate diff`, then hand-ordered to backfill `SellerOffer` from existing `Product` rows, backfill `OrderLine`/`CartItem` references, and only then drop the superseded product/cart columns. `CartItem.sellerOfferId` is set `NOT NULL` after backfill, so an unresolvable legacy cart row aborts the transaction instead of losing data.
- **Verification (actual):** `npx prisma format` + `npx prisma validate` → valid; `npx prisma generate` → client v6.19.3 generated; `npx tsc --noEmit` → clean; `npx eslint prisma/seed.ts` → clean; `npm run lint` → 0; `npm run test` → 61/61. **Not run:** any migration/seed against a database, `prisma migrate reset`, `db push`.
- **Unresolved before applying:** confirm the target database and that its `CartItem` table is empty of offerIndex 1/2 rows (the migration intentionally fails there); confirm `OTP_ENCRYPTION_KEY` provisioning; then apply only with owner approval.
- **Files changed:** `app/prisma/schema.prisma`, `app/prisma/seed.ts`, `app/prisma/migrations/20261108090000_multi_seller_and_financial_snapshots/migration.sql`, `app/.env.example`, `DECISIONS.md`, `HANDOFF.md`.

## Current phase
**Phase 1 complete (TASKS 1.1–1.3 DONE).** **D14 (ACCEPTED 2026-11-06, owner decision, option A):** mock-data-first frontend development is approved for all three owner-developed portals (Customer, Seller, Delivery), ahead of TASK 2.1/2.2 (Prisma schema + seed). Binding conditions from D14 — read the full row in `DECISIONS.md` before continuing any portal UI work:
1. UI data access must go through the API facade (`app/src/lib/api/*`) — never import mock data directly in components.
2. Business logic stays independent of React and of the mock-data shape (already the pattern in `app/src/lib/shop/*`).
3. Never present mock inventory/prices/sellers/availability as live or verified.
4. **TASK 2.1/2.2 (Prisma schema, migrations, seed) must be complete before real checkout/order processing is implemented** — do not wire a real order-placement flow against mock data.
5. COD-only + ₹50,000 order cap (D3/D4) must be enforced server-side at the real order-placement boundary once it exists.
6. Prototype design/interaction fidelity (D13) still applies.
7. This decision does not reorder Seller/Delivery portal scope by itself — any change there needs separate owner approval.

## Last completed task (Client deployment readiness - this checkpoint - 2026-11-07)

**Deliverable:** `docs/CLIENT_DEPLOYMENT_READINESS.md` (verdict: READY TO DEPLOY AS A GATED MOCK-DATA PREVIEW). Owner approval is still required for hosting target, production DB changes, pushing and publishing.

- **Audit found no remaining build blockers.** `npx tsc --noEmit` exit 0; `npm run lint` 0 problems; `npm run test` 61/61; `npx prisma validate` valid; `npx prisma migrate status` now reports **"Database schema is up to date!"** against the owner's local Postgres (`127.0.0.1:5433`, 1 migration) - the old P1000 blocker is gone. No migration, seed or production DB change was performed.
- **Real defect found and fixed: stale production cache.** A reused `.next` directory served cached HTTP 404 for `/cart`, `/checkout`, `/orders` (correct UI 200 after clean build). Root cause: stale prerender cache from an earlier build, not code. Deployment rule recorded: always build from a clean checkout/image; never copy `.next` to production.
- **Deployment config added:** `output: "standalone"` in `app/next.config.ts`; `GET /api/health` (DB-independent) at `app/src/app/api/health/route.ts`; `app/Dockerfile` (multi-stage Node 22 Alpine, non-root, healthcheck), `app/.dockerignore`, `app/docker-compose.yml`; `DEMO_PASSWORD` name added to `app/.env.example`; root/app READMEs corrected from stale "no application code exists".
- **Verification executed (real results):** clean `npm run build` exit 0 (23/23 pages); `node .next/standalone/server.js` served `/api/health` 200 `{"status":"ok","service":"constro-well"}`, `/`, `/cart`, `/checkout`, `/orders`, `/product/0`, `/seller`, `/delivery` all 200, CSS 200. Browser (Chromium, production build): home sections + zero console errors; product `0` → Add to cart → `/cart` shows 1 item/₹390; `/checkout` rendered and empty-address submit showed all field errors + "Choose or add a delivery address"; `/seller` rendered; `/delivery/jobs?open=BG-50231` drawer showed demo OTP 6381; OTP 6381 + photo + qty 100 + Confirm delivery → BG-50231 removed from assigned list and "Delivered. Review window started." (This closes the long-pending Delivery completion click-through item.)
- **Honest scope boundary:** no auth, no API, no runtime DB access, no real order/payment/inventory. Deployment must be access-gated at the proxy/platform; do not present as a live marketplace. `/product/9999` still returns 200 with the not-found UI in production (PPR). `app/.github/workflows/playwright.yml` remains inactive and the starter spec is unused.
- **Files:** `app/next.config.ts`, `app/src/app/api/health/route.ts` (new), `app/Dockerfile`/`.dockerignore`/`docker-compose.yml` (new), `app/.env.example`, `README.md`, `app/README.md`, `docs/CLIENT_DEPLOYMENT_READINESS.md` (new), `TASKS.md`, `HANDOFF.md`. No prototype, schema, migration, business rule or existing data changed.
- **Git:** still uncommitted; nothing staged, pushed, merged or deployed.

## Last completed task (Customer Portal Cart/Checkout/Orders - audit + repair, this checkpoint - 2026-11-09)

**Context:** a Cart/Checkout/Orders/Thanks implementation for the Customer Portal (plus a Prisma persistence foundation, release-readiness report, demo recordings, and a cross-portal integration audit) arrived in the working tree from an "OpenCode" session, but — unlike every other feature area in this project — **it had no corresponding `HANDOFF.md`/`TASKS.md` checkpoint at all**. It was discovered purely via `git status`, exactly the scenario AGENTS.md's "verify claimed work actually exists" rule exists for. This session (1) audited the actual state of the whole repo top to bottom (`docs/CLAUDE_HANDOFF_AUDIT.md`), found the build genuinely broken, then (2) repaired it (`docs/FRONTEND_COMPLETION_REPORT.md`).

**Audit findings (full detail in `docs/CLAUDE_HANDOFF_AUDIT.md`):** `tsc`/`lint`/`build` all failed on the as-found tree (1 TypeScript error in `CheckoutView.tsx`'s address handling, 7 ESLint errors — 5 `react-hooks/set-state-in-effect`, 2 `react-hooks/purity`). A real pricing bug existed in `lib/api/cart.ts`'s `resolveCartLines`: display quantity was clamped to stock but price/total were computed from the unclamped requested quantity, so an over-limit cart line showed a correct-looking quantity next to a wrong total. Dead code (`getOrderExists`) was left over despite being reported as cleaned up. `@playwright/test` had been installed with no `DECISIONS.md` entry, contradicting D12's approved Vitest choice.

**Repair (full detail in `docs/FRONTEND_COMPLETION_REPORT.md`):**
- **TypeScript:** `CheckoutView.tsx`'s `addr` is now `Address | null`, resolved explicitly per path (new-address only valid once it passes validation; existing-address lookup bounds-checked), narrowed with an explicit `if (!addr) return;` before use — no `any`/cast/`!`.
- **Stock/pricing bug:** `resolveCartLines` now computes one `effectiveQty` and prices only that value (`lib/api/cart.ts`). `CartLine` gained `requestedQty`/`outOfStock` (`lib/shop/types.ts`) so the UI can say "Only N left — reduced from M" or "Out of stock — remove it to check out" instead of ever showing a quantity/total that don't agree. Persisted cart entries are now reconciled against resolved stock on every load (`lib/cart/reconcile.ts`, new, pure, unit-tested): entries for products/offers that no longer exist are pruned with a dismissible notice; over-limit entries are clamped in storage so a stale number can't compound across reloads; zero-stock entries are left alone (nothing valid to clamp to) and handled via the UI state instead.
- **ESLint:** all 5 effects rewritten to the "deferred async load, no synchronous setState in the effect body" shape this project already uses correctly elsewhere (`ThanksView` was the reference pattern) — `CartProvider`'s mount effect now calls the imported `resolveCartLines` directly instead of the locally-defined `refresh` wrapper (calling a *local* async function bare from an effect is what the rule actually flags, not where the `await` sits inside it). `Math.random`/`Date.now` moved to plain module-level functions (`makePreviewOrderId` in `lib/api/orders.ts`, `nowMs()` in `CheckoutView.tsx`).
- **Dead code:** `getOrderExists` removed.
- **Testing (D18, new decision):** Vitest + jsdom added, fulfilling D2/D12's already-approved choice rather than contradicting it; `@playwright/test` kept (not removed), reserved for future e2e. 61 new unit tests across `lib/shop/pricing`, `lib/shop/validate`, `lib/api/cart` (the stock-bug regression suite), `lib/cart/reconcile`, `lib/cart/store`, `lib/api/orders`. Node 22+'s own experimental `localStorage` global silently shadows jsdom's unless disabled (`--no-experimental-webstorage`, set both in `package.json`'s test scripts and via `vitest.config.ts`'s `poolOptions.*.execArgv` since worker threads don't inherit parent-process CLI flags).
- **cacheComponents fix:** `export const instant = false` added to `/cart`, `/checkout`, `/orders`, `/orders/[id]`, `/thanks/[id]` (same fix this project has applied to every other fully-interactive route) — the build failed on `/orders/[id]` without it ("CLIENT_HOOK_DYNAMIC" from `PortalChrome`'s `usePathname()`).
- **Bug found and fixed during browser verification (not in the original audit):** placing an order raced the checkout page's empty-cart redirect guard against the post-order navigation to `/thanks/[id]` — clearing the cart made `purchasableLines.length` hit 0 before the `router.push` fully took effect, and `router.replace("/cart")` sometimes won, silently discarding the confirmation page (the order itself saved correctly regardless). Fixed with an `orderJustPlaced` ref that suppresses the guard once this component instance has placed an order. Reproduced, fixed, and reverified in-browser.
- **Verification executed (all real results):** `npx tsc --noEmit` → clean · `npm run lint` → 0 problems · `npm run test` (new) → 61/61 passing · `npx prisma validate` → valid (unchanged, not re-migrated) · `npm run build` → 22/22 routes, correct categorization · full browser walkthrough: product detail → add-to-cart with an over-limit quantity (badge/cart correctly showed 14 not 20, priced at 14's bulk tier) → quantity decrease (live recalculation) → delete (empty-cart state) → checkout validation (all 5 field errors + address error) → place order with a saved address → **thanks page** (confirmed reachable after the race fix) → orders list (both test orders, newest first) → order detail (5-stage tracker, "Simulate next update" advanced a real stage with a timestamp, "Cancel order" correctly cancelled and hid the tracker).
- **Preserved exactly, per the repair task's restrictions:** ProductDetail/BuyBox still carry no stock field (mock-data-safety architecture, D14); no backend/API routes added; `app/prisma/schema.prisma` untouched, no migration run; all approved business rules (`BULK`, `couponCheck`, `calcTotals`, `COD_CAP`, address regexes) byte-identical; the Seller Hub's mock dataset was **not** connected to customer-cart stock (still two separate id namespaces, a disclosed, intentional limitation per D11's open seller↔product unification gap — not touched without further verification, as instructed).
- **Files:** see `docs/FRONTEND_COMPLETION_REPORT.md` §2 for the full modified/new file list (12 modified, 8 new, including 6 new test files).
- **`TASKS.md` updated:** rows 4.4 (+ new 4.4b for the stock/pricing fix specifically), 5.1, 5.3 moved from NOT STARTED to **UI PREVIEW DONE (client-only)**, matching the Seller/Delivery convention; row 5.2 (server-side order creation) remains NOT STARTED, correctly — this repair was frontend-only per task scope.
- **`DECISIONS.md`:** new entry D18 (testing strategy / Playwright-without-a-decision reconciliation).
- **Git:** still everything uncommitted; nothing staged, committed, pushed, merged, reset, or stashed. No existing untracked work was discarded.
- **Scope boundary (explicit in the task):** stop after Customer Portal repair; do not move to Seller Portal without separate approval. Seller/Delivery Portals were not touched and were not re-audited in this session (they were already independently verified in this project's prior checkpoints and remain unaffected by anything in this pass).

## Last completed task (Demo recordings — checkpoint — 2026-11-07)
Three browser walkthrough videos recorded with Playwright 1.65.0 (already in `app/package.json`) + Chromium headed via WSLg, per-portal single-page contexts, 1920×1080 VP9 @25fps, slow pacing per the owner's spec. Deliverables: `artifacts/demo-recordings/01-customer-portal.webm` (55s), `02-seller-portal.webm` (40s), `03-delivery-portal.webm` (41s). All three playback-verified (ffmpeg probe + decoded frames inspected). Actions performed and unavailable/mocked-feature lists: `docs/DEMO_RECORDING_REPORT.md`. Application code untouched; the temporary recording script was deleted after use; nothing committed. Note: Chromium needed system libs staged via a temp `LD_LIBRARY_PATH` (no sudo available in this WSL box) — temp libs removed afterwards.

## Last completed task (QA + release-readiness audit — checkpoint — 2026-11-07)
Full three-portal test/debug/deployment audit; **deliverable: `docs/RELEASE_READINESS_REPORT.md`** (14 sections, every status backed by executed evidence). Verdict: **READY FOR DEMO WITH KNOWN LIMITATIONS** — portals serve and render correctly in the production build; app is a mock-data preview by D14 (no auth/API/DB wiring in app code).

- **Checks executed (real results):** `npx tsc --noEmit` → clean · `npm run lint` → found 1 warning, fixed (`pricing.ts` unused `Product` import), rerun → **0 problems** · `npx prisma validate` → valid · `npx prisma migrate status` → **P1000 auth failed** (server reachable at `127.0.0.1:5433`; owner-owned `.env`, never read) · 27-assertion business-rule self-check (`/tmp/opencode/rules-check.mts`: bulk tiers/coupons/GST/delivery fee/COD cap, delivery OTP/shortfall, seller payout/eway/score) → **all passed** (one wrong assert in the harness was corrected; code was right) · 24-route dev smoke (owner's pre-existing dev server, ~PID 14125, on :3000, same working tree) → all 17 portal routes 200, `/product/9999` 404, `/login`/`/register`/`/admin` 404 as designed · dev log audit → **0 ERROR / 0 WARN**.
- **Production build:** default Turbopack `next build` **FAILS in this WSL `/mnt/c` setup only** — owner's Windows-side `npm install` pruned the Linux `lightningcss-linux-x64-gnu` native binding (win32 binding installed instead; lockfile rewritten +982 lines). Restored the binding into `node_modules` (untracked, no save) — `lightningcss` then loads in plain Node, but Turbopack's build worker never picked it up (verified via temporary instrumentation of `node_modules/lightningcss/node/index.js`, restored afterwards). **`npx next build --webpack` → exit 0, compiled 99s** and `npx next start -p 3100` served all tested routes 200 with identical content. Environment artifact, NOT a code defect; the report has the permanent fix (clean install on the build host).
- **Prod-only nuance (documented, unfixed, Next 16 `cacheComponents` behaviour):** `/product/9999` renders the correct not-found UI but returns HTTP 200 + `x-nextjs-prerender: 1` in the production build (dev 404s). Not altered.
- **Files changed this session:** `app/src/lib/shop/pricing.ts` (1-line lint fix), `docs/RELEASE_READINESS_REPORT.md` (new), `HANDOFF.md`; untracked `node_modules` binding repairs (not part of repo). `TASKS.md` and `DECISIONS.md` untouched (no acceptance criteria newly met; prototypes confirmed unchanged).
- **Cleanup done:** prod server on :3100 stopped; temp archives removed (`/mnt/c/Users/NINAD/lc.tgz`, staging copies). Owner's dev server (port 3000) deliberately left running — not agent-owned.
- **Blockers / next actions:** owner fixes `postgres` credentials in `app/.env` (P1000) → then verify migrate status, reconcile Users 24 (owner) vs seed design 22, run seed-verified live-DB checks. Before hosting: run report §14 browser checklist; build on a clean Linux/Windows host (Turbopack fine there; today's evidence is `--webpack`). Next follow-on task remains **TASK 2.3** (needs owner approval).

## Last completed task (TASK 2.1/2.2 — persistence foundation — this checkpoint — 2026-11-07)
Backend infrastructure task per owner's brief; portal code, facades and prototypes untouched. **Schema and seed are authored and compile; migration and seed have NOT been executed — the owner-owned `app/.env` does not exist and no credentials were invented (per task §5).** Executed evidence recorded below.

- **Created:** `app/prisma/schema.prisma` (21 models: User, Session, Seller, SellerPincode, Driver, Vehicle, Category, Product, Cart, CartItem, WishlistItem, Address, Review, Coupon, Order, OrderLine, Shipment, ShipmentEvent, ShipmentIssue, EscrowEntry, Notification); `app/src/server/db.ts` (PrismaClient singleton); `app/prisma/seed.ts`.
- **Decisions recorded:** D16 (money = `Decimal(14,2)`, rates = `Decimal(7,6)`, decimal strings at boundaries, no float math) and D17 (OTP stored bcrypt-hashed only, `otpTries` for the 3-try rule, no expiry column — expiry unresolved, D5 OPEN) appended to `DECISIONS.md`.
- **Schema reconciliation notes:** enums mirror approved vocabularies only — `ShipmentStatus` = PROJECT_CONTEXT §6 machine + side states (`missed`, `refunded` included per the doc, unused by seed); `OrderStage` = buildgrid-shop.html `STAGES` + the prototype's cancelled boolean; shipment issues = short_quantity / damaged_goods / failed_attempt (all from the prototypes, no invented types). User-owned UI rows cascade on delete; orders/lines/shipments/events/issues/ledger are Restrict — financial/audit history is never cascade-removed. Historical dispatch info (vehicle/driver) is preserved in the append-only ShipmentEvent log, current FKs are SetNull.
- **Seed content (from existing mock data, imported not re-authored):** 13 categories incl. empty Interior Design (D15) · 48 catalog products · UltraBuild (the mock store) + the prototype's 6-seller offer pool as real vendors (D11) · the 8 mock seller products reconciled onto the catalog rows with identical name+price (p1→"0" … p8→"23"), catalog names kept, order-line snapshots carry the buyer-facing mock text verbatim · 3 vehicles + 3 drivers + service-area pincodes · 16 demo orders (label→instant parse: minutes/`Xh Ym`/hours/days ago) → OrderLine → Shipment with events, disputed-goods issue (claim ₹1,720 exact decimal), escrow HELD/COMMISSION/RELEASED entries, 2 bank-transfer WITHDRAWN entries · seller reviews → Review rows · notifications. **Coverage note: the source has 6 settled shipments, not the docs' earlier "5" — the seed follows the source.** All amounts built through `Prisma.Decimal`; demo passwords bcrypt-hashed from owner-set `DEMO_PASSWORD` env (fallback "constrowell-demo" — throwaway demo value, flagged for the owner); demo emails `name@demo.constrowell.test`; OTP demo code for the 2 dispatched shipments = the preview's deterministic `deriveOtp(orderId)`, stored bcrypt-hashed for DB+UI parity.
- **Executed validation (real results):** `npx prisma validate` → **valid** · `npx prisma generate` → client generated · repo-wide `npx tsc --noEmit` → **clean** · `npx eslint src/server/db.ts prisma/seed.ts` → **clean**. `npm install` needed the new npm 11.20 lifecycle-script gate: scripts for `prisma`/`@prisma/client(engines)`/`esbuild` were approved via `npm install-scripts approve` (documented dependency hygiene).
- **Dependencies introduced (reasons, per AGENTS rule):** `prisma` + `@prisma/client` ^6.19.3 (D2-mandated stack), `tsx` (seed runner: executes TS seed with the app's `tsconfig` `@/*` paths — node type-stripping cannot resolve those), `bcryptjs` (D2 bcrypt hashing for seed). No testing framework installed (per task).
- **NOT executed / blocked (do not claim done):** `prisma migrate dev` (needs `app/.env` `DATABASE_URL`; Postgres confirmed listening on localhost:5432) — acceptance "`npm run db:migrate` applies on blank DB" pending; seeding + second-run idempotency check pending likewise; the migration's Decimal precision in SQL and cross-ESR check remain to be verified on the real migration. Files NOT touched (explicitly forbidden set verified): facades, `lib/seller|delivery/**`, components, `app/src/app/**`, `data/**`, prototypes.
- **Git:** still everything uncommitted; branch `feature/customer-portal`, HEAD `6cb34d9`. New changes this session: `app/prisma/*`, `app/src/server/db.ts`, `app/package.json` (+lockfile), `TASKS.md`, `HANDOFF.md`, `DECISIONS.md`.

## Last completed task (Cross-portal UI integration audit — checkpoint — 2026-11-07)
Scope: UI-level integration of Customer + Seller + Delivery. **Verdict: the three portals were already consistent; zero source-file changes were made.** Per the task's own rule ("fix only genuine integration defects"), working components were left untouched. What was verified, and what stays on record:

- **Shared contracts (verified by inspection):** both portals consume the same design tokens (`globals.css`) and shared primitives (`Button`/`Pill`/`Card`/`Toast`/`Star`/`Stepper` with its additive `step` prop; delivery reuses the Seller `SellerIcon` atlas rather than duplicating SVGs). `app/src/components/layout/PortalChrome.tsx` is the single chrome gate; served-HTML checks re-confirmed: `/`, `/product/0`, `/search` get shop header/footer; `/seller/*` and `/delivery/*` get bare shells with their own sidebars.
- **Data flow (verified):** `lib/api/delivery.ts` derives `DeliveryJob[]` from the same `createSellerSeed()` the Seller facade returns — identical order ids (`BG-…`), buyer/city/pin/product/qty/price/weight fields, `vehicleId` → `Vehicle → Driver` joins resolve, status subset filter (`dispatched|failed|review|disputed|settled`) casts safely. `slot` label strings are the shared seller `SLOTS` vocabulary. Deep links (`/delivery/jobs?open=…`, `?filter=`) reach both layouts.
- **Navigation leakage (verified):** href inventory per portal — customer routes navigate only within the customer surface; seller routes only within `/seller/*` (zero external hrefs); delivery routes navigate within `/delivery/*` plus one deliberate, labeled cross-link (`/delivery/settings` → `/seller/delivery` "Manage in Seller Hub"). No references to `/admin` anywhere (Admin Portal correctly absent — external product per D7).
- **Edge checks executed:** `/product/9999` → 404 (`notFound()` works); `/search?cat=Doors%20and%20windows` (space-encoded category) → 200; all portal deep links 200.
- **Validation:** `npx tsc --noEmit` clean; `npm run build` succeeds (17 static pages; route mix unchanged).
- **Known boundary limitations, previously disclosed and unchanged (these are backend dependencies, not UI defects):**
  1. **Two product namespaces** — customer catalogue uses numeric ids 0–47 with its own names/prices; seller seed uses string ids `p1–p8` with close-but-not-identical names ("OPC 53 Grade Cement…" vs "UltraBuild OPC 53 Grade Cement…"). Seller productCategory values (`Mortar`, `White`) don't join customer categories. Unified model is TASK 2.1/5.2 under D11 (per-seller real products); the customer buy box is disabled today, so nothing user-visible breaks.
  2. **No cross-portal live state** — seller dispatch and driver delivery use separate in-memory stores (per the previous task's design); a seller's in-session dispatch only becomes a delivery job after a state reset/reload. Real propagation requires TASK 2.x persistence; both disclosures state this.
  3. **`/login` + `/register`** are deliberate forward references in `components/home/SignInTile.tsx` (same pattern as `/search`/`/product` before they shipped) — routes arrive with TASK 3.1. They currently 404 by design.
  4. **Pending human verification (unchanged):** the delivery completion workflow browser click-through (`/delivery/jobs?open=BG-50231`, OTP 6381 → short qty → dispute; then full qty → review) — still not executed in a real browser by any agent; do not mark it complete.
- **Git:** everything remains **uncommitted**, owner-controlled; no git operations performed.

## Last completed task (Delivery Portal — Phase 7 zone, this checkpoint — 2026-11-07)
The Delivery Portal arrived from the previous agent as an **uncommitted** implementation (21 files, ~+1259) sitting on top of the also-uncommitted Seller Portal. This session **inspected, verified and corrected nothing functionally** — no defect was found that required a code change. It is a client-side UI preview per D14 conditions, no remote persistence:

- **Implementation shape (verified by read-through):** `lib/delivery/{types,status,rules,selectors,derive,nav}.ts` + `lib/api/delivery.ts` (sole facade; derives `DeliveryJob[]` from `getSellerState()` mock orders — **no duplicated fixtures**, same single source as Seller). UI: `app/src/app/delivery/{layout,page,jobs/page,history/page,settings/page}.tsx` + `components/delivery/{DeliveryStoreProvider,Sidebar,TopBar,BottomNav,JobsView,HistoryView,JobDrawer,PreviewDisclosure}.tsx`. `PreviewDisclosure` on every page states explicitly: sample data, nothing saved to a server, no real GPS/SMS/OTP.
- **Completion workflow (previous agent's interrupted verification focus):** 4-digit OTP boxes (3 wrong tries → `failed` + issue + event, toast each step), photo-proof toggle required before submit, delivered-quantity bounds checked 0..qty, shortfall > 0 → `disputed` with auto-claim `shortfall × unit price` + "payout frozen" events; full delivery → `review` with review window. `markFailedAttempt` = customer-unavailable path. Rules ported verbatim from the delivery prototype's driver tab (`doDeliver`/`failatt`); demo OTP `deriveOtp(orderId)` is deterministic and clearly labelled as sample, not a real one-time password.
- **Validation executed here (all real results):**
  - `npx tsc --noEmit` → clean (exit 0).
  - `npx eslint src/app/delivery src/components/delivery src/components/layout src/lib/delivery src/lib/api/delivery.ts` → zero problems.
  - `npm run build` → success; 17 static pages; routes: `/delivery` ○ static, `/delivery/jobs` + `/delivery/history` ƒ dynamic (deep-linked `?filter=`/`?open=`), `/delivery/settings` ○ static, all Seller routes unchanged in their categorization.
  - Dev-server smoke test (after clearing a **stale `.next/dev/lock`** from a dead pid — regenerated build artifact only): all routes return 200 — `/delivery`, `/delivery/jobs`, `/delivery/jobs?open=BG-50231`, `/delivery/history?filter=disputed`, `/delivery/settings`, `/seller` + 6 seller sub-routes, `/`, `/product/0`, `/search`. Zero compile errors and zero React warnings in the dev log across all of them.
  - `?open=` deep link pre-opens the job drawer server-rendered with the completion form; demo OTP rendered in HTML ("6381") **matches** the client-side `deriveOtp("BG-50231")` — string-consistency between SSR and hydration verified.
  - Node re-parse self-check (`deriveOtp` deterministic 4-digit, `shortfallClaim(100@₹390, delivered 90) = ₹3,900`, over/under-delivery clamped at 0, `MAX_OTP_TRIES = 3`) — all assertions passed.
- **Cross-portal regression:** served-HTML check — customer routes (`/`, `/product/0`, `/search`) render the shop `SiteHeader` + footer and no portal chrome; `/seller` and `/delivery` render no shop header/footer (bare shell from `PortalChrome`), each portal's own sidebar/top bar present. Prototype files still byte-identical (`git diff HEAD -- buildgrid-*.html` empty). File set unchanged by this session except regenerated `.next` and the documented `.next/dev/lock` removal.
- **Seed coverage:** mock orders include 2 dispatched, 2 review, 1 disputed (damaged goods), 5 settled; `failed` appears only via a runtime completion-workflow action — matching the prototype's own state coverage.
- **Still NOT verified / known limitations (do not claim done):** no real browser click-through of the completion workflow here (this environment has no browser tooling; previous agent's pass was interrupted mid-workflow — a human should run `npm run dev`, open `/delivery/jobs?open=BG-50231`, enter OTP **6381**, toggle photo, set a short delivered qty, and watch the dispute appear — then repeat with the correct OTP and full quantity to reach `review`). State is in-memory: reload resets. Drawer closes via scrim/X only (no Escape handler — **same as the Seller Hub's drawer**, consistent with shipped precedent, noted for the a11y pass TASK 8.5). No admin console, no customer-side tracking view (7.3), no server-side state machine (7.1), no payout release (7.5).
- **Git:** everything still **uncommitted** — commit/push remain owner-controlled. Suggested commit message for the current tree: `feat(delivery): driver-portal UI preview (jobs, history, settings, completion workflow) + portal chrome split; verified tsc/eslint/build/routes`.

## Last completed task (Seller Portal — Phase 6, this checkpoint — 2026-11-09)
All of Phase 6 (TASKS 6.1–6.6) shipped as a **client-side UI preview** — no auth, no backend, no persistence beyond the browser tab's lifetime (D14 mock-data-first, extended to Seller per its own conditions; no scope change to Customer/Delivery). Routes: `/seller` (Overview), `/seller/orders`, `/seller/products`, `/seller/delivery`, `/seller/payments`, `/seller/performance`, `/seller/settings`.

- **Chrome split without touching Customer Portal routes:** `app/src/components/layout/PortalChrome.tsx` (client, `usePathname()`-gated) now wraps `{children}` in `app/src/app/layout.tsx`, rendering `SiteHeader`/`SiteFooter` only off `/seller/*`. Chosen over route groups specifically to avoid moving any existing Customer Portal file.
- **State:** one in-memory React context, `app/src/components/seller/SellerStoreProvider.tsx` (19 actions: accept/reject/pack/dispatch orders, stock/status edits, product add/edit, delivery rules/vehicles, withdraw, vacation mode, notifications, store profile, KYC). No localStorage — a hard reload resets to the seed on purpose; in-app navigation preserves state. This is disclosed on every page via `PreviewDisclosure`.
- **Business rules ported verbatim** from the prototype into `app/src/lib/seller/rules.ts` (5% commission, 2% late-dispatch penalty, 4h accept / 24h dispatch / 24h review windows, ₹50,000 e-way threshold, delivery score = 30% acceptance + 40% on-time + 30% issue-free) and `lib/seller/{types,selectors,status,nav}.ts`.
- **Mock data:** `app/src/data/seller.ts` (`createSellerSeed`) — one store, 8 products, ~16 orders spanning every status, 2 transfers, 6 reviews, notifications; deadlines are **fixed display-label strings** ("3h 18m left"), not a live timer — avoids the `Date.now()`-in-render/prerender purity violation hit earlier on Product Detail, and matches the prototype's own audit flagging its countdown/time-travel as dev-only. `lib/api/seller.ts` is the sole facade (`getSellerState()`); no mock import reaches a component directly.
- New UI: `components/seller/{SellerIcon,SellerSidebar,SellerBottomNav,SellerTopBar,CategoryThumb,PreviewDisclosure,SalesChart,ScoreRing,DispatchDialog,RejectDialog,OrderDrawer,OrdersView,ProductDialog,ProductsView,VehicleDialog,WithdrawDialog}.tsx` plus the 7 route files under `app/src/app/seller/`.
- **Shared-component change:** `app/src/components/ui/Stepper.tsx` gained an additive, backward-compatible `step?: number` prop (default 1, used for the ±10 stock stepper) — no existing caller passes it, so Customer Portal behavior is unchanged.
- **Bugs hit and fixed in this task:** (1) `react-hooks/set-state-in-effect` in `ProductDialog` — fixed by extracting a keyed inner `ProductForm` with a lazy `useState` initializer instead of a reset effect (same class of fix as the earlier Stepper lint fire). (2) `useSearchParams()` inside `/seller/orders` and `/seller/products` broke static generation ("client rendering requested outside a Suspense boundary") — fixed by moving both pages to thin async Server Components (`page.tsx`, `await searchParams`) that pass plain props to client views (`OrdersView`/`ProductsView`), mirroring the earlier `/search` fix. (3) Per-page `export const instant = false` was still needed on both pages even with it set on `app/seller/layout.tsx` — layout-level declarations didn't cascade to this diagnostic for these two routes. (4) `SalesChart`'s SVG `<title>` had 3 JSX children (array-children React warning) — fixed to a single template-string child.
- **Verification:** `tsc --noEmit` clean; `eslint` clean (2 fixes above); `npm run build` succeeds, all 7 seller routes + 6 existing Customer Portal routes listed with correct static/dynamic/PPR categorization; dev-server HTTP smoke test on all 7 seller routes plus deep-linked query params (`/seller/orders?filter=new&open=…`, `/seller/products?filter=low&action=add`); browser verification at 1300px and 375px of a real stateful interaction (accept an order → toast + sidebar badge + product stock all update, persists across in-app nav, resets on hard reload); Customer Portal regression check (`/`, `/search?cat=Cement`, `/product/0`) all still 200 and visually unchanged; `git diff -- buildgrid-*.html` empty.
- **Explicitly not done here (by task scope):** Delivery Portal (not started, per explicit instruction), any auth/ownership enforcement, Prisma/DB/migrations, payment integration, COD checkout, customer order placement. `TASKS.md` rows 6.1–6.6 are marked **UI PREVIEW DONE**, not DONE, because their stated acceptance criteria (server-side validation, real auth scoping, real payout ledger) require backend work that is out of this task's scope.

## Last completed task (TASK 4.3 Stage 1 — Product Detail, this checkpoint — 2026-11-08)
`/product/[id]` is live (UI + data only — no cart/checkout/auth, by design):
- **New facade functions** in `app/src/lib/api/catalog.ts`: `getProductById`, `getSellerOffers`, `getFrequentlyBoughtTogether`, `getSimilarProducts`, `getProductReviews`, `getRatingBreakdown`. All mock-data access stays here; `getProductById` returns `null` for unknown ids (page calls `notFound()`).
- **New:** `app/src/app/product/[id]/page.tsx` + `not-found.tsx`; `app/src/components/product/{ProductGallery,BuyBox,SellerTable,FrequentlyBoughtTogether,ProductSpecsTable,ProductReviews,RecordView}.tsx`.
- Sections implemented: breadcrumb, gallery (3-view thumbnail swap, client), price/MRP/discount + bulk tiers + "About this item", buy box (quantity-aware bulk pricing via the existing `bulkTier`, client — genuinely recalculates price, no cart write), seller comparison table, frequently-bought-together, product-details spec table, customer reviews (deterministic seeded sample content, explicitly labelled "Sample review", never "Verified purchase"), "Customers also viewed" (reuses the existing `ProductRow`/`ProductCard`/`ScrollerRow`).
- Every transaction-shaped control (Add to cart, Buy now, wishlist, write/vote on a review, "Add selected to cart", seller switching) is rendered **disabled** — Stage 2 wires real interactivity once cart/auth exist.
- `RecordView` finally gives `recordRecentlyViewed` (built two tasks ago with "no caller yet") its caller — the homepage "Recently viewed" row will now populate after visiting a product.
- Hit and fixed two `cacheComponents` (dynamicIO) prerendering errors this project's `next.config.ts` setting introduces for any fully-dynamic route: `export const instant = false` (same fix already used on `/search`), and moved a `Date.now()` call out of render into a fixed-reference-date computation in the facade (mock review dates shouldn't drift with real time anyway).
- Verification: `tsc`/`eslint` clean, `npm run build` succeeds (`/product/[id]` listed as Partial Prerender), dev-server HTTP checks (valid id → 200, unknown id → 404, non-numeric id → 404, `/search` and `/` unaffected), and in-browser verification: 3-column desktop layout with sticky gallery+buy box confirmed via computed styles, ≤1100px collapses to 2-column with buy box spanning full width and losing sticky (matches prototype), quantity stepper genuinely recalculates price (₹390→₹378 at qty 10, 3% tier), gallery thumbnail click genuinely swaps the main image, full mobile screenshot confirms all sections render correctly stacked.
- **Known doc-staleness noted, not fixed here (out of this task's scope):** `TASKS.md` rows 4.1 and 4.2 still read "IN PROGRESS"/"NOT STARTED" despite both being fully shipped and committed in recent sessions — only row 4.3 was corrected as part of this task.

## Last completed task (TASK 4.1 slice, this checkpoint — 2026-11-06)
Added the catalog API facade and the first home-page section:
- **New:** `app/src/lib/api/catalog.ts` (`getCategories`, `getFeaturedCategoryTiles` — mock-backed today, swappable for real DB calls without UI changes), `app/src/components/home/CategoryTiles.tsx` (async Server Component; ports prototype's `.tile`/`.mini4`/`.mi` "Shop by category" section).
- **Modified:** `app/src/app/page.tsx` (static 12-category placeholder grid replaced by `<CategoryTiles />`).
- Pre-existing, previously verified against the prototype (untracked, unchanged this session): `app/src/data/catalog.ts`, `app/src/lib/shop/{types,pricing,format}.ts`.
- Verification: `npx tsc --noEmit` clean, `npx eslint` clean on changed files, dev server served `/` with HTTP 200 and the expected 4 SVG category icons; visually spot-checked in browser (tinted icon + label matches prototype).
- Remaining in 4.1: hero carousel, deals, best sellers, recently viewed — not started.

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
**This session's task ended at Customer Portal repair, by explicit instruction — do not move to Seller/Delivery repair work without separate owner approval**, even though neither was found to need any (Seller/Delivery were already independently verified clean in this project's prior checkpoints and were not touched or re-audited in this pass).

Next IDE:
1. Read `AGENTS.md` → `PROJECT_CONTEXT.md` → `TASKS.md` → `DECISIONS.md` → this file; `git status` + `git log --oneline` (Seller + Delivery UI-preview work, the persistence foundation, and now the Cart/Checkout/Orders repair are all still **uncommitted** — owner decides commit/push; do not discard any of it).
2. **Owner prerequisite for finishing TASK 2.1/2.2:** create `app/.env` from `app/.env.example` with a real local `DATABASE_URL` (Postgres confirmed listening on localhost:5432; credentials are owner-supplied, never invented by agents — note an `app/.env` now exists in the tree, presumably owner-created since the last checkpoint; its contents were not read). Optionally set `DEMO_PASSWORD` for the seed's demo accounts.
3. Then execute, recording real output each time: (a) `cd app && npm run db:migrate` (TASK 2.1 acceptance: clean apply on blank DB; verify `Decimal(14,2)` money columns in the generated SQL); (b) `npm run db:seed` twice (TASK 2.2 acceptance: idempotent, no duplicates; expect counts 13 categories / 48 products / 16 orders+shipments with statuses 3 new, 1 accepted, 1 packed, 2 dispatched, 2 review, 1 disputed, 6 settled). Only then mark 2.1/2.2 DONE in `TASKS.md`.
4. Deferred human step (unchanged): the delivery completion browser click-through (script above).
5. TASK 5.2 (server-side order creation) is the natural next step for the Customer Portal once 2.1/2.2 land, per D14 condition 5 — do not start it without the owner's go-ahead.
6. Next engineering task after 2.1/2.2 more broadly: **TASK 2.3** (API skeleton: `/api/v1` conventions, error shape, role middleware, ownership scoping) per backlog. Do not start it without the owner's go-ahead.

## Instructions for the next IDE
- Commands run from `app/`, not the repo root.
- WSL-on-`/mnt/c` env: DrvFS I/O is very slow — run installs/builds/dev as background jobs and wait; foreground `npm install` will time out.
- Do **not** symlink `.next` or `node_modules` outside the project tree (Turbopack fails: `Cannot find module 'next/dist/compiled/loader-runner'`).
- Keep prototypes byte-identical; keep every decision traceable in `DECISIONS.md`; never mark DONE without an executed check recorded here.
