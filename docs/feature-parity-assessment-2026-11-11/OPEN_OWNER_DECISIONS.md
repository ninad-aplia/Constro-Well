# Open Owner Decisions

Only genuine business/product/schema/external-integration decisions that cannot
be responsibly inferred. Everything else is engineering execution.

## Confirmed (authoritative, 2026-11-11)

- COD is collected by the **seller** directly.
- An assigned delivery **driver may collect cash as the seller's agent**.
- **Constro-Well does not collect or custody COD proceeds.**

## Outstanding

1. **Commission rules (P0).** Commission rate and calculation basis (order value,
   collected COD, or net); whether commission is assessed at order placement or at
   collection confirmation.

2. **Remittance (P0).** Frequency/deadline, permitted methods, and the receipt
   evidence required before a remittance is treated as platform cash.

3. **Refund & adjustment policy (P1).** Which party may issue customer refunds and
   adjustments, under what evidence, and how they reduce the commission basis.

4. **Penalty policy (P2).** Late-remittance or non-compliance penalties, if any.

5. **Collection-confirmation evidence (P1).** What evidence a seller/agent must
   provide to confirm COD collection.

6. **KYC/document scope (P0).** Approve a Prisma schema addition for KYC documents
   + review decisions (unchanged from before).

7. **File storage provider (P1).** Object storage target for KYC and proof-of-
   delivery evidence.

8. **Online payments (P1).** Whether non-COD payment methods are in the next
   product scope (they would require a gateway and a separate custody model).

9. **Guest cart (P1).** Implement anonymous carts with sign-in merge, or accept
   the sign-in-gated cart as intentional.

10. **Wishlist & reviews (P2).** Ship them, or remove the affordances.

11. **Notifications channels (P1).** Email/SMS/in-app scope and provider.

12. **Brand/logo (P2, carried).** BuildGrid wordmark vs "Constro Well".

13. **Deployment target (P2, carried).** Host/region and backup strategy.

All other prior decisions (D1–D23 in `DECISIONS.md`) remain authoritative and are
not reopened here.
