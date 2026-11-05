# TASKS.md — Constro Well implementation backlog

Statuses: `NOT STARTED / IN PROGRESS / BLOCKED / DONE`.
Never mark DONE without a verifying check recorded in `HANDOFF.md`.
Priority: P0 = must ship, P1 = should ship, P2 = defer if time runs out.

## Phase 0 — Foundation (owns: all docs)
| Task | Pri | Status | Depends | Acceptance criteria |
|---|---|---|---|---|
| 0.1 Inspect 3 prototypes, screen/workflow/entity audit | P0 | DONE | – | `docs/PROTOTYPE_AUDIT.md` written from actual file contents |
| 0.2 Architecture proposal + stack rationale + directory layout | P0 | DONE | 0.1 | `docs/ARCHITECTURE_PROPOSAL.md` with rationale + dir tree |
| 0.3 Six root handoff docs created and populated from real audit | P0 | DONE | 0.1 | AGENTS/PROJECT_CONTEXT/TASKS/HANDOFF/DECISIONS/README exist and match reality |
| 0.4 Get user approval on open decisions D1–D6 (branding, payment, auth scope, shipping, stack, deployment) | P0 | DONE | 0.2 | User answers recorded in `DECISIONS.md` with status APPROVED/REJECTED — **2026-11-05: D1,D2,D3,D4,D6,D7,D8,D9,D10,D11,D12 APPROVED; D5 still open** |
| 0.5 Repo: git init + initial commit (prototypes preserved) | P0 | DONE | 0.3 | `git log` shows checkpoint commit containing prototypes unchanged |

## Phase 1 — Frontend foundation (Next.js)
| Task | Pri | Status | Depends | Acceptance criteria |
|---|---|---|---|---|
| 1.1 Scaffold Next.js TS app, Tailwind/CSS tokens from prototype palette, fonts, shared app shell + placeholder storefront | P0 | DONE | 0.4 | App boots; tokens match prototype palette; lint+build pass (`eslint src` exit 0; `next build` exit 0, static prerender `/` verified). README quickstart accurate. UI primitives land in 1.3 |
| 1.2 Design tokens + dark-mode variant identical to prototypes | P1 | DONE | 1.1 | palette variables in CSS match both light + dark prototypes — **verified 2026-11-05: served CSS contains light tokens (`eaedf1 ffc72c 0b1f3a 147a45`), dark (`081120`), warn light `945400` + dark `f0b74a`, star `f5a623`, `color-scheme: light/dark` blocks, `prefers-reduced-motion` rules; `next build` prerender OK**. Status chips also needed a warn token (`.pill.warn` in prototype) |
| 1.3 Extract reusable components (product card, product art placeholders/rating stars, stepper, pills, data tables) | P0 | DONE | 1.1 | components render with prototype markup parity — **DONE 2026-11-05: Card, Button (yellow/orange/line/dark/red/ghost, sm/wide/pill), Pill (ok/warn/bad/info/neutral), Stars (prototype's exact CSS-mask SVG gradient, `--p` fill variable), Stepper (`.stp` port; min/max from caller — business rules), Dialog (native `<dialog>`, `cancel`+Escape handled, prototype backdrop), Toast (prototype port: ink bg, hi action, 3.2 s) in `app/src/components/ui/`; tokens reused, zero new deps, no business logic; `PrimitiveShowcase` QA section on placeholder home verified served (HTTP 200). `eslint src` exit 0; `next build` exit 0 (TypeScript clean, `/` static prerender). Deviations: Button radius `pill` prop selects shop 20px shape vs portals' 10px (both prototypes); toast max-width + `aria-live` added for small screens/a11y; data tables + product card deferred to Phase 4/5 pages that use them** |

## Phase 2 — Database + backend foundation
| Task | Pri | Status | Depends | Acceptance criteria |
|---|---|---|---|---|
| 2.1 Prisma schema for entities in PROJECT_CONTEXT §7 + initial migration | P0 | NOT STARTED | 0.4 | `npm run db:migrate` applies cleanly on blank DB |
| 2.2 Seed script (categories, sample sellers, products, demo users incl. seller demo account) | P0 | NOT STARTED | 2.1 | seed runs idempotently |
| 2.3 API skeleton: `/api/v1` conventions, error shape, role middleware (customer/seller/driver/admin), ownership scoping | P0 | NOT STARTED | 2.1 | unauthenticated/non-owner request returns 401/403 per convention |
| 2.4 Integration test proving auth-required route rejects anon/seller-impersonator | P0 | NOT STARTED | 2.3 | test runs green via `npm run test` |

## Phase 3 — Auth + permissions
| Task | Pri | Status | Depends | Acceptance criteria |
|---|---|---|---|---|
| 3.1 Register/login/logout, bcrypt hashing, session cookie, no plaintext storage | P0 | NOT STARTED | 2.3 | login sets cookie; wrong login 401; password columns hash-only |
| 3.2 Role-based route protection on backend for all four roles | P0 | NOT STARTED | 3.1 | customers cannot call seller/driver/admin endpoints (test) |
| 3.3 Guest cart + merge into account on login (prototype behavior) | P1 | NOT STARTED | 3.1 | guest cart items survive sign-in |
| 3.4 Demo login shortcut parity with prototypes | P2 | NOT STARTED | 3.1 | optional |

## Phase 4 — Catalogue, inventory, cart
| Task | Pri | Status | Depends | Acceptance criteria |
|---|---|---|---|---|
| 4.1 Home: hero carousel, category tiles, deals, best sellers, recently viewed | P0 | IN PROGRESS | 1.3, (2.2 waived per D14) | parity with shop prototype sections, data from API — **mock-data-first approved (D14, ACCEPTED 2026-11-06); category tiles done 2026-11-06 via `lib/api/catalog.ts` facade + `components/home/CategoryTiles.tsx`, verified against prototype `.tile`/`.mini4` section; hero carousel/deals/best sellers/recently viewed remain; real checkout/order processing still blocked on 2.1/2.2 per D14 condition 5** |
| 4.2 Search: query, category, brand, price, rating, fast/deal filters, sort, pagination | P0 | NOT STARTED | 4.1 | all filters + sorts run server-side |
| 4.3 Product detail: gallery tabs, seller offers (real sellers now), bulk pricing tiers, FBT, specifications, reviews + helpful votes + review form | P0 | NOT STARTED | 4.2 | bulk price math matches prototype rules, computed server-side |
| 4.4 Cart: qty stepper, save-for-later, coupon engine (BUILD10/FIRST250/FREESHIP rules), free-delivery meter, GST display | P0 | NOT STARTED | 4.3 | coupon rules + thresholds match prototype `calc()` exactly (server-side) |
| 4.5 Wishlist + addresses CRUD + account page | P1 | NOT STARTED | 4.4 | parity with shop prototype |

## Phase 5 — Checkout + orders
| Task | Pri | Status | Depends | Acceptance criteria |
|---|---|---|---|---|
| 5.1 Checkout: address selection/new, payment method selection (per D3/D4 scope), review, order summary | P0 | NOT STARTED | 4.4 | order type "Buy now" one-click flow also works |
| 5.2 Order creation server-side: stock decrement inside transaction, price recalculated server-side, order-split-per-seller into shipments | P0 | NOT STARTED | 5.1 | concurrent double-submit can't oversell (test) |
| 5.3 Customer order pages: list, detail, tracker stages, reorder, cancel-before-dispatch with stock restore | P0 | NOT STARTED | 5.2 | cancel path restores stock (test), matches prototype rules |
| 5.4 Payment integration per approved decision (or COD-only fallback documented) | P0 | BLOCKED on D3/D4 | 5.2 | no fake-success endpoints; real pay flow or explicit COD |

## Phase 6 — Seller portal
| Task | Pri | Status | Depends | Acceptance criteria |
|---|---|---|---|---|
| 6.1 Seller auth + hub shell (nav, sidebar/tabs, mobile bottom bar), overview with KPIs, sparkline/bar chart | P0 | NOT STARTED | 3.2, 2.2 | seller sees only own data |
| 6.2 Orders board: accept/reject within deadline timers, stock check on accept, pack, dispatch dialog (vehicle, driver, slot, mandatory documents validation incl. e-way ≥ ₹50k, weighbridge for bulk) | P0 | NOT STARTED | 5.2 | deadline + document validations server-side |
| 6.3 Products CRUD + stock steppers + auto-pause at 0 + low-stock tab + min order/MRP/price validation | P0 | NOT STARTED | 6.1 | validation matches prototype rules server-side |
| 6.4 Delivery setup: pincodes, free/fee rules, slots capacity, vehicles+drivers | P1 | NOT STARTED | 6.2 | buyer ETA uses seller coverage correctly |
| 6.5 Payments tab: balance (avail/pending/frozen), settled table, CSV statement download, withdraw flow | P1 | NOT STARTED | 6.2 | numbers derive from payout ledger, not mock |
| 6.6 Performance tab (score math + tier + reviews) + settings (store, KYC checklist, alert prefs) + notifications | P1 | NOT STARTED | 6.2 | score formula = 30/40/30 of real stats |

## Phase 7 — Delivery workflow
| Task | Pri | Status | Depends | Acceptance criteria |
|---|---|---|---|---|
| 7.1 Shipment state machine + deadline timers (accept 4h, dispatch 24h, review 24h) + events log, server-side | P0 | NOT STARTED | 5.2 | states + side-branches match `docs/PROTOTYPE_AUDIT.md` §4 (test) |
| 7.2 Driver mobile view: assignment list, OTP (3 tries → failed), photo proof flag, delivered quantity, unavailable marking | P0 | NOT STARTED | 7.1 | short-quantity auto-dispute opens (test) |
| 7.3 Customer tracking view: OTP display only at dispatched, review window confirm/report freezing payouts | P0 | NOT STARTED | 7.2 | report freezes vendor payout in ledger |
| 7.4 Admin exception console (stopgap UI): disputes resolve (partial/full/reject), reassign rejected/timeout to another vendor, late nudges, failed attempts; escrow KPIs; vendor scorecards; activity log | P0 | NOT STARTED | 7.1 | follows delivery prototype's Admin-tab design at D13 fidelity for now; when owner delivers `buildgrid-platform-admin.html` (after 3 portals), re-verify fidelity against it and record deviations; actions write payout ledger + events; admin-only endpoints |
| 7.5 Payout release job/endpoint after review window: commission 5%, late penalty 2%, refunds respected | P0 | NOT STARTED | 7.1 | math matches prototype `payFor()` (test) |

## Phase 8 — Integration, hardening, docs
| Task | Pri | Status | Depends | Acceptance criteria |
|---|---|---|---|---|
| 8.1 E2E smoke: register → login → add to cart → coupon → COD checkout → seller accept/dispatch → driver deliver → review window → payout | P0 | NOT STARTED | all P0 above | script runs green end-to-end |
| 8.2 Security pass: IDOR on seller/driver/admin routes, price tampering via API, mass assignment, secrets scan | P0 | NOT STARTED | 8.1 | findings fixed or logged in HANDOFF |
| 8.3 `.env.example` + README setup verified by clean run + deployment doc | P0 | NOT STARTED | 8.1 | fresh clone setup works from README alone |
| 8.4 Prototype files marked superseded / demo banner status recorded | P2 | NOT STARTED | 8.1 | recorded in DECISIONS, originals still intact |
| 8.5 Performance/accessibility basics: focus management, keyboard nav from prototype, reduced-motion support | P1 | NOT STARTED | 8.1 | prototype a11y behaviors preserved |
| 8.6 Prototype fidelity verification pass (D13): page-by-page comparison of every implemented view vs its prototype (hierarchy, spacing, typography, colors, proportions); desktop + mobile responsiveness; every intentional deviation recorded | P0 | NOT STARTED | all UI tasks | fidelity report reviewed, deviations documented in DECISIONS/task notes; prototypes still byte-identical |
