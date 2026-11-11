-- Per-offer bulk pricing (B8). Additive column only: existing offers keep the
-- marketplace default tiers via the empty-array default.
ALTER TABLE "SellerOffer" ADD COLUMN "bulkTiers" JSONB NOT NULL DEFAULT '[]';
