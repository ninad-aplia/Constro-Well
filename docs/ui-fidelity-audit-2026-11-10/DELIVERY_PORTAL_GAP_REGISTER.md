# DELIVERY_PORTAL_GAP_REGISTER.md

Phase 04A — Deliverable 4 of 11. Stage 4 (Delivery Portal audit).

Reference: `buildgrid-delivery-workflow.html` — the **Driver** tab (`:315-332`) is the delivery portal. The file's other four tabs are cross-portal documentation, not delivery screens:
- *How it works* (`:348-354`) — explanatory copy.
- *Customer* (`:287-304`), *Vendor* (`:306-313`), *Admin* (`:334-346`) — views of the same delivery from the customer, seller and admin portals. They belong to Deliverables 2, 3 and 5, and are not counted as delivery-portal screens.

Implementation: `app/src/app/delivery/**`, `app/src/components/delivery/**`.
Screenshots: `evidence/proto-delivery-driver-1440x900.png`/`-390x844.png`, `evidence/app-delivery-*.png`, `evidence/viewport/app-delivery-jobs-390.png`.

**Classification:** MATCH / PARTIAL / MISSING / BROKEN / DIFFERENT / INTENTIONAL DEVIATION.
**Severity:** P0 · P1 · P2 · P3. **Confidence:** VERIFIED / PARTIALLY VERIFIED.

---

## 1. Reference structure (driver tab) vs implementation

The prototype presents the driver experience as a **phone frame inside a demo page**: an "Assigned deliveries" list on the left and a single drop-off card on the right containing pickup, drop-off, document links, a 4-box OTP input, photo capture, delivered quantity, "Confirm delivery" and "Customer not available".

The application presents a **first-class routed portal** (`/delivery`, `/delivery/jobs`, `/delivery/history`, `/delivery/settings`) with a sidebar at desktop and a bottom nav at mobile, and moves the drop-off workflow into a right-hand drawer opened by "Complete delivery".

| Reference unit | Implementation | Class | Severity |
|---|---|---|---|
| Assigned deliveries list | `/delivery/jobs` (tabs All / On the road / Failed attempts + search) | PARTIAL | P1 |
| Drop-off card: pickup + drop-off + slot | Drawer header (`app-delivery-complete-dialog-1440x900.png`) | PARTIAL | P1 |
| Drop-off card: challan / invoice links | Drawer "Documents: Challan, GST invoice" text | PARTIAL | P3 |
| OTP entry (4 boxes) | Real 4-box input in drawer | MATCH | — |
| Photo of unloaded goods | "Take a photo on your phone, then tap here" — no upload | DIFFERENT | P1 |
| Quantity delivered | Real input, pre-filled with ordered qty | MATCH | — |
| Confirm delivery | Real action (`Confirm delivery`) | MATCH | — |
| Customer not available | "Report a delivery issue" with reason select | MATCH | — |
| Rules the app enforces | `/delivery/settings` "Rules this app enforces" | MATCH | P3 |
| Phone-frame presentation | Not ported (routed responsive portal instead) | INTENTIONAL DEVIATION | — |
| Demo clock | Not ported | INTENTIONAL DEVIATION (correct) | — |

Counts for the single reference screen and its 8 states: MATCH 3 · PARTIAL 4 · DIFFERENT 1 · MISSING 0 · BROKEN 0.
Two implemented screens (**history**, **settings**) have **no reference counterpart** — they are additions, listed separately in §4, not scored as gaps.

---

## 2. Gap register

### DEL-01 — Buyer name missing on every delivery card ("to , Bengaluru")
- **Reference**: `Drop-off: Rahul Menon / Bengaluru 560066 · Today, 2 to 6 pm`.
- **Current**: list card reads `100 bag · to, Bengaluru 560066`; drawer reads `Drop-off    , Bengaluru 560066` — the name slot is empty (`app-delivery-jobs-driver.png`, `app-delivery-complete-dialog-1440x900.png`, viewport `app-delivery-jobs-390.png`).
- **Root cause (VERIFIED)**: identical to SELL-01 — `prisma/seed.ts:334` writes `addressSnapshot: { city, pin }` without `name`. Checkout writes the full snapshot (`server/orders/service.ts:286-294`).
- **Difference**: the driver cannot see who to hand the goods to, on the one screen where that matters most.
- **Fix**: backfill seed snapshots; render the recipient name prominently in the drawer header.
- **Independent of FastAPI?** Yes. · **Confidence**: VERIFIED.

### DEL-02 — Proof-of-delivery photo is not captured
- **Reference**: `2. Photo of the unloaded goods` with a camera action; delivery "only counts when the OTP matches and a photo is attached".
- **Current**: the drawer says "Take a photo on your phone, then tap here" and the settings page states "a photo stays on the driver's phone"; the completion path records OTP and quantity only.
- **Difference**: the prototype's core proof artefact is absent, which weakens the escrow-review story the whole product rests on. The app is honest about it rather than faking it — but the gap is real.
- **Fix**: needs file storage (no upload backend exists). Until then the drawer should state plainly that a photo is required by policy but not captured, so a reviewer does not assume disputes are photo-backed.
- **Severity**: P1 · **Backend dependency**: yes (file storage). · **Confidence**: VERIFIED by source + rendered copy.

### DEL-03 — No "Accept job" gating on the list; dispatch state is implied
- **Reference**: a driver sees assigned deliveries with their current state.
- **Current**: the list card offers **both** "Accept job" and "Complete delivery" simultaneously, and the drawer repeats "Accept job before you start the delivery" while "Confirm delivery" is already enabled (`app-delivery-jobs-driver.png`, `app-delivery-complete-dialog-1440x900.png`).
- **Difference**: the control hierarchy contradicts itself; a driver can attempt completion without accepting.
- **Fix**: gate the completion action on an accepted shipment (server-enforced, not just disabled UI), and show a single primary action per state.
- **Severity**: P1 · **Confidence**: VERIFIED (rendered); server-side gating not re-traced in this read-only pass → **PARTIALLY VERIFIED** for the backend condition.

### DEL-04 — "Failed attempts" tab has no reachable state in the demo
- **Reference**: the driver tab describes "Three wrong OTPs mark the delivery as a failed attempt".
- **Current**: the tab exists and is empty (`0`); no shipment in the seed is in a failed state, so the designed recovery path cannot be demonstrated.
- **Fix**: seed one shipment with `status: failed` and a `ShipmentIssue`, or drive three wrong OTPs in a demo script.
- **Severity**: P2 (demo coverage) · **Confidence**: VERIFIED.

### DEL-05 — Desktop delivery portal uses the seller shell rather than a mobile-first driver layout
- **Reference**: the prototype deliberately renders the driver experience as a phone, because the driver is on a handset.
- **Current**: at 1440 the portal is a full desktop sidebar app; at 390 it becomes a bottom-nav mobile app that reads well (`viewport/app-delivery-jobs-390.png`).
- **Assessment**: the responsive result is arguably better for a real product — a driver at a desk reviewing history benefits from the desktop layout — and the mobile experience preserves the prototype's intent. Classified **INTENTIONAL DEVIATION**, but flagged for owner sign-off because the prototype's phone framing is a visible part of what the client approved.
- **Severity**: none if accepted; P2 if the client expects the phone framing · **Confidence**: VERIFIED.

### DEL-06 — Sidebar identity card clipped by the bottom nav (shared with seller)
- **Current**: at 390 the bottom-left identity card sits behind the fixed bottom navigation, clipping the store name and driver name.
- **Fix / severity**: as SELL-03 — P2, shared component fix covers both portals. · **Confidence**: VERIFIED.

### DEL-07 — OTP is never shown in the driver portal (correct), but no fallback path is documented
- **Reference**: "The OTP is shown in the customer's order page. It is never shown in this portal."
- **Current**: same rule enforced and stated in the drawer.
- **Assessment**: MATCH on the security rule. The operational gap is that there is no documented escalation when the customer cannot produce the OTP other than "Report a delivery issue"; that is a business question, not a UI defect.
- **Severity**: none · **OPEN QUESTION** — see `OPEN` items in the executive assessment. · **Confidence**: VERIFIED (rule), UNVERIFIED (ops process).

---

## 3. What genuinely works

- **Real driver job list** scoped by `resolveDriverForUser` (`server/orders/driverService.ts`), with search and status tabs.
- **Real OTP verification** with attempt counting; wrong attempts are recorded and can fail the delivery.
- **Real issue reporting** (`ShipmentIssue`) with reasons, which freezes the seller payout on quantity shortfall.
- **Real quantity-based proof** creating a dispute when delivered < ordered.
- **History** with review/disputed/paid tabs and real shipment states (`app-delivery-history-driver.png`).
- **Settings** reading the seller's registered vehicles and drivers, with the enforced-rules panel.

## 4. Additions with no reference counterpart

| Screen | Route | Assessment |
|---|---|---|
| Delivery history | `/delivery/history` | Useful addition; renders real data; carries the same blank buyer name (DEL-01) |
| Profile and settings | `/delivery/settings` | Useful addition; reads real vehicles/drivers; states the OTP/no-GPS rules honestly |

## 5. Inspected vs not inspected

Inspected (rendered, authenticated as `ramesh.kumar@demo.constrowell.test`): `/delivery/jobs` at 1440 and 390 (viewport), completion drawer at 1440 and 390, `/delivery` at 1440 and 390, `/delivery/history` at 1440, `/delivery/settings` at 1440; prototype driver tab at 1440 and 390.

Not inspected: an actual OTP confirmation (write path — would mutate the shared local database), the three-wrong-OTP failure path, the issue-report submission result, courier assignment changes by the seller. All are marked PARTIALLY VERIFIED where referenced.
