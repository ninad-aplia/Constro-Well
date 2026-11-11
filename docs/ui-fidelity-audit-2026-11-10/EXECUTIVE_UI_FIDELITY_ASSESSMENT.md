# EXECUTIVE_UI_FIDELITY_ASSESSMENT.md

Phase 04A — Deliverable 1 of 11, written last, summarising Deliverables 2–11.
Repository `Constro-Well`, branch `feature/backend-mvp`, HEAD `1f0f61f` (unchanged through Phases 01–03B and this phase).
Strictly read-only: no application source, test, manifest, schema, migration, CI or deployment file was modified.

---

## 1. The finding that changes the conversation

The company reported that "the current UI is very different from the product they requested". That is **true of the product as a whole and false of its design system**.

- Every design token is a byte-for-byte port: `--bg #EAEDF1`, `--nav #0B1F3A`, `--hi #FFC72C`, `--deal #C7352B` and the rest match the prototypes exactly (`app/src/app/globals.css:10-26` vs `buildgrid-shop.html:13-14`), and both fonts (Figtree, Bricolage Grotesque) are loaded (`layout.tsx:2-20`).
- Three of the seven seller screens are **visually indistinguishable** from their prototype at 1440×900 apart from brand name and data values.
- What is missing is **structure and surface**: the customer's two-row header, category strip, deliver-to row and four-column footer; the account and wishlist destinations; the entire admin portal; and a working Add-to-cart on the product cards.

So the correct response is **not** to restyle the product. Restyling would destroy work that is already right. The correct response is to **restore the missing structure and finish the dead controls**, which is a smaller, more predictable body of work than a redesign — and it is what this roadmap scopes.

---

## 2. Inventory and coverage

| Measure | Count | Basis |
|---|---|---|
| Reference screens/views identified | **26** | 10 customer (shop), 7 seller, 1 driver experience (8 internal states), 8 admin |
| Reference interactions catalogued | **77 scored** | `FUNCTIONAL_INTERACTION_MATRIX.md` §5 (excludes demo-only affordances and app-only additions) |
| Application screens/states inspected (rendered) | **22** | 8 customer, 8 seller (7 routes + add-listing dialog), 5 delivery (4 routes + completion drawer), 1 admin (404) |
| Viewport combinations captured | 1440×900, 1024×768, 390×844 | 119 evidence files |
| Screens inspected only in source (not rendered) | 6 | dispatch dialog, reject dialog, vehicle dialog, order drawer, checkout with address, order tracker detail |

Not inspected, and not claimed: any write path that would mutate the shared local database (order placement, OTP confirmation, dispatch transition), dark mode per screen, screen-reader output, and live device touch behaviour.

---

## 3. Classification per portal

Denominator is reference route-level views (§2).

| Portal | Views | MATCH | PARTIAL | DIFFERENT | MISSING | BROKEN |
|---|---|---|---|---|---|---|
| Customer | 10 | 0 | 8 | 0 | 2 | 0 |
| Seller | 7 | 3 | 3 | 1 | 0 | 0 |
| Delivery | 1 | 0 | 1 | 0 | 0 | 0 |
| Admin | 8 | 0 | 0 | 0 | 8 | 0 |
| **Total** | **26** | **3** | **12** | **1** | **10** | **0** |

Severity of the 30 gap-register findings (accessibility findings counted separately in §7):

| Portal | P0 | P1 | P2 | P3 | Total |
|---|---|---|---|---|---|
| Customer | 0 | 6 | 2 | 2 | 10 |
| Seller | 0 | 2 | 6 | 2 | 10 |
| Delivery | 0 | 3 | 3 | 0 | 6 |
| Admin | 2 | 2 | 0 | 0 | 4 |
| **Total** | **2** | **13** | **11** | **4** | **30** |

---

## 4. Percentages, with their definitions

These are the numbers the brief asks for. Each has an explicit denominator so it can be challenged.

1. **Visual fidelity rate — 11.5 %** (3 of 26 reference views are a strict MATCH).
2. **Structurally faithful rate — 57.7 %** (15 of 26 are MATCH or PARTIAL: same design language, same information architecture, with deviations).
3. **Portal-level fidelity**: seller **43 % strict / 86 % structural**; customer **0 % strict / 80 % structural**; delivery **0 % strict / 100 % structural (one view)**; admin **0 %**.
4. **Primary workflow parity — 0 % full parity, 67 % partial.** Denominator: 9 end-to-end workflows (customer browse-to-cart, checkout, tracking, account/reviews, seller product management, seller fulfilment, seller payments, driver delivery, admin governance). Result: 0 MATCH, 6 PARTIAL, 3 MISSING (account, admin, and reviews-within-account). **No primary workflow yet matches its reference end-to-end**, because each is missing at least one interaction — even the seller's, which is otherwise strong, has blank buyer names and no payout.
5. **Interaction-level parity — 54.5 %** (42 of 77 scored interactions work end-to-end).

Reading these together: roughly half the interactions work, most screens look right, but no workflow is complete. That is the precise shape of the client's complaint.

---

## 5. The largest reasons for the reported mismatch, ranked

1. **The admin portal does not exist** (`/admin` → 404). An eighth of the reference surface, and the half of three workflows (onboarding, payouts, disputes) that the seller and driver portals explicitly point at. Evidence: `ADMIN_PORTAL_GAP_REGISTER.md`.
2. **The customer header lost four of its five wayfinding layers** — no category strip, no category select, no deliver-to, no account menu — at every breakpoint. This is the first thing a reviewer sees. Evidence: `CUST-01`, `VISUAL_COMPARISON_REPORT.md` §2.2.
3. **"Add to cart" is disabled on every product card** while the identical PDP button works (`ProductCard.tsx:107-115`). The storefront reads as non-functional at the moment of first intent. Evidence: `CUST-09`.
4. **Account and wishlist are 404** while their affordances are still drawn (hearts, "Account"), so the product looks unfinished rather than scoped. Evidence: `CUST-03/04`.
5. **The Payments screen was rebuilt as a raw ledger** and shows a **negative** available balance, which undermines trust in the financial surfaces more than any visual delta. Evidence: `SELL-02`.

Honourable mentions: blank buyer/ship-to names across all three portals (a seed-data defect that reads as a bug — `SELL-01`/`DEL-01`/`CUST-10`), and the mobile seller layout collapsing to one column (`SELL-04`).

---

## 6. Two findings that should change the client conversation

**The seller portal is close to done and should be presented as such.** Six of seven screens are recognisably the same design; product, order, delivery-rule and profile operations are real, persisted and ownership-scoped. Claiming the whole portal needs rebuilding would be inaccurate and would waste the strongest asset in the product.

**The product is unusually honest, and that honesty is being read as incompleteness.** Preview banners, disabled controls, "upload isn't available yet", "no real GPS tracking" — every one is a truthful disclosure the prototypes did not have. Some reviewers will read these as unfinished. The fix is to *finish* the features behind the disclosures (this roadmap), not to remove the disclosures.

---

## 7. Accessibility (separate from fidelity)

Seven findings (`RESPONSIVE_AND_ACCESSIBILITY_AUDIT.md`): 4 × P2, 3 × P3. The baseline is **better than the prototypes** — skip link, native `<dialog>` with platform focus trapping, `role="alert"`/`role="status"` live regions, global `:focus-visible` ring, global `prefers-reduced-motion`. The real defects are 32 px touch targets on mobile, missing table semantics (`<th scope>`), chart text alternatives, and a disabled-CTA composite contrast of ≈ 3.2 : 1.

---

## 8. Effort

**Estimate: 48–70 developer-days** for one senior full-stack developer familiar with the codebase, excluding the FastAPI migration and excluding multi-round QA.

| Band | Days |
|---|---|
| P0 (4 packages) | 6–9 |
| P1 (7 packages) | 24–34 |
| P2 (9 packages) | 15–22 |
| P3 (6 packages) | 3–5 |

**Uncertainty**: dominated by WP-UI-11 (admin persistence: schema design plus migrations) and WP-UI-09 (file storage). Excluding those two, the estimate is **33–47 days** with much lower variance. The estimate assumes design tokens and components are reused as-is — if the client instead wants a visual redesign, this estimate does not apply and the work must be re-scoped from zero.

---

## 9. Migration independence

Because the FastAPI migration preserves the HTTP contract, UI work that consumes existing endpoints survives the migration unchanged.

- **Can proceed now, independently of FastAPI**: WP-UI-01, 02, 03, 04, 06, 07, 08, 12, 13, 14, 15, 20, and all P3 polish. This is the majority of the roadmap.
- **Requires backend/API additions in the current stack**: WP-UI-05 (account CRUD), WP-UI-16 (notifications), WP-UI-17 (guest cart).
- **Should be designed once, in the target backend**: WP-UI-09 (file storage) and **all of WP-UI-11** (payout batches, disputes, platform settings, audit log, KYC documents). Building these twice would be waste; they are the natural first domain for the FastAPI service and the cleanest proof that the migration delivers something visible.

---

## 10. Is the application suitable for company acceptance today?

**No.**

Not because the design is wrong — the design system is right — but because:

- one of four portals is absent entirely;
- no primary workflow completes end-to-end;
- the highest-traffic control in the storefront does not work;
- two customer destinations return 404;
- the payments surface shows a negative payable.

## 11. Verdict: GO / NO-GO for beginning UI remediation

**GO — begin remediation**, with three conditions:

1. **Resolve the four owner decisions in §12 first** (brand, guest cart, wishlist, admin scope). Each changes what "done" means for a work package.
2. **Do not restyle.** Treat the tokens, typography and existing seller shell as approved assets; the audit shows they match the references. Any redesign request should be treated as a new scope, not a fix.
3. **Ship in the recommended order** (WP-UI-03 → 01 → 02 → 04 → 14), because the first four convert the largest visible gaps for the least risk, and each is independently verifiable.

**This is not yet a GO for company acceptance.** After P0 and the customer-side P1 work (WP-UI-01…07), the product would be presentable as a marketplace with a strong seller and driver portal and a complete customer journey, with admin explicitly deferred. That is a defensible delivery position; today's build is not.

---

## 12. Decisions requiring owner input

1. **Brand**: BuildGrid wordmark/cube (prototypes) vs Constro Well (application) — intentional rebrand, or a fidelity defect?
2. **Guest cart**: implement anonymous carts, or formally approve the sign-in gate as an intentional deviation?
3. **Wishlist**: implement it, or remove the heart affordances?
4. **Admin scope and timing**: build phases A+B now, or defer the whole portal until the FastAPI service exists and build it there?
5. **Payments presentation**: keep the detailed escrow ledger as the primary view, or restore the prototype's settled-orders table with the ledger secondary? (This audit recommends the latter plus a labelled empty state while settlement is unimplemented.)
6. **Driver portal framing**: accept the routed responsive portal as an intentional deviation from the prototype's phone mock?
7. **File storage**: required for proof-of-delivery photos and KYC uploads — which service, and in which backend?

## 13. Confidence and limitations

- **VERIFIED**: all token/font parity, all route existence/absence, all rendered layout observations, the disabled card CTA, the blank names and their seed root cause, the negative payments balance, `requireAdmin` being uncalled, and the admin 404.
- **PARTIALLY VERIFIED**: every write path not executed (order placement, OTP confirmation, dispatch); the mobile seller screens were re-captured authenticated this phase, superseding the earlier signed-out captures.
- **UNVERIFIED**: dark mode per screen, screen-reader behaviour, real touch feel, client-side performance.
- One stale artefact was found and corrected: `capture-manifest-mobile.json` records the earlier seller mobile run landing on `/login?next=/seller`; those images were replaced with authenticated captures during this phase and the manifest entry is now superseded.
