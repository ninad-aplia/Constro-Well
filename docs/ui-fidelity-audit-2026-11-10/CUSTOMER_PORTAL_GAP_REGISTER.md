# CUSTOMER_PORTAL_GAP_REGISTER.md

Phase 04A — Deliverable 2 of 11. Stage 2 (Customer Portal audit) findings.

Reference: `buildgrid-shop.html` (788 lines, 10 hash-routed views — `:658`).
Implementation: `app/src/app/**` customer routes + `app/src/components/{ui,cart,catalog,auth}/**`.

**Classification legend:** MATCH / PARTIAL / MISSING / BROKEN / DIFFERENT / INTENTIONAL DEVIATION.
**Severity:** P0 blocks acceptance · P1 major visual or workflow gap · P2 moderate · P3 polish.
**Confidence:** VERIFIED (rendered + source-traced) / PARTIALLY VERIFIED (rendered only, or source only).

---

## 1. Screen-level result

| Reference view | Implementation | Class | Severity | Evidence |
|---|---|---|---|---|
| home | `/` | PARTIAL | P1 | `evidence/app-customer-home-1440x900.png` vs `proto-shop-home-1440x900.png` |
| search | `/search` | PARTIAL | P1 | `evidence/app-customer-search-1440x900.png` vs `proto-shop-search-1440x900.png` |
| product | `/product/[id]` | PARTIAL | P2 | `evidence/app-customer-product-1440x900.png` vs `proto-shop-product-1-1440x900.png` |
| cart | `/cart` | PARTIAL | P1 | guest → sign-in (`CartView.tsx:40`); authenticated cart renders (`app-customer-cart-auth-1440x900.png`) |
| checkout | `/checkout` | PARTIAL | P1 | guest → sign-in; authenticated checkout not captured (write path) — PARTIALLY VERIFIED |
| thanks | `/thanks/[id]` | PARTIAL | P2 | route exists; not captured (requires placing an order) — PARTIALLY VERIFIED |
| orders | `/orders` | PARTIAL | P1 | `app-customer-orders-auth-1440x900.png` vs prototype orders view |
| order | `/orders/[id]` | PARTIAL | P1 | route exists; tracker parity not captured — PARTIALLY VERIFIED |
| wishlist | — | **MISSING** | P2 | `/wishlist` returns HTTP 404 (probe recorded in capture notes) |
| account | — | **MISSING** | P1 | `/account` returns HTTP 404; no address-management UI anywhere in `src/app` |

Counts: MATCH 0 · PARTIAL 8 · MISSING 2 · BROKEN 0 · DIFFERENT 0.

---

## 2. Gap register

### CUST-01 — Global header omits the prototype's entire second navigation row, deliver-to control and account menu
- **Reference**: `buildgrid-shop.html:167-190` — two-row header: logo; "Deliver to Bengaluru 560001"; category `<select>` + search input + yellow search button; "Hello, sign in / Account & lists"; "Returns & Orders"; "Cart"; then a full-width sub-nav: `All · Today's deals · Cement · Steel · Sand · Bricks · Tiles · Paint · Plumbing · Electrical · Safety · Your orders`.
- **Current**: `app/src/components/ui/SiteHeader.tsx` is a 54-line single-row header (logo + tagline, search + "GO", Sign in / Create account, Cart). No sub-nav, no category select, no deliver-to, no account dropdown, no Returns & Orders. Rendered proof: `app-customer-home-1440x900.png` header strip.
- **Difference**: the primary wayfinding layer of the storefront is absent at every breakpoint; on mobile the prototype additionally keeps a horizontally scrollable category strip (`proto-shop-home-390.png`) which the app does not have.
- **Fix**: rebuild `SiteHeader` as the prototype's two-row structure, with the category strip driven by the real `Category` table, and a pincode control wired to the existing serviceability data (`server/orders/service.ts` already resolves pincode serviceability).
- **Independent of FastAPI?** Yes — frontend plus existing Next.js API.
- **Confidence**: VERIFIED.

### CUST-02 — Guests cannot use the cart; the prototype's guest cart is intentionally supported
- **Reference**: `buildgrid-shop.html` — cart state persisted per owner, with the literal `"guest"` owner key (`DB.carts`/`DB.wish`/`DB.addr`), so an unauthenticated visitor can add, edit and inspect a cart; authentication is demanded only at checkout (`checkout()` at `:697` opens auth when `!user()`).
- **Current**: `app/src/components/cart/CartView.tsx:40` performs `router.replace("/login?next=/cart")` when there is no session; `/cart` as a guest renders the sign-in page (`app-customer-cart-1440x900.png`).
- **Difference**: the storefront funnels anonymous traffic into registration before the first cart view, which is a conversion-affecting behaviour change from the reference journey.
- **Fix**: allow guest cart lines (cookie/session-scoped, merged on sign-in) or, if product decides otherwise, record it as an approved INTENTIONAL DEVIATION in `DECISIONS.md`.
- **Independent?** Yes (cart service already exists server-side).
- **Confidence**: VERIFIED.

### CUST-03 — Wishlist absent at every entry point
- **Reference**: wishlist view plus a heart on every product card and on the PDP buy box (`buildgrid-shop.html` `wish()` action, `aria-pressed` toggling).
- **Current**: `/wishlist` → 404; hearts render on cards but the PDP's "Add to wish list" control is inert/disabled-looking (`app-customer-product-1440x900.png`). No `/wishlist` route exists in `app/src/app` (route inventory: 21 pages, none for wishlist).
- **Difference**: a primary saved-items journey is missing while its affordances are still drawn, which reads to a reviewer as broken UI rather than an unbuilt feature.
- **Fix**: either implement `WishlistItem`-backed wishlist (model already exists in `schema.prisma`) or remove the heart affordances until it ships.
- **Confidence**: VERIFIED.

### CUST-04 — Account area (saved addresses, profile, sign-out surface) missing
- **Reference**: account view with saved-address list, add/edit/delete address dialog, default-address marking, sign-out.
- **Current**: `/account` → 404. Address creation exists only inside checkout. Header offers "Sign out" as a bare link when authenticated; there is no account hub.
- **Difference**: customers cannot manage addresses outside a checkout attempt, and the prototype's account destination is a dead end.
- **Fix**: add `/account` with address CRUD against the existing `Address` model and service layer.
- **Confidence**: VERIFIED for the missing route; PARTIALLY VERIFIED for address CRUD completeness inside checkout.

### CUST-05 — Product cards lose rating volume, best-seller badges and delivery promise
- **Reference**: card anatomy at `buildgrid-shop.html:380-390` — art with discount tag and optional "Best seller" tag; title; **stars + numeric rating + review count** (e.g. `4.9 · 9,870`); price, MRP, % off; bulk hint; **`FREE delivery <date>`** with ETA; Add to cart.
- **Current**: `app/src/app/page.tsx` and `/search` cards render stars with `0`/`1`/`2` (raw review counts, mostly empty), no `Best seller` tag, no delivery date line, no bulk hint on the card. See `app-customer-home-1440x900.png`, `app-customer-search-1440x900.png`.
- **Difference**: the reference's density and trust signals are the most visible "this looks different" delta on the highest-traffic pages.
- **Fix**: surface review aggregate (`_avg`/`_count` from `Review`) and derive the delivery promise from seller `freeAbove`/lead time already persisted on `Seller`; add best-seller flag from `SellerOffer` sold counts.
- **Backend dependency**: small read-only aggregate work; no schema change.
- **Confidence**: VERIFIED.

### CUST-06 — Search filters incomplete and grid density differs
- **Reference**: facets for Category (with counts), Customer reviews, **Brand (long list with counts)**, Price, **Delivery (fast delivery by tomorrow)**, Deals; 5-across product grid at 1440.
- **Current**: Category, Customer reviews, Price, Deals only; **no Brand facet, no Delivery facet**; 4-across grid with wider gutters (`app-customer-search-1440x900.png`).
- **Difference**: brand is a first-class buying axis in construction materials; its absence materially reduces the search experience the client reviewed.
- **Fix**: add brand + delivery facets to the existing search service query and restore 5-column density at ≥1280 px.
- **Confidence**: VERIFIED.

### CUST-07 — Footer reduced to a single line
- **Reference**: four link columns (Get to know us / Sell with us / Payment / Help) plus "Back to top" (`buildgrid-shop.html:781`).
- **Current**: one navy strip with a single copyright line (`app-customer-home-1440x900.png` bottom).
- **Fix**: restore the four-column footer shell; point links at real destinations, remove the ones with no product decision.
- **Severity**: P3 · **Confidence**: VERIFIED.

### CUST-08 — Deals countdown and hero polish missing
- **Reference**: "Today's deals — Ends in 08:22:09" live countdown in the row header; hero is full-bleed on mobile with arrows/art.
- **Current**: no countdown; mobile hero is an inset rounded card (`viewport/app-customer-home-390.png`).
- **Fix**: countdown requires a real deal end-time; if deals have no persisted end date, either add one or drop the countdown rather than fake it.
- **Severity**: P3 · **Confidence**: VERIFIED.

### CUST-09 — Primary CTAs render in a disabled-looking washed yellow
- **Reference**: Add to cart is solid `--hi` `#FFC72C` with `--hi-ink` text on every card.
- **Current**: the same buttons render at low contrast/opacity across home, search and PDP (`app-customer-home-1440x900.png`, `app-customer-search-1440x900.png`, `app-customer-product-1440x900.png`), while the PDP "Add to cart" in the buy box is solid. Two different button treatments for the same action.
- **Difference**: a reviewer reads the pale buttons as disabled; it is the single most repeated visual inconsistency in the portal.
- **Fix**: unify the card CTA on the solid token used in the buy box; verify against the design token, not a per-component override.
- **Severity**: P2 · **Confidence**: VERIFIED (rendered); root cause not traced to a specific class in this read-only pass.

### CUST-10 — Orders list lacks status, tracker and post-order actions; ship-to is blank
- **Reference**: order cards show ORDER PLACED / TOTAL / SHIP TO / ORDER #, status headline with arrival date, per-line seller and qty, Buy it again, Write a review, Track package; order detail carries a 5-stage tracker and cancel-window logic.
- **Current**: cards show order number, totals, "Arriving 10 November 2026", line items and "Track package"; **SHIP TO is empty**, no status pill, no cancel/reorder/review actions (`app-customer-orders-auth-1440x900.png`).
- **Difference**: the post-purchase surface is the weakest part of the portal relative to the reference, and the empty ship-to field is a visible data defect.
- **Fix**: bind `addressSnapshot` name into the orders DTO (same defect appears in seller orders and driver drop-off — see DATA matrix), add status/tracker parity.
- **Severity**: P1 · **Confidence**: VERIFIED for rendering; PARTIALLY VERIFIED for tracker (not captured).

---

## 3. Intentional deviations observed (not defects)

1. **COD-only checkout with a ₹50,000 cap**, stated in the auth/marketing copy ("COD-only checkout within the approved order cap"). The prototype also caps COD at ₹50,000 but offers other payment methods as demo affordances. Keeping this is correct while no gateway integration exists.
2. **Trust strip replaces "Secure payments" with "Cash on delivery"** (`app-customer-home-1440x900.png`), which is honest given the above.
3. **"Catalogue data from the marketplace database"** captions replace the prototype's implicit demo data — a disclosure the reference did not need.
4. **Frequently-bought-together is captioned "Sample catalogue data for preview — not live prices or availability"** on the PDP. This is honest labelling of a non-persisted recommendation, not a fidelity defect, though the section itself is still not real.

## 4. Screens and states inspected vs not inspected

Inspected (rendered): home, search, PDP (product 1), cart (guest + authenticated/empty), checkout (guest redirect), orders (guest redirect + authenticated list), `/account` and `/wishlist` (404), header/footer on all above, home + search + PDP at 1440, home + search at 390, home at 1024.

Not inspected (recorded, not claimed): checkout with a filled address, order placement, thanks page, order detail/tracker, review authoring, coupon apply/remove, bulk-pricing recalculation, add-to-cart mutation, dark mode for customer pages beyond token comparison. Each is marked PARTIALLY VERIFIED above rather than assumed.
