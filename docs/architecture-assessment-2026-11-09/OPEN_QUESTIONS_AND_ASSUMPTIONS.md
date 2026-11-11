# OPEN_QUESTIONS_AND_ASSUMPTIONS.md

Principal Architect discovery phase — Deliverable 8 of 8. These are the unresolved business questions, technical unknowns, and decisions that genuinely require developer/business input before implementation begins — not decisions this audit should or could make unilaterally.

---

## 0. The foundational question: does this engagement supersede `DECISIONS.md`?

Every other open question in this document is downstream of one meta-question that has not been asked or answered anywhere: **`DECISIONS.md` contains 25 numbered, mostly-APPROVED architecture/product decisions (D1–D25), made by the product owner across 2026-11-05 through 2026-11-09. This new engagement's brief (re-evaluating the backend framework, asking about GCP, naming four "principal user experiences" including a from-scratch admin portal) implicitly touches at least D2 (stack), D7 (admin scope), and D10 (deployment) — but does not say whether it is amending those specific rows, or operating under a new mandate that supersedes the whole document.** Until this is answered, every recommendation in Deliverables 5–7 is conditional, not final. **This needs an explicit answer before Deliverable 7's P0 work package WP-P0-3 (and, by extension, the Backend Architecture Decision's recommendation) can be actually started**, not just documented.

---

## 1. Backend/infrastructure decisions

1. **Is "the company primarily uses Python/FastAPI" a hard, durable organizational standard, or a preference to be weighed against the real migration cost documented in Deliverable 5?** This single answer determines whether Deliverable 5's "Option C, narrowly scoped" recommendation is the right call, or whether a full migration is actually mandated regardless of cost — those are different projects with different timelines, and this audit cannot infer which is intended from the brief's own wording ("leading candidate... not yet approved").
2. **Which deployment target is authoritative: the approved D10 (Docker), the actually-deployed Render.com, or the newly-asked-about GCP?** (Deliverable 2 §0, Deliverable 6 §8). Needs one decision, recorded as a new `DECISIONS.md` row, before any further deployment-specific tooling work.
3. **Is there an actual production database today**, and if so, on what host/provider? This read-only audit deliberately did not read `.env` contents or attempt to determine this (per its own secrets-handling constraints) — it is recorded here as a genuine unknown, not as "no" or "yes."
4. **Is a future mobile app a concrete, scheduled plan, or a hypothetical architectural consideration?** This changes how urgently the OpenAPI-contract/token-auth work (Target Architecture §3) should be prioritized relative to everything else.

## 2. Product/business decisions

5. **D5 (SMS channel for delivery OTP) remains explicitly OPEN** — who is expected to supply SMS provider credentials, and on what timeline? Carried forward unchanged from the existing decision log, re-confirmed still open by this audit.
6. **OTP expiry policy has never been logged as its own numbered decision** (distinct from D5, which is specifically about the SMS channel) — the schema's own header comment ties it loosely to D5, but expiry is a separate question (how long should a generated OTP remain valid regardless of delivery channel?) that needs its own explicit answer, since release of escrowed payouts currently depends on OTP integrity with no time-bound.
7. **D8's e-way-bill/weighbridge thresholds are "pending legal confirmation"** — still unresolved; this audit found no evidence it has been revisited since 2026-11-05.
8. **Is COD-only (D3/D4) still the intended business model**, or does the broader modernization conversation (FastAPI, GCP, admin portal) imply an eventual online-payment-gateway requirement? If the latter, a real `Payment`/`Settlement` model should be designed deliberately now rather than retrofitted later — but building it speculatively before this is confirmed would violate this audit's own "do not invent requirements" instruction.
9. **What is the intended KYC-document review process** — manual admin approval, an automated verification service, or something else? Needed before WP-P1-1 (file uploads) can finish its KYC half with a real "Verified" transition rather than a placeholder.
10. **What is the intended first scope of the admin portal** — the full 8-section reference (Deliverable 3 §4), or the minimal dispute-resolution + overview slice proposed as WP-P1-4? The reference's own "second check"/"trusted checker" two-person payout-approval pattern in particular is a real business-process question (does this platform actually need dual-control on large payouts at current scale?), not something to assume either way.
11. **Is the one-seller-per-user ownership model (D11/D19: `Seller.ownerUserId` unique, one login per seller)** still correct going forward, or will a seller eventually need multiple staff logins against one seller account? Affects the auth/authorization design materially if it changes.
12. **Notification channel and compliance**: if email notifications are built (WP-P2-6), is there a preferred provider, and are there any data-residency/compliance considerations (this is an Indian marketplace handling customer PII and order data) that should constrain where that data is processed or stored? Not addressed anywhere in the existing decision log, and out of this audit's scope to resolve unilaterally.

## 3. Documentation/process observations needing a decision, not just a fix

13. **`HANDOFF.md`'s "next action" section and two `docs/*READINESS*.md` reports are materially stale** (Deliverable 2 §0) — should these be actively corrected and kept current going forward (recommended), or retired in favor of a different handoff mechanism now that this audit exists as a point-in-time reference? Either is defensible; leaving them stale-but-present, as today, is the one option actively harmful to future work.
14. **`buildgrid-platform-admin.html` is untracked in git**, unlike the other three prototype files (which D9 requires to stay byte-identical and presumably tracked). Is this deliberate (the owner delivered it out-of-band and it was never meant to be committed) or an oversight that should be corrected with a normal `git add`? A small, low-risk item, but worth a deliberate answer rather than leaving it ambiguous.

## 4. Assumptions this audit made, stated explicitly so they can be checked

- Assumed the git `HEAD` at the time of inspection (`1f0f61f`, 2026-11-08) is the correct, current baseline to audit, since the working tree was clean relative to it (Deliverable 2 §0). If a different branch or a not-yet-pushed local state was intended as "current," this audit's findings should be re-verified against that state.
- Assumed the three reference HTML files read in full (shop, seller-dashboard, delivery-workflow) are still the authoritative UX reference, consistent with D13 — not superseded by any newer, unreviewed design input this audit wasn't shown.
- Assumed "no need to compare" the admin portal (per explicit instruction) means skip the *gap-register comparison*, not skip reading the reference for structural context — Deliverable 3 §4 therefore still describes it, but does not score it against an implementation that doesn't exist.
- Assumed that where a prior project document (e.g. `ARCHITECTURE_PROPOSAL.md`, `PROTOTYPE_AUDIT.md`) and the live source code disagree, the live source code is ground truth — consistent with this audit's own operating instructions, and already called out explicitly wherever it mattered (Deliverable 2 §0).
- Did not assume any test "passes" anywhere in this report — all testing-infrastructure claims in Deliverable 2 §5 are about what exists in source, verified by static reading, not by execution (this audit ran no tests, builds, or scripts, per its own read-only constraint).
