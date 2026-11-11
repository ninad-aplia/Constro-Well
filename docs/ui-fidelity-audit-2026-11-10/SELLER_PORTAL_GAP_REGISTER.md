# SELLER_PORTAL_GAP_REGISTER.md

Phase 04A — Deliverable 3 of 11. Stage 3 (Seller Portal audit).

Reference: `buildgrid-seller-dashboard.html` (7 views, `:318-393`).
Implementation: `app/src/app/seller/**`, `app/src/components/seller/**`.
Screenshots: `evidence/proto-seller-*` vs `evidence/app-seller-*` (1440×900, 1024×768, 390×844).

**Headline finding: the seller portal is the strongest portal in the product.** It shares the prototype's sidebar order, labels, card grid, two-column rhythm, palette, typography and notification-badge behaviour, and six of seven screens are recognisably the same design. The genuine gaps are narrow and specific: the Payments screen was rebuilt as a raw ledger, buyer names are blank on Orders, the sidebar identity card is clipped by the mobile bottom nav, and vehicle management is a mock over a real table.

**Classification:** MATCH / PARTIAL / MISSING / BROKEN / DIFFERENT / INTENTIONAL DEVIATION.
**Severity:** P0 blocks acceptance · P1 major visual or workflow gap · P2 moderate · P3 polish.
**Confidence:** VERIFIED (rendered + source-traced) / PARTIALLY VERIFIED (rendered only or source only).

---

## 1. Screen-level result

| Reference view | Implementation | Class | Severity | Evidence |
|---|---|---|---|---|
| Overview | `/seller` | PARTIAL | P2 | `app-seller-overview-1440x900.png` vs `proto-seller-overview-1440x900.png` |
| Orders | `/seller/orders` | PARTIAL | P1 | `app-seller-orders-1440x900.png` vs `proto-seller-orders-1440x900.png` |
| Products | `/seller/products` | PARTIAL | P2 | `app-seller-products-1440x900.png` vs `proto-seller-products-1440x900.png` |
| Delivery | `/seller/delivery` | MATCH | P3 | `app-seller-delivery-1440x900.png` vs `proto-seller-delivery-1440x900.png` |
| Payments | `/seller/payments` | **DIFFERENT** | P1 | `app-seller-payments-1440x900.png` vs `proto-seller-payments-1440x900.png` |
| Performance | `/seller/performance` | MATCH | P3 | `app-seller-performance-1440x900.png` vs `proto-seller-performance-1440x900.png` |
| Settings | `/seller/settings` | MATCH | P3 | `app-seller-settings-1440x900.png` vs `proto-seller-settings-1440x900.png` |

Counts: MATCH 3 · PARTIAL 3 · DIFFERENT 1 · MISSING 0 · BROKEN 0.

The shell is correct: `SellerSidebar.tsx` reproduces the prototype's 7 items in order (Overview, Orders, Products, Delivery, Payments, Performance, Settings) with the same red/yellow count badges, and `SellerTopBar.tsx` reproduces the search field, "Accepting orders" toggle, bell and avatar. The prototype's floating "Demo" clock is correctly not ported (demo-only, §5 of the brief).

---

## 2. Gap register

### SELL-01 — Orders table omits the buyer's name, leaving an empty first line
- **Reference**: `buildgrid-seller-dashboard.html` order rows show `Rahul M.` over `Bengaluru 560066`.
- **Current**: `src/components/seller/OrdersView.tsx:186` renders `{order.buyer}` then city/pin. `orderAdapter.ts:33` maps `buyer: shipment.buyerName`, and `sellerService.ts:95` reads `address.name` from the order's `addressSnapshot`.
- **Root cause (VERIFIED)**: the demo seed writes an incomplete snapshot — `prisma/seed.ts:334` stores only `{ city, pin }`. Real checkout writes the full snapshot (`server/orders/service.ts:286-294`, including `name`/`line1`/`phone`), so this is a **seed-data defect, not a production-code defect**. It nevertheless renders as a broken screen in every demo.
- **Difference**: the Buyer column's primary identifier is blank on all seeded orders (`app-seller-orders-1440x900.png`).
- **Fix**: backfill the seed snapshot fields (name, line1, phone); optionally render `buyerName || "Customer"` as a defensive fallback.
- **Independent of FastAPI?** Yes.
- **Confidence**: VERIFIED.

### SELL-02 — Payments was rebuilt as a raw escrow ledger; "Available to withdraw" is negative
- **Reference**: `buildgrid-seller-dashboard.html:373-378` — four summary cards, then **"Settled orders"**: Order · Product · Items · Delivery · Commission · Penalty · You received · Status (`Available`/`Withdrawn`), plus a transfers table.
- **Current**: `app/src/app/seller/payments/page.tsx` renders the four summary cards, then an **"Escrow ledger"** of every `EscrowEntry` event (Held in escrow / Platform commission / Released to payable balance / Bank transfer) newest-first. The settled-orders table does not exist.
- **Difference**: same top-of-page intent, materially different information architecture below it. The ledger is arguably *more* honest, but it is not the reference screen; a reviewer sees a transaction dump where the prototype promised a payout statement.
- **Correctness defect found while rendering it**: the summary shows **"Available to withdraw −₹32,947"** in red. Bank transfers seeded at ₹1,82,400 + ₹1,64,950 exceed released escrow, so the arithmetic balance is negative. The button is disabled and an honest banner explains withdrawals are not implemented.
- **Fix**: (a) render the prototype's settled-orders table from `Shipment.status = settled` joined to `EscrowEntry`, keeping the ledger below it as a secondary "Activity" panel; (b) reconcile seed transfers so the demo balance is non-negative; (c) clamp the headline to ₹0 with an explanation if the ledger is genuinely negative.
- **Backend dependency**: settlement never runs in production (see `architecture-assessment-2026-11-10/` + `BASELINE_VERIFICATION_REPORT.md`), so a *real* settled-orders table will be empty until the scheduler exists. The screen must therefore state that explicitly rather than imply payouts are flowing.
- **Independent of FastAPI?** Yes, but the scheduler is a prerequisite for genuine settlement data.
- **Confidence**: VERIFIED (rendered + source).

### SELL-03 — Sidebar identity card is clipped by the mobile bottom navigation
- **Reference**: bottom-left identity card (`UltraBuild Co. / Bengaluru · Score 96`) sits clear of all content at every breakpoint.
- **Current**: on desktop the card is overlapped by a dark strip and the avatar reads "N"; on 390×844 the card sits underneath the fixed bottom nav (`SellerBottomNav.tsx:21`, `fixed inset-x-0 bottom-0 z-55`), clipping the store name to "…Build Co." and the subtitle to "aluru · Score 96". The same defect appears in the driver portal (`app-delivery-jobs-390.png`).
- **Difference**: a persistent, visible layout collision in two portals on the most common device class.
- **Fix**: hide the identity card below `md` (the bottom nav already conveys identity through the avatar), and give the sidebar a `pb` that clears any overlay at desktop.
- **Severity**: P2 · **Confidence**: VERIFIED (rendered at 1440×900 and 390×844).

### SELL-04 — Mobile stat cards collapse to one column; top bar loses the acceptance toggle
- **Reference** (390×844): the four attention cards stay in a **2×2 grid**; the header keeps the "Accepting orders" toggle.
- **Current** (`app-seller-overview-390x844.png`): the four cards stack **one per row** (≈4× the vertical space), and the top bar shows a truncated search box ("Search orders by ID, p"), a two-line "Sign out" button, and no acceptance toggle.
- **Difference**: mobile information density drops sharply and the seller's most important control (availability) disappears.
- **Fix**: `grid-cols-2` for the attention cards at `sm`, shorten the mobile search placeholder, and keep the toggle in mobile `SellerTopBar`.
- **Severity**: P2 · **Confidence**: VERIFIED.

### SELL-05 — Products default order, badge placement and low-stock count differ
- **Reference**: table sorted by "Sold, 30 days" descending (1,840 → 88); `Low stock` pill sits inline beside the stepper; sidebar badge shows 4.
- **Current**: table is alphabetical (Wall Putty → UltraBuild OPC); pill sits below the stepper; sidebar badge shows 3; "Add product" is labelled "Add listing".
- **Difference**: the seller's highest-value products are no longer at the top, which changes scan behaviour on the screen they use most.
- **Fix**: default-sort by 30-day sold (already available as a field), move the pill inline, align the low-stock count with the tab count, keep the prototype's "Add product" wording.
- **Severity**: P3 (sort is arguably P2 — flagged for product decision) · **Confidence**: VERIFIED.

### SELL-06 — Vehicle and driver management is a mock over a real `Vehicle` table
- **Reference**: "Vehicles and drivers" table with Add vehicle / Remove.
- **Current**: table renders and the disclosure states "Vehicle and driver management isn't connected to the database yet; adding or removing a vehicle here only changes this screen" (`app-seller-delivery-1440x900.png`). `Vehicle` and `Driver` models exist, and dispatch already consumes them.
- **Difference**: the prototype's CRUD is decorative here. Honest, but incomplete.
- **Fix**: wire Add/Remove vehicle to the existing models (create `Vehicle`, attach `Driver`), reusing the `VehicleDialog` form that is already rendered.
- **Severity**: P2 · **Confidence**: VERIFIED.

### SELL-07 — Overview's sales chart, top products and needs-attention list are preview data
- **Reference**: all widgets live.
- **Current**: `app/src/app/seller/page.tsx:41-42` mixes `useSellerStore()` (mock) with `useSellerLive()` (real). The disclosure at `:77` states that order/inventory counts, delivery score and payout balances are live while "Sales charts, top products and the needs-attention list still use preview data".
- **Difference**: the largest visual area of the dashboard (chart + top products) is not backed by the database, and the numbers do not reconcile with `/seller/orders` (196 vs 194 orders, different date labels `Day 1`/`Day 16`/`Day 30` vs the prototype's `12 Oct`/`27 Oct`/`10 Nov`).
- **Fix**: derive the chart from `Order.createdAt`/`grossTotal` (or `EscrowEntry`), top products from `OrderLine` grouped by `productId`, needs-attention from `Shipment.acceptBy`/`dispatchBy` with real countdowns. All data is already persisted; this is read-only aggregation, no schema change.
- **Severity**: P2 · **Confidence**: VERIFIED (rendered + source).

### SELL-08 — Acceptance/dispatch countdowns replaced by "overdue" text
- **Reference**: `New, accept it · 3h 17m left`; `Dispatch 16h 59m left`.
- **Current**: `New, accept it · overdue` on all three rows (`app-seller-orders-1440x900.png`), because every seeded shipment's `acceptBy` is in the past relative to real wall-clock time.
- **Difference**: the deadline pressure the prototype was designed around is lost, and three actionable orders look permanently late.
- **Fix**: seed windows relative to `now()` (e.g. `now + 2h`), and render the live countdown from `acceptBy`/`dispatchBy`.
- **Severity**: P2 (demo credibility) · **Confidence**: VERIFIED.

### SELL-09 — Performance reviews are disclosed as unattributed preview data
- **Reference**: "Customer reviews · 4.5 average" with star histogram and per-review product + date.
- **Current**: layout matches, but a banner states reviews are preview data because the catalogue does not attribute product reviews to a seller (`app-seller-performance-1440x900.png`).
- **Difference**: design MATCH, data not yet seller-scoped.
- **Fix**: `Review` has `productId` but no seller linkage; derive seller reviews by joining `Review → Product → SellerOffer.sellerId`. Read-only; no schema change.
- **Severity**: P2 · **Confidence**: VERIFIED.

### SELL-10 — Notification bell and alert toggles are decorative
- **Reference**: bell opens a notifications panel; alert toggles persist.
- **Current**: bell renders a red count from live summary data but opens nothing (no route, no panel). Alert toggles are explicitly labelled "only apply to this browser session" (`app-seller-settings-1440x900.png`).
- **Fix**: `Notification` model exists but no service reads/writes it (grep for `notification` under `src/server` returns no service). Decide: implement a panel reading `Notification`, or remove the affordance.
- **Severity**: P3 · **Confidence**: VERIFIED.

### SELL-11 — KYC "Upload" replaced with an honest pending badge
- **Reference**: `Upload (demo)` button beside "Cancelled cheque".
- **Current**: `Pending — document upload isn't available yet` pill.
- **Assessment**: **INTENTIONAL DEVIATION, approved by design intent** — the prototype's upload is a demo affordance with no storage. Replacing it with an honest state is correct and should be kept until file storage exists.
- **Severity**: none (deviation) · **Confidence**: VERIFIED.

---

## 3. What genuinely works (so remediation does not regress it)

- **Product create/edit/stock**: real, persisted, with server-side validation and ownership scoping (`server/seller/inventory.ts`); the known lost-update race is specified separately in `P0_REMEDIATION_SPECIFICATION.md`.
- **Order accept / reject / pack / dispatch**: real transitions against `Shipment`, with the seller's own offers, vehicles and documents (`server/orders/sellerService.ts`), including the dispatch dialog and reject-with-reason dialog.
- **Delivery rules**: free-above, fee, slot capacity and service-area pincodes all persist to `Seller`/`SellerPincode` and are read by real checkout serviceability (`server/seller/delivery.ts`).
- **Profile settings**: store name, GSTIN, phone, pickup address and vacation mode persist with server-side validation (`server/seller/profile.ts`).
- **Delivery score / acceptance / on-time / issue-free**: computed from real shipments (`server/orders/sellerService.ts` stats), matching the prototype's ring and bars.
- **Statement download**: the escrow CSV export is a real client-side download of the data on screen (`page.tsx:40-46`).

## 4. Inspected vs not inspected

Inspected (rendered, authenticated at `imran.shaikh@demo.constrowell.test`): all 7 seller views at 1440×900; all 7 at 390×844 and 1024×768 (re-captured authenticated during this phase — the earlier mobile captures had landed on the sign-in redirect and were replaced); Add-listing dialog at 1440.

Not inspected: dispatch dialog, reject dialog, vehicle dialog rendering; order drawer contents; vacation-mode toggle persistence; statement CSV file contents; notification panel (does not exist). These are source-traced only and are marked PARTIALLY VERIFIED where relied upon.
