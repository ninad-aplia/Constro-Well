# VISUAL_COMPARISON_REPORT.md

Phase 04A — Deliverable 6 of 11. Stage 6 (cross-portal visual verification).

Method: every claim below is based on a **rendered** comparison at identical viewports (1440×900, 1024×768, 390×844) between the prototype loaded from `file://` and the application served at `http://localhost:64704`, plus source verification of the design tokens. Screenshot pairs are indexed in `SCREENSHOT_EVIDENCE_INDEX.md`.

**Confidence:** VERIFIED = observed in both renders; PARTIALLY VERIFIED = observed in one, inferred for the other.

---

## 1. Design system: the tokens are a faithful port

`app/src/app/globals.css:10-26` declares the same custom properties as the prototypes' `:root` (`buildgrid-shop.html:13-14`, and the equivalent blocks in the other three files). Spot-checked against source:

| Token | Prototype | Application | Match |
|---|---|---|---|
| `--bg` | `#EAEDF1` | `#EAEDF1` (`globals.css:10`) | ✅ |
| `--panel` | `#fff` | `#ffffff` (`:11`) | ✅ |
| `--ink` | `#0F1B2D` | `#0F1B2D` (`:13`) | ✅ |
| `--ink2` | `#3B4A60` | `#3B4A60` (`:14`) | ✅ |
| `--muted` | `#5D6B80` | `#5D6B80` (`:15`) | ✅ |
| `--line` | `#D5DBE3` | `#D5DBE3` (`:16`) | ✅ |
| `--nav` | `#0B1F3A` | `#0B1F3A` (`:17`) | ✅ |
| `--nav2` | `#12305A` | `#12305A` (`:18`) | ✅ |
| `--hi` | `#FFC72C` | `#FFC72C` (`:19`) | ✅ |
| `--hi2` | `#F5B800` | `#F5B800` (`:20`) | ✅ |
| `--hi-ink` | `#1F1700` | `#1F1700` (`:21`) | ✅ |
| `--or` | `#FF8A1F` | `#FF8A1F` (`:22`) | ✅ |
| `--deal` | `#C7352B` | `#C7352B` (`:24`) | ✅ |
| `--ok` | `#147A45` | `#147A45` (`:25`) | ✅ |
| `--bad` | `#B42318` | `#B42318` (`:26`) | ✅ |

Dark mode overrides are also ported (`globals.css:35-54`), including the prototype's quirk that `--hi`/`--or`/`--star` are *not* overridden.

**Typography** is ported exactly: `next/font/google` loads `Figtree` (`--font-body`) and `Bricolage_Grotesque` (`--font-disp`) in `src/app/layout.tsx:2-20`, matching the prototypes' `--body`/`--disp` stacks.

**Conclusion (VERIFIED):** *the visual identity, palette and type system are not the cause of the reported mismatch.* The design language is the same in both. This is an important, non-obvious finding — the instinct to "restyle" the product would discard work that is already correct.

---

## 2. Where the shells match and where they don't

### 2.1 Portal shells

| Portal | Prototype shell | Application shell | Verdict |
|---|---|---|---|
| Seller | Navy sidebar 260 px, 7 items + identity card, top bar with search / acceptance toggle / bell / avatar | Reproduced (`SellerSidebar.tsx`, `SellerTopBar.tsx`), same order, same badges, same colours | **MATCH** — the closest shell in the product |
| Delivery | Phone frame inside a demo page, top tab strip | Sidebar at desktop, bottom nav at mobile, no phone frame | **INTENTIONAL DEVIATION** (`DEL-05`) |
| Customer | Two-row header + category strip + deliver-to row; four-column footer | Single-row header, no category strip, no deliver-to, one-line footer | **PARTIAL** — the largest structural divergence in the product (`CUST-01`, `CUST-07`) |
| Admin | Navy sidebar, 8 items, admin identity card | Does not exist (404) | **MISSING** |

### 2.2 Customer header — the single most visible difference

At 390×844 the divergence is stark and is visible above the fold:
- **Prototype** (`viewport/proto-shop-home-390.png`): hamburger, logo, "Account", "Cart" · category select + search + square yellow button · "Bengaluru 560001" deliver-to row · scrollable category strip (`All · Today's deals · Cement · Steel · Sand …`) · **full-bleed** hero.
- **Application** (`viewport/app-customer-home-390.png`): logo, "Sign in", cart · single search row · **inset rounded** hero card · category tiles.

Four separate wayfinding affordances are absent, and the hero changes from full-bleed to a card. This is the most plausible single explanation for "the UI is very different" on the customer side.

### 2.3 Customer home content

Both renders show the same hero headline ("Build bigger. Pay less."), the same sub-copy, the same yellow pill CTA, the same 4-dot carousel indicator, and the same "Shop by category" tile grid with identical artwork. The composition differs in chrome and page width, not in content or style.

---

## 3. Component-level comparison

| Component | Observation | Verdict |
|---|---|---|
| Product card | Same art/price/MRP/% off/stars anatomy; app omits the review count text, "Best seller" tag and delivery-promise line on most cards; **app's Add-to-cart and heart are `disabled`** (`ProductCard.tsx:13,39-49,107-115`) | **PARTIAL + functional defect** |
| Buttons | `Button.tsx` ports the prototype variants (`yellow/orange/line/dark/red`) and both radii (pill for shop, 10 px for portals) | **MATCH** |
| Stat/attention cards | Seller: identical tinted red cards with big numerals and captions | **MATCH** |
| Charts | Seller sales bar chart: same form and axis treatment; labels differ (`Day 1/16/30` vs `12 Oct/27 Oct/10 Nov`) | **PARTIAL (P3)** |
| Tables | Seller products/orders: same column rhythm, row height, hover treatment | **MATCH** |
| Pills/badges | Same palette and shapes; app adds honest-status pills ("Pending — document upload isn't available yet") where the prototype shows demo buttons | **MATCH**, with intentional honest substitutions |
| Dialogs/drawers | Seller add-listing dialog and driver completion drawer follow the prototype's dialog corner radius and form rhythm (verified for the driver drawer; seller dispatch/reject dialogs source-traced only) | **PARTIAL VERIFIED** |
| Footer | Prototype four columns + "Back to top"; app one navy strip with a copyright line and the sentence "the BuildGrid prototypes remain the approved design reference" | **PARTIAL (P3)** |

---

## 4. Branding discrepancy — needs an owner decision

Every prototype is branded **BuildGrid** with a yellow cube logomark. The application is branded **Constro Well** with a "cw" monogram in a rounded yellow square (`app-customer-home-1440x900.png`, `app-seller-overview-1440x900.png`).

- If the rebrand is intentional, this is an approved **INTENTIONAL DEVIATION** and the prototypes' wordmark should be treated as reference-only.
- If the client expects the BuildGrid identity to be preserved verbatim, it is a **P1 visual mismatch** across all portals.

This audit does **not** resolve it: `DECISIONS.md` records the product name as Constro Well, but nothing records a logo/brand decision. Listed as an OPEN QUESTION in the executive assessment.

---

## 5. Density and proportion

| Measure | Prototype | Application | Effect |
|---|---|---|---|
| Customer product grid at 1440 | 5 columns | 4 columns with wider gutters | Lower density; fewer products above the fold |
| Customer home row cards | 220 px fixed, horizontal scroller | 220 px fixed, horizontal scroller | MATCH |
| Seller table row height | ~46 px | ~46 px | MATCH |
| Seller attention cards at 390 | 2×2 grid | 1 per row | ~4× vertical space on mobile (`SELL-04`) |
| Seller page gutter | 28 px | 28 px | MATCH |
| Customer hero at 390 | full-bleed | inset card | Noticeably different silhouette |

---

## 6. Colour application

The one colour defect found is **CUST-09**: product-card "Add to cart" renders at 50 % opacity because the control is `disabled`, not because the token is wrong. On the seller and driver portals the yellow is applied correctly everywhere. So the palette is right and the *state* is wrong — a functional fix, not a styling one.

---

## 7. Summary scoring

Denominator: **26 reference route-level views** (10 customer, 7 seller, 1 driver-with-8-states counted as 1, 8 admin).

| Portal | Views | MATCH | PARTIAL | DIFFERENT | MISSING |
|---|---|---|---|---|---|
| Customer | 10 | 0 | 8 | 0 | 2 |
| Seller | 7 | 3 | 3 | 1 | 0 |
| Delivery | 1 | 0 | 1 | 0 | 0 |
| Admin | 8 | 0 | 0 | 0 | 8 |
| **Total** | **26** | **3** | **12** | **1** | **10** |

**Visual parity rate (strict MATCH): 3/26 = 11.5 %.**
**Visually faithful in structure and styling (MATCH + PARTIAL): 15/26 = 57.7 %.**
**Absent: 10/26 = 38.5 %.**

Both numbers are reported because they answer different questions: strict parity is low, but the *design language* is faithfully implemented wherever a screen exists — the shortfall is missing structure (header rows, footer, account/wishlist, admin) rather than a different aesthetic.

## 8. Limitations

- No pixel-diff overlay was produced; comparisons are visual, side-by-side, by a human reviewer reading the rendered images.
- Dark mode was compared at token level only, not rendered per screen.
- Admin has no render to compare, so its rows are reference-only.
- The customer PDP and order-detail tracker were compared at one product/one order only.
