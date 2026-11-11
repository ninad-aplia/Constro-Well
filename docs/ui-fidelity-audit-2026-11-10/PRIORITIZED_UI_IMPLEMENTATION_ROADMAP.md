# PRIORITIZED_UI_IMPLEMENTATION_ROADMAP.md

Phase 04A — Deliverable 10 of 11. Work packages derived from the four gap registers, sized so each can be verified independently.

Sequencing principle: **fix what is broken on screens that already exist before building new screens**, and prefer changes that survive the FastAPI migration unchanged. Concretely, UI work that only consumes an existing Next.js API is not wasted by the migration, because the contract is preserved (`API_CONTRACT_MIGRATION_MATRIX.md` in `docs/architecture-assessment-2026-11-10/`); work that invents new business logic in Next.js is, so it is deferred to the FastAPI phases where possible.

**Independence key:** `FE-only` = no backend change · `FE+read` = needs a read-only endpoint/aggregate · `BE-new` = needs new persistence · `MIG-blocked` = should wait for the backend migration decision.

---

## P0 — Blocks acceptance

### WP-UI-01 — Make the customer product card actually add to cart
- **Objective**: the most-clicked control in the storefront must work.
- **Scope**: `ProductCard.tsx` becomes a client component that calls the existing `addCartItem`; heart either removed or gated behind the wishlist work. Keep the card a server component and add a small client `AddToCartButton` if that minimises bundle impact.
- **Files**: `src/components/home/ProductCard.tsx`, `src/components/cart/*` (reuse), possibly `src/lib/api/cartApi.ts`.
- **Deps**: none (`addCartItem` exists, `CartItem` persists).
- **Risk**: card appears in 6+ surfaces; ensure `router.refresh()` and toast behaviour match the PDP.
- **Acceptance**: clicking Add to cart on home/search adds the line and the header badge increments; out-of-stock offers are blocked with a message; PDP behaviour unchanged.
- **Tests**: component test for the button's disabled/loading states; existing cart service tests stay green.
- **Sequence**: 1 · **Independence**: FE-only.

### WP-UI-02 — Restore the two-row customer header, category strip and footer
- **Objective**: close the largest structural visual gap in the customer portal.
- **Scope**: `SiteHeader` gains the prototype's second row (category `<select>`, search, hello/account, Returns & Orders, cart), deliver-to pincode control, and a horizontally scrollable category strip at mobile; `SiteFooter` gains four link columns + back-to-top. Categories from `Category` table; pincode from existing serviceability.
- **Files**: `src/components/ui/SiteHeader.tsx`, `src/components/ui/SiteFooter.tsx`, `src/components/home/*`, `src/app/layout.tsx`.
- **Deps**: none for categories; pincode persistence needs a small store/cookie decision.
- **Risk**: header height changes on every page; re-check sticky/scroll behaviour.
- **Acceptance**: header matches `proto-shop-home-1440x900.png` in structure at 1440 and `proto-shop-home-390.png` at 390; category strip scrolls at mobile; no layout shift; keyboard order sensible.
- **Tests**: visual check against both references at three viewports (manual, screenshot-compared); no new automated tests for layout.
- **Sequence**: 2 · **Independence**: FE-only.

### WP-UI-03 — Fix customer orders / seller orders / driver cards: missing names
- **Objective**: remove the blank "SHIP TO", blank buyer and blank drop-off.
- **Scope**: backfill `addressSnapshot` in `prisma/seed.ts` (name, line1, phone) and add a defensive `|| "Customer"` render fallback in the three DTO consumers.
- **Files**: `prisma/seed.ts`, `src/server/orders/service.ts` (DTO passthrough only), `src/components/cart/OrderCard.tsx`, `src/components/seller/OrdersView.tsx`, delivery card component.
- **Deps**: none.
- **Risk**: reseeding a demo database is a destructive action on that database — must be a deliberate, separate step with owner approval, not part of the code change.
- **Acceptance**: seeded orders render a name in all three portals; a freshly placed order renders the full address; no schema change.
- **Tests**: re-run `OrderDetail`/order service tests; add an assertion that a checkout-created snapshot contains `name`.
- **Sequence**: 3 · **Independence**: FE-only (+ seed).

### WP-UI-04 — Payments screen parity and non-negative balance
- **Objective**: restore the reference's settled-orders table and stop showing a negative payable.
- **Scope**: add a "Settled orders" table (order, product, items, delivery, commission, penalty, you received, status) above the existing ledger; clamp the headline to ₹0 with an explanation when transfers exceed released escrow; correct the seed transfer amounts.
- **Files**: `src/app/seller/payments/page.tsx`, `src/server/orders/sellerService.ts` (or a dedicated payments read module), `prisma/seed.ts`.
- **Deps**: `EscrowEntry` + `Shipment` already carry the data; **real settlement never runs**, so the table must state that until the scheduler exists.
- **Risk**: presenting "settled" rows that production cannot create is the current dishonesty; the new screen must label seed-only data.
- **Acceptance**: screen matches `proto-seller-payments-1440x900.png` in structure; balance is ≥ ₹0; when no shipment is `settled`, an explicit empty state says settlement has not run.
- **Tests**: unit test on the balance aggregation including the negative case; no DB write.
- **Sequence**: 4 · **Independence**: FE+read.

---

## P1 — Major mismatch or missing primary workflow

### WP-UI-05 — Account hub and address management
- **Objective**: `/account` exists with saved addresses, default marking, profile and sign-out.
- **Scope**: new route, list/add/edit/delete against `Address`; reuse the checkout address form component.
- **Files**: `src/app/account/page.tsx` (+ children), `src/components/account/*`, `src/app/api/addresses/*` (or reuse existing endpoint).
- **Deps**: `Address` model + `createAddress` exist; may need list/update/delete endpoints.
- **Acceptance**: routes render, CRUD persists, ownership enforced server-side (cannot read another user's address by id).
- **Sequence**: 5 · **Independence**: FE+read (small).

### WP-UI-06 — Wishlist
- **Objective**: implement or remove; do not leave dead hearts.
- **Scope**: `WishlistItem` exists; add service + endpoints + `/wishlist` route + card/PDP toggle.
- **Acceptance**: heart toggles persist and survive reload; `/wishlist` lists them; empty state matches the prototype copy.
- **Sequence**: 6 · **Independence**: FE+read (model exists). **Decision needed**: ship or remove.

### WP-UI-07 — Seller overview from real data
- **Objective**: replace the preview sales chart, top products and needs-attention list.
- **Scope**: aggregate `Order`/`OrderLine` for chart and top products; derive needs-attention from `acceptBy`/`dispatchBy`; date axis labels from real dates.
- **Files**: `src/app/seller/page.tsx`, `src/components/seller/SalesChart.tsx`, new read module under `src/server/orders/`.
- **Acceptance**: numbers reconcile with `/seller/orders`; the preview banner is deleted; empty state for a seller with no orders.
- **Sequence**: 7 · **Independence**: FE+read.

### WP-UI-08 — Seller delivery/countdown correctness + vehicle CRUD
- **Objective**: real countdowns, and Add/Remove vehicle against the `Vehicle` table.
- **Scope**: deadline rendering from timestamps; vehicle endpoints; seed windows relative to `now()`.
- **Acceptance**: countdown ticks and disappears at expiry; adding a vehicle makes it selectable in the dispatch dialog; removing one is blocked if a shipment references it.
- **Sequence**: 8 · **Independence**: FE+read + BE-new (small).

### WP-UI-09 — Driver acceptance gating and proof-of-delivery photo
- **Objective**: one primary action per state; capture a photo.
- **Scope**: gate completion on accepted status server-side; photo requires file storage.
- **Deps**: **file storage does not exist** — this is the first genuine infrastructure dependency in the UI roadmap.
- **Acceptance**: cannot complete an unaccepted shipment (403); photo stored and referenced by the proof record.
- **Sequence**: 9 · **Independence**: BE-new · **MIG-blocked** if storage is chosen as part of the FastAPI service.

### WP-UI-10 — Admin portal, phase A (read-only)
- **Objective**: the 3 admin views renderable from existing tables — Sellers, Users, Deliveries.
- **Scope**: `/admin` shell reusing the seller sidebar pattern, `requireAdmin()` on every route, read-only tables with the prototype's columns and badges.
- **Acceptance**: non-admin gets 403/redirect; the three tables show real rows; navigation and badges match `proto-admin-overview-1440x900.png` shell.
- **Sequence**: 10 · **Independence**: FE+read.

### WP-UI-11 — Admin portal, phase B (persistence)
- **Objective**: Approvals, Payouts, Settings, Activity log, and the Overview KPIs that depend on them.
- **Scope**: new tables (payout batch, dispute, platform settings, audit log, KYC documents) + migrations + endpoints. **Requires a schema decision** — the audit's own rules forbid schema changes without a demonstrated blocker; this is that blocker, and it needs owner approval before any work.
- **Sequence**: 11 · **Independence**: BE-new · **MIG-blocked** (strongly consider building these tables in the FastAPI service).

---

## P2 — Moderate

| ID | Item | Independence |
|---|---|---|
| WP-UI-12 | Search: brand facet, delivery facet, 5-column grid | FE+read |
| WP-UI-13 | Product card parity: review count, best-seller, delivery promise | FE+read |
| WP-UI-14 | Mobile seller layout: 2×2 cards, acceptance toggle, identity card clip (shared with driver) | FE-only |
| WP-UI-15 | Seller reviews attributed via `Review → Product → Seller` | FE+read |
| WP-UI-16 | Notification panel reading `Notification`, or remove the bell | FE+read |
| WP-UI-17 | Guest cart (or formal approval of the sign-in gate) | BE-new |
| WP-UI-18 | Review authoring + helpful votes | BE-new |
| WP-UI-19 | Delivery "failed attempt" demo state; issue-resolution surface once admin exists | BE-new |
| WP-UI-20 | Table semantics (`<th scope>`), chart text alternatives, 44 px targets | FE-only |

## P3 — Polish

| ID | Item |
|---|---|
| WP-UI-21 | Seller products default sort, inline low-stock pill, "Add product" wording |
| WP-UI-22 | Chart axis labels to real dates |
| WP-UI-23 | Footer link columns content decisions |
| WP-UI-24 | Deals countdown (only if deals get a persisted end date) |
| WP-UI-25 | `aria-current` on sidebar nav; bell `aria-expanded` |
| WP-UI-26 | Dark-mode per-screen verification pass |

---

## Recommended first five

1. **WP-UI-03** — seed/name fix (smallest change with the widest visible effect; unblocks every portal's credibility).
2. **WP-UI-01** — working card Add to cart.
3. **WP-UI-02** — customer header + footer structure.
4. **WP-UI-04** — Payments parity + non-negative balance.
5. **WP-UI-14** — mobile seller/driver layout fixes (one shared component fix covers two portals).

## Effort estimate

**Assumptions (explicit, because the brief requires them):** one senior full-stack developer already familiar with the codebase; existing design tokens and components reused; no new infrastructure except where stated; excludes FastAPI migration work; excludes QA cycles beyond the stated acceptance checks; estimate in **developer-days**.

| Band | Packages | Estimate |
|---|---|---|
| P0 (4 packages) | WP-UI-01…04 | **6–9 days** |
| P1 (7 packages) | WP-UI-05…11 | **24–34 days** — WP-UI-11 alone is 12–18 because it needs schema design, migrations and product decisions |
| P2 (9 packages) | WP-UI-12…20 | **15–22 days** |
| P3 (6 packages) | WP-UI-21…26 | **3–5 days** |
| **Total** | 26 packages | **48–70 developer-days** |

Uncertainty is dominated by WP-UI-11 (admin persistence) and WP-UI-09 (file storage), both of which have open product/infrastructure decisions. Excluding those two, the estimate narrows to **33–47 days** with materially lower variance.

## What can proceed independently of the FastAPI migration

WP-UI-01, 02, 03, 04, 06, 07, 08, 12, 13, 14, 15, 20, 21–26 — i.e. everything except the admin persistence work and the file-storage work, which should be designed once, in the target backend, rather than built twice.
