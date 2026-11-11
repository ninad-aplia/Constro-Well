# ADMIN_PORTAL_GAP_REGISTER.md

Phase 04A — Deliverable 5 of 11. Stage 5 (Admin Portal audit).

Reference: `buildgrid-platform-admin.html` (8 views, `VIEWS` map at `:438`, renderers at `:343-436`).
Implementation: **none**.

**Classification:** MATCH / PARTIAL / MISSING / BROKEN / DIFFERENT / INTENTIONAL DEVIATION.
**Severity:** P0 · P1 · P2 · P3. **Confidence:** VERIFIED / PARTIALLY VERIFIED / UNVERIFIED.

---

## 1. Result

`/admin` returns **HTTP 404** in the running application (`evidence/app-admin-route-1440x900.png`: the storefront header, a centred "404 — This page could not be found.", and the storefront footer). There is no admin route, layout, component, API, or server module.

Verified absence:
- `find src/app -ipath "*admin*"` → **no results**.
- Route inventory: 21 `page.tsx` files, none under `/admin`; the four portals present are customer, seller, delivery.
- `find src/app/api -ipath "*admin*"` → **no results** (39 API routes total, none administrative).
- `requireAdmin()` is **defined and never called** (`src/server/auth/current.ts:77-79`) — the authorization primitive exists, but nothing protects because nothing is exposed.
- `enum Role { customer seller driver admin }` (`prisma/schema.prisma:45-50`) includes `admin`, so the data model anticipates the role; no seeded admin user exists in the demo accounts used for this audit.

Counts: MISSING **8 of 8** reference views. No partially-implemented admin screen exists to classify.

---

## 2. Reference inventory and per-view gap register

| # | Reference view | Renderer | What it contains | Status |
|---|---|---|---|---|
| 1 | Overview | `:343-367` | 4 attention cards (approvals, delivery problems, payouts to approve, sellers to watch), "Deliveries right now" (on the road / delivered today / failed), unverified-hired-truck banner, sales/earnings/orders/escrow KPIs, 30-day sales chart, "Needs you today" action list, "Is the platform healthy?" target table, "Sales by category" | **MISSING** |
| 2 | Approvals | `:369-384` | Seller onboarding queue with document review and approve/reject | **MISSING** |
| 3 | Deliveries | `:386-395` | Live delivery monitor and exception queue (filter `problems`/`live`) | **MISSING** |
| 4 | Payouts | `:397-404` | Payout approval queue, global "all payouts paused" freeze control, approve batch | **MISSING** |
| 5 | Sellers | `:406-413` | Seller directory with score, verification tier and "watch" state | **MISSING** |
| 6 | Users | `:415-422` | Customer/seller/driver account directory with role and status | **MISSING** |
| 7 | Activity log | `:424-428` | Timestamped administrative action trail | **MISSING** |
| 8 | Settings | `:430-436` | Platform rules: commission, escrow windows, score thresholds, payout controls | **MISSING** |

### ADM-01 — The entire admin portal is absent (P0)
- **Reference evidence**: all 8 views above; navigation renders 7 items plus Settings with live count badges (`:444`), and a mobile bottom bar (`:445`).
- **Current evidence**: 404 at `/admin`, no source under any admin path.
- **Impact**: three of the prototype's flows terminate nowhere — seller onboarding approval, payout release/freeze, and dispute adjudication. This is visible in the other portals: the seller Payments page says "Frozen by disputes — until admin decides", and `/seller/settings` says payouts stay on hold until the cheque is verified. **Both statements reference an approval surface that does not exist.**
- **Fix**: build the portal; it cannot be a pure frontend port (see ADM-02).
- **Confidence**: VERIFIED.

### ADM-02 — Most admin views have no backend to render from (P0, blocker)
Admin screens are not "frontend-only work". Verified model coverage:

| Admin need | Model today | Gap |
|---|---|---|
| Seller approvals + KYC document review | `Seller.kycGst/kycPan/kycCheque` (`KycStatus` enum) — status flags only | No document storage, no submission record, no reviewer/decision trail |
| Payout approval + freeze | `EscrowEntry` (types incl. `commission`, `released`, `transfer`) | No payout batch/approval entity; "approve payouts" cannot be represented |
| Dispute adjudication | `ShipmentIssue` (reason, qty shortfall) | No dispute entity, no resolution/refund action, no assignee |
| Platform settings (commission %, windows, thresholds) | Constants in `src/lib/seller/rules.ts` and `src/lib/shop/pricing.ts` | No settings table; values are compile-time constants |
| Activity log | — | No audit-log model |
| Users directory | `User`, `Session` | Renderable today (read-only) |
| Deliveries monitor | `Shipment`, `ShipmentEvent`, `Vehicle`, `Driver` | Renderable today (read-only) |
| Seller watchlist | `Seller`, computed score in `sellerService` | Renderable today (read-only) |

So of 8 views: **3 are read-only renderable from existing tables** (Sellers, Users, Deliveries); **5 require new persistence** (Overview's payout/approval counts, Approvals, Payouts, Settings, Activity log).
- **Fix**: a new admin phase with its own migrations (payout batch, dispute, platform settings, audit log). This is the single largest backend addition the UI audit uncovers.
- **Confidence**: VERIFIED for model inventory; UNVERIFIED for exact business rules (commission rate, windows) which are currently code constants, not decisions.

### ADM-03 — Authorization is unimplemented but the primitive exists (P1 until admin ships)
- `requireAdmin()` exists at `current.ts:77` and is never called. When the portal is built, every admin route must call it and every mutation must be same-origin checked; the prototype's "Two-factor on" chip (`proto-admin-overview-1440x900.png` header) implies 2FA, which the app has no support for.
- **Fix**: enforce `admin` role server-side on all admin routes; treat the prototype's 2FA chip as an open product question rather than building fake 2FA.
- **Confidence**: VERIFIED (no calls); the 2FA requirement is an OPEN QUESTION.

### ADM-04 — Admin brand identity and shell would need to match the prototype (P1 when built)
- **Reference**: same navy sidebar system as the seller hub, but with an **admin avatar/identity card** ("Asha Reddy · Admin · 2FA on"), an "Approvals/Deliveries/Payouts" badge set, and the same search field.
- **Current**: nothing to compare.
- **Fix**: reuse `SellerSidebar`/`SellerTopBar` structure with an admin item set, per `DECISIONS.md` D7 and the prototype fidelity policy.
- **Confidence**: VERIFIED (reference only).

---

## 3. Cross-portal dependency note

The absence of admin is **not** an isolated missing portal; it is the missing half of three workflows already built elsewhere:

1. **Seller onboarding** — a seller account exists and is usable with `kycCheque: "pending"`, but nothing can ever verify it, and payouts are documented as on hold until it is.
2. **Escrow settlement** — no scheduler moves `review → settled` (verified absent in `BASELINE_VERIFICATION_REPORT.md` §4.5), and no admin can release or freeze a payout manually.
3. **Disputes** — `ShipmentIssue` rows are created by drivers on short delivery, set the seller's payout to "frozen", and no surface exists to resolve them.

Consequently, an owner accepting the product today must accept that disputes and payouts are **permanently stuck** once raised.

## 4. Inspected vs not inspected

Inspected: `/admin` (rendered 404), full source search for any admin implementation, schema inventory, authorization primitive usage, and all 8 prototype views from the rendered prototype (`evidence/proto-admin-*.png`, desktop and mobile).

Not inspected: nothing further is possible — there is no implementation. Prototype dialogs/drawers beyond the 8 main views were not enumerated individually; the prototype file contains a shared drawer system that an admin implementation would inherit.
