# RESPONSIVE_AND_ACCESSIBILITY_AUDIT.md

Phase 04A — Deliverable 9 of 11. Stage 6 (responsive + accessibility verification).

**Method and limitation, stated up front:** this is a **rendered inspection at three viewports plus a source audit**. No automated accessibility engine (axe/Lighthouse) was run, and no screen-reader session was performed. Contrast values below are **computed** from the token hex values using the WCAG 2.1 relative-luminance formula, not measured from pixels. Anything that would require a real device (touch target feel, iOS safe areas, screen-reader announcement order) is marked **UNVERIFIED**.

---

## 1. Responsive behaviour, portal by portal

### 1.1 Customer

| Viewport | Observation | Verdict |
|---|---|---|
| 1440×900 | Two-row-capable header renders as one row; 4-column product grid; footer one line (`app-customer-home-1440x900.png`) | Layout is clean, but the reference's structure is absent (`CUST-01`) |
| 1024×768 | Header collapses correctly; grid reflows; no overflow (`app-customer-home-1024x768.png`) | Passes |
| 390×844 | Logo + "Sign in" + cart; search row; **inset** hero; 2-column category tiles (`viewport/app-customer-home-390.png`) | Passes functionally; differs from the prototype's full-bleed hero, hamburger, account label and category strip |

Breakpoint mismatch: the prototype switches at **1100 px / 900 px / 640 px**; the application uses Tailwind defaults (**640 / 768 / 1024 / 1280**). Grid and header transitions therefore occur at different widths, which is why a 1024 px screenshot of the two never lines up exactly.

### 1.2 Seller

| Viewport | Observation | Verdict |
|---|---|---|
| 1440×900 | Sidebar 260 px, two-column card grid, table with all columns | Passes |
| 1024×768 | Sidebar persists, cards reflow, tables stay readable (`app-seller-overview-1024x768.png`) | Passes |
| 390×844 | Bottom nav replaces sidebar; header compresses; **attention cards stack one per row**; acceptance toggle disappears (`app-seller-overview-390x844.png`) | **Fails density parity** (`SELL-04`) |
| 390×844 | Bottom-left identity card sits **under** the fixed bottom nav (`SELL-03`, `DEL-06`) | **Fails** |

Note: the earlier mobile seller captures in `capture-manifest-mobile.json` resolved to `/login?next=/seller` because that run was not authenticated. They were **replaced** during this phase with authenticated captures; the manifest entry is stale and should be read as superseded.

### 1.3 Delivery

| Viewport | Observation | Verdict |
|---|---|---|
| 1440×900 | Sidebar portal, drawer overlays at ~480 px | Passes |
| 390×844 | Bottom nav; cards full-width; drawer becomes near-full-screen (`app-delivery-complete-dialog-390x844.png`) | Passes; no horizontal scroll observed |
| 390×844 | Identity card clipped by bottom nav | Fails (shared component) |

### 1.4 Admin

Not applicable — no implementation.

### 1.5 Horizontal overflow

No horizontal scrollbar was observed on any inspected screen at 390 px. Long tables (seller orders) collapse to a card layout rather than forcing a scroll, which is better than the prototype.

---

## 2. Touch targets

| Control | Approx. size | Guidance | Verdict |
|---|---|---|---|
| Bottom-nav items | 56 px tall | ≥ 44 px | Pass |
| Primary buttons | 40 px (`min-h-10`) | ≥ 44 px recommended | Borderline |
| Small buttons (`size="sm"`) | 32 px (`min-h-8`) | ≥ 44 px | **Fails** — table Edit/Remove/Open buttons are 32 px at mobile |
| Stepper ± buttons | ~32 px | ≥ 44 px | **Fails** |
| OTP boxes | ~44 px | Pass | Pass |

The 32 px controls are acceptable on desktop with a mouse and are a genuine thumb-target problem on the seller order table and product stepper.

---

## 3. Colour contrast (computed from tokens)

| Pair | Ratio | AA normal text (4.5) | Note |
|---|---|---|---|
| `--ink` #0F1B2D on `--panel` #fff | **17.3 : 1** | Pass | |
| `--muted` #5D6B80 on `--panel` #fff | **5.4 : 1** | Pass | |
| `--muted` #5D6B80 on `--bg` #EAEDF1 | **4.6 : 1** | Pass (marginal) | Any darkening of the background would fail |
| `--deal` #C7352B on #fff | **5.3 : 1** | Pass | |
| `--hi-ink` #1F1700 on `--hi` #FFC72C | **11.4 : 1** | Pass | The primary CTA pair is strong |
| **Disabled card "Add to cart"** (50 % opacity composite) | **≈ 3.2 : 1** | **Fails** | Confirms the visual read: the button looks disabled because it is, and the disabled state is below AA |

White on `--nav` #0B1F3A is ≈ 15 : 1 (pass). No low-contrast text was found outside the disabled CTA.

---

## 4. Keyboard and semantics

Positives (VERIFIED by source):

- A **skip link** to `#app` is present (`app/src/app/layout.tsx:37`), with `.skip` styles in `globals.css`.
- A global **`:focus-visible`** ring (3 px `--hi`, 2 px offset) is defined (`globals.css:100-104`).
- Portal layouts expose `<main id="app" tabIndex={-1}>` (`PortalChrome.tsx:21,30`; `seller/layout.tsx:45`; `delivery/layout.tsx:34`).
- Dialogs use the **native `<dialog>`** element with `showModal()` and an `aria-label` from the title (`Dialog.tsx:3,35-38`), so focus trapping and Escape come from the platform rather than a custom implementation — a genuinely better choice than the prototype's hand-rolled modals.
- **110 `aria-*` attributes** across `src/components` and `src/app`.
- Form errors use `role="alert"`; cart totals and coupon results use `role="status"`/`aria-live="polite"` (`CartView.tsx:268,309,334`).
- `prefers-reduced-motion` globally disables transitions/animations (`globals.css:106-112`), matching the prototype.

Gaps:

| Gap | Evidence | Severity |
|---|---|---|
| Product-card hearts and "Add to cart" are `disabled`; the heart exposes only a `title` explanation and is out of the tab order | `ProductCard.tsx:39-49,107-115`; the source comment argues this is the honest choice | P2 (a11y-correct, product-wrong) |
| Notification bell is an interactive-looking button with no panel and no `aria-expanded` | `SellerTopBar.tsx` | P3 |
| Tables use header `<span>`s in a grid rather than `<th scope>` (`OrdersView.tsx:169`) | source | P2 for screen readers |
| No `aria-current` on the seller sidebar's active item (the prototype has it) | `SellerSidebar.tsx` | P3 |
| Drawer for delivery completion is a `Dialog` with `aria-label` but no `aria-describedby` linking the OTP instructions | `Dialog.tsx` | P3 |
| Charts have no text alternative or data table | `SalesChart.tsx` | P2 |
| Status is conveyed by colour + text in most places (pass), but the red attention cards rely on colour for urgency | `seller/page.tsx` | P3 |

---

## 5. Reduced motion and dark mode

- **Reduced motion**: implemented globally and in the prototype's JS equivalents (autoplay disabled). PASS.
- **Dark mode**: token overrides exist and match the prototype (`globals.css:35-54`). However, no dark-mode screenshot was captured this phase, and several components apply literal colours (`bg-white/[0.11]`, `text-white`) in the sidebar rather than tokens. Dark mode is therefore **PARTIALLY VERIFIED** — the tokens are right, per-screen results are unverified.

---

## 6. Findings summary

| ID | Finding | Severity |
|---|---|---|
| A11Y-01 | 32 px touch targets on mobile tables and steppers | P2 |
| A11Y-02 | Disabled card CTA composite contrast ≈ 3.2 : 1 (fails AA) | P2 |
| A11Y-03 | Data tables built from spans, no `<th scope>` | P2 |
| A11Y-04 | Charts lack text alternatives | P2 |
| A11Y-05 | Bell has no expanded state / panel | P3 |
| A11Y-06 | No `aria-current` on sidebar nav | P3 |
| A11Y-07 | Dark mode unverified per screen | P3 |

The accessibility baseline is **better than the prototypes** (skip link, native dialogs, live regions, reduced motion, consistent focus ring), so remediation should extend this foundation rather than start again.
