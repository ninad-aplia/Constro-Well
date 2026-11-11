-- WP-1B finance hardening: make "reverse once" a database invariant.
--
-- The service already rejects a second reversal (`SELECT ... FOR UPDATE` on the
-- original row plus a lookup of an existing reversal), but two concurrent
-- requests could both pass that check and insert two compensating rows. These
-- partial unique indexes close that race without constraining normal rows.
--
-- Partial indexes are used because only reversal rows carry `reversesId`;
-- allocation/adjustment rows must stay unaffected.

CREATE UNIQUE INDEX IF NOT EXISTS "RemittanceAllocation_reversal_once"
  ON "RemittanceAllocation" ("reversesId")
  WHERE "kind" = 'reversal' AND "reversesId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "SellerAdjustment_reversal_once"
  ON "SellerAdjustment" ("reversesId")
  WHERE "type" = 'reversal' AND "reversesId" IS NOT NULL;
