# FUNCTIONAL_INTERACTION_MATRIX.md

Phase 04A — Deliverable 7 of 11. Stage 6 (functional verification).

Every interactive element the four prototypes expose, and what the application actually does when it is used. Status vocabulary:

- **WORKS** — performs the action and persists it (server + database verified by source trace; rendered where possible).
- **WORKS (UI only)** — performs the action correctly but the effect is session-local, and the UI says so.
- **PREVIEW** — operates on demo/preview state; no persistence.
- **BROKEN** — present, invoked, does not achieve its stated effect.
- **MISSING** — the action or its entry point does not exist.
- **DISABLED** — rendered but deliberately inert.
- **N/A** — demo-only affordance correctly not ported.

Confidence: VERIFIED (source + render) / PARTIALLY VERIFIED (one of the two).

---

## 1. Customer portal (`buildgrid-shop.html`)

| Interaction | Reference | Current behaviour | Status | Confidence |
|---|---|---|---|---|
| Global search | header + `#/search` | `/search?q=` → real Prisma query; works (rendered) | WORKS | VERIFIED |
| Category navigation | category select + strip + tiles | Tiles link to `/search?category=`; **no strip, no select** | PARTIAL → `CUST-01` | VERIFIED |
| Deliver-to pincode | header control filters availability | **MISSING** (no control; serviceability exists server-side) | MISSING | VERIFIED |
| Sort results | sort dropdown | Sort control present on `/search` | PARTIAL | VERIFIED (render) |
| Filter: category / rating / price / deals | sidebar facets | Present | WORKS | VERIFIED |
| Filter: brand | sidebar facet with counts | **MISSING** | MISSING | VERIFIED |
| Filter: fast delivery | sidebar facet | **MISSING** | MISSING | VERIFIED |
| Pagination | pager with disabled edges | Present | WORKS | VERIFIED (render) |
| Product card → PDP | card click | Links to `/product/[id]` | WORKS | VERIFIED |
| Product card "Add to cart" | active yellow button | **`disabled`** — `ProductCard.tsx:107-115` | **DISABLED / BROKEN affordance** | VERIFIED |
| Product card wishlist heart | toggles wishlist | **`disabled`** — `ProductCard.tsx:39-49` | DISABLED (wishlist route absent) | VERIFIED |
| PDP gallery thumbnails | swap main image | Client-side swap works | WORKS | VERIFIED (source) |
| PDP bulk pricing | qty → tier price | Client calculation mirrors server tiers | WORKS | VERIFIED (source) |
| PDP "Add to cart" | add to real cart | Calls `addCartItem` → persists | WORKS | PARTIALLY VERIFIED (not clicked in audit; source traced) |
| PDP "Buy now" | straight to checkout | Present | PARTIALLY VERIFIED | PARTIALLY VERIFIED |
| Guest cart | usable before sign-in | `/cart` redirects guests to `/login?next=/cart` (`CartView.tsx:40`) | **DIFFERENT** → `CUST-02` | VERIFIED |
| Cart qty +/- | update line | `updateCartItem` persists | WORKS | VERIFIED (source) |
| Cart remove / save for later | remove, save-for-later | Remove works; **no save-for-later** | PARTIAL | VERIFIED |
| Coupon apply/remove | applied + invalid states | `applyCoupon` against `Coupon`; invalid message rendered | WORKS | VERIFIED (source) |
| Checkout address | add/edit/select address | Address create inside checkout only; **no `/account`** | PARTIAL | VERIFIED |
| Checkout payment | cards/UPI/COD demo options | COD only, capped at ₹50,000 (`service.ts:172,245`; `COD_CAP`) | INTENTIONAL DEVIATION | VERIFIED |
| Place order | creates order | Real, idempotent, row-locked | WORKS | PARTIALLY VERIFIED (not executed; prior baseline tests cover it) |
| Order confirmation | `#/thanks` | `/thanks/[id]` exists | WORKS | VERIFIED (route only) |
| Orders list | cards with SHIP TO, status, actions | List renders; **SHIP TO blank**, no status pill, no reorder/review | PARTIAL → `CUST-10` | VERIFIED |
| Order detail tracker | 5-stage tracker, cancel window | Real `fetchOrder` + 5-stage stepper + cancel dialog (`OrderDetailView.tsx:12,171`) | WORKS | VERIFIED (source) |
| Cancel order | within window | `cancelOrder` API; restores stock | WORKS | VERIFIED (source) |
| Write a review | per delivered line | **MISSING** — no review API/route | MISSING | VERIFIED |
| Helpful vote | on review cards | **MISSING** | MISSING | VERIFIED |
| Wishlist view | `#/wishlist` | `/wishlist` → 404 | MISSING | VERIFIED |
| Account view | `#/account` + address CRUD | `/account` → 404 | MISSING | VERIFIED |
| Sign in / register | modal | Dedicated `/login`, `/register` pages | WORKS (different form factor) | VERIFIED |
| Sign out | account menu | Header link when authenticated | WORKS | VERIFIED |
| Recently viewed | row on home | Not present in customer routes | MISSING | PARTIALLY VERIFIED |

---

## 2. Seller portal (`buildgrid-seller-dashboard.html`)

| Interaction | Reference | Current behaviour | Status | Confidence |
|---|---|---|---|---|
| Sidebar navigation | 7 items + badges | All 7 routes exist, same order/badges | WORKS | VERIFIED |
| "Accepting orders" toggle | header switch | Persists `vacationMode` via profile API | WORKS | VERIFIED (source) |
| Global search | orders/products/buyer/city | Filters client-side across orders/products | WORKS (UI only) | VERIFIED (source) |
| Notifications bell | panel of events | Badge renders; **no panel** | BROKEN (affordance) | VERIFIED |
| Add product | dialog | Persists to `SellerOffer` | WORKS | VERIFIED (source) |
| Edit product (price/details) | dialog | Persists; **submits absolute stock** (lost-update risk) | WORKS, with concurrency defect | VERIFIED |
| Stock stepper ± | adjust stock | Persists absolute value; zero → paused | WORKS, with concurrency defect | VERIFIED |
| Pause/resume listing | status switch | Persists | WORKS | VERIFIED |
| Remove listing | remove | Not present in app (prototype product rows only Edit) | N/A | VERIFIED |
| Order accept | Accept | Real transition; 4-hour window enforced | WORKS | VERIFIED (source) |
| Order reject | Reject + reason | `RejectDialog` → real transition + stock restore | WORKS | VERIFIED (source) |
| Mark packed | Packed | Real transition | WORKS | VERIFIED (source) |
| Dispatch | Dispatch + vehicle/slot/challan/invoice | `DispatchDialog` → real transition, vehicle assignment, OTP generation | WORKS | VERIFIED (source) |
| Order details drawer | Details | `OrderDrawer` renders real shipment | WORKS | PARTIALLY VERIFIED |
| Service areas (pincodes) | add/remove chips | Persists to `SellerPincode`, consumed by checkout | WORKS | VERIFIED (source) |
| Delivery charges + slots | save rules | Persists to `Seller` | WORKS | VERIFIED (source) |
| Add/remove vehicle | dialog + remove | **Preview only** (explicit disclosure) | PREVIEW → `SELL-06` | VERIFIED |
| Withdraw funds | Withdraw button | **Disabled**; ledger balance negative | BROKEN (deliberate) | VERIFIED |
| Download statement | CSV | Client-side CSV of rendered ledger | WORKS | VERIFIED (source) |
| Payout details | Details link | Navigates to payments | WORKS | VERIFIED |
| Period selector (7/30/90) | segmented control | Renders; aggregation is preview data | PREVIEW | VERIFIED |
| Needs-attention "Open" | opens the item | Opens preview item | PREVIEW | VERIFIED |
| Alert toggles | 4 switches | Session-local, disclosed | WORKS (UI only) | VERIFIED |
| KYC cheque upload | Upload (demo) | Honest "not available" pill | INTENTIONAL DEVIATION | VERIFIED |
| Save store details | Save changes | Persists with validation | WORKS | VERIFIED (source) |

---

## 3. Delivery portal (`buildgrid-delivery-workflow.html`, driver tab)

| Interaction | Reference | Current behaviour | Status | Confidence |
|---|---|---|---|---|
| Assigned delivery list | list of shipments | Real `listDriverJobs` | WORKS | VERIFIED |
| Status tabs | — (prototype has no tabs) | All / On the road / Failed attempts | ADDITION | VERIFIED |
| Search | — | Filters by order/product/buyer/city | ADDITION | VERIFIED |
| Accept job | implied precondition | Button present; **completion not gated** | PARTIAL → `DEL-03` | VERIFIED (render) |
| Open drop-off detail | phone card | Drawer with pickup/drop-off/vehicle/driver/documents | WORKS | VERIFIED |
| OTP entry (4 boxes) | 4 boxes | Real input, server-verified with attempt counting | WORKS | VERIFIED (source) |
| Photo of goods | camera action | **Not captured**; copy explains | MISSING → `DEL-02` | VERIFIED |
| Quantity delivered | numeric input | Pre-filled with ordered qty; shortfall opens dispute | WORKS | VERIFIED (source) |
| Confirm delivery | primary action | Real completion + proof record | WORKS | PARTIALLY VERIFIED (not executed) |
| Customer not available | secondary action | "Report a delivery issue" with reasons | WORKS | VERIFIED (source) |
| Issued → payout freeze | automatic | Implemented via `ShipmentIssue` → escrow freeze | WORKS | VERIFIED (source) |
| History | — | `/delivery/history` with review/disputed/paid tabs | ADDITION | VERIFIED |
| Rules panel | "Rules the app enforces" | `/delivery/settings` | WORKS | VERIFIED |
| Demo clock | +1h / +4h / +24h / reset | Correctly absent | N/A | VERIFIED |

---

## 4. Admin portal (`buildgrid-platform-admin.html`)

| Interaction | Reference | Current behaviour | Status |
|---|---|---|---|
| Sign-in as admin | implied by identity card | No admin surface | MISSING |
| Overview KPIs + charts | `:343-367` | — | MISSING |
| Approve/reject seller | `:369-384` | — | MISSING |
| Delivery monitor filters | `:386-395` | — | MISSING |
| Approve payout batch | `:397-404` | — | MISSING |
| Pause all payouts | `:354` banner control | — | MISSING |
| Seller watchlist | `:406-413` | — | MISSING |
| User directory | `:415-422` | — | MISSING |
| Activity log | `:424-428` | — | MISSING |
| Platform settings | `:430-436` | — | MISSING |

---

## 5. Interaction parity summary

Denominator: **77 scored reference interactions**, counted row-by-row from the four tables above (customer 33, seller 24, delivery 10, admin 10). Excluded from the denominator because they are not reference interactions: the delivery portal's one demo-only affordance (the clock, **N/A**) and its three app-only additions (status tabs, search, history, all marked **ADDITION**); the seller's one **N/A** row (remove-listing, which the prototype does not expose).

| Status | Count | Share of 77 |
|---|---|---|
| WORKS / WORKS (UI only) | 42 | 54.5 % |
| PARTIAL | 6 | 7.8 % |
| PREVIEW (session-local or demo state) | 3 | 3.9 % |
| DISABLED / BROKEN | 4 | 5.2 % |
| MISSING | 19 | 24.7 % |
| DIFFERENT (guest cart) | 1 | 1.3 % |
| INTENTIONAL DEVIATION (COD-only, KYC upload) | 2 | 2.6 % |

Per portal, interactions that fully work: customer 16/33 (48 %), seller 18/24 (75 %), delivery 8/10 (80 %), admin 0/10 (0 %).

Two of the "MISSING" items are entire screens (wishlist, account) and one is the whole admin portal — the missing share is therefore concentrated in whole surfaces rather than spread thinly across working screens.

**Most consequential single defect:** the customer product card's "Add to cart" is `disabled` on every listing surface while the PDP's identical action works. A reviewer clicking the most obvious button on the home page concludes the storefront is non-functional, even though the cart, checkout and order pipeline behind it are real.
