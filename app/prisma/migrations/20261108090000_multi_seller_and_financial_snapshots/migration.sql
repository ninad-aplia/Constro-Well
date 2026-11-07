-- Multi-seller catalogue + financial/OTP snapshots.
--
-- Data-preserving order:
--   1. add new scalar columns (all nullable or defaulted)
--   2. create SellerOffer
--   3. backfill one SellerOffer per existing Product using its current seller
--   4. backfill OrderLine.sellerOfferId and CartItem.sellerOfferId
--   5. enforce CartItem.sellerOfferId NOT NULL (fails loudly if a legacy cart
--      row references a synthetic offer index that has no DB row)
--   6. only then drop the old Product/CartItem columns
--
-- Every Product currently carries exactly one seller, so the backfill yields
-- the same seller/product pair the new seed uses. The offer code is built from
-- Seller.code + ':' + Product.code, matching prisma/seed.ts, so `db:seed`
-- remains idempotent after this migration.

-- 1. Additive scalar changes -------------------------------------------------

ALTER TABLE "Address"
  ADD COLUMN "name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "phone" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "state" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Coupon"
  ADD COLUMN "discountAmount" DECIMAL(14,2),
  ADD COLUMN "firstOrderOnly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maxDiscount" DECIMAL(14,2),
  ADD COLUMN "minSubtotal" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "Order"
  ADD COLUMN "couponCode" TEXT,
  ADD COLUMN "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxRate" DECIMAL(7,6) NOT NULL DEFAULT 0.18;

ALTER TABLE "OrderLine" ADD COLUMN "sellerOfferId" TEXT;

ALTER TABLE "Shipment" ADD COLUMN "otpEncrypted" TEXT;

CREATE INDEX "Address_userId_isDefault_idx" ON "Address"("userId", "isDefault");

-- 2. SellerOffer table ------------------------------------------------------

CREATE TABLE "SellerOffer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minOrderQty" INTEGER NOT NULL DEFAULT 1,
    "status" "ProductStatus" NOT NULL DEFAULT 'active',
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "soldCount" INTEGER NOT NULL DEFAULT 0,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 1,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "rating" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerOffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerOffer_code_key" ON "SellerOffer"("code");
CREATE INDEX "SellerOffer_productId_status_idx" ON "SellerOffer"("productId", "status");
CREATE INDEX "SellerOffer_sellerId_status_idx" ON "SellerOffer"("sellerId", "status");
CREATE UNIQUE INDEX "SellerOffer_sellerId_productId_key" ON "SellerOffer"("sellerId", "productId");

ALTER TABLE "SellerOffer" ADD CONSTRAINT "SellerOffer_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerOffer" ADD CONSTRAINT "SellerOffer_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Backfill one seller listing per existing catalogue product --------------

INSERT INTO "SellerOffer" (
  "id", "code", "productId", "sellerId", "price", "stock", "minOrderQty",
  "status", "reorderLevel", "soldCount", "leadTimeDays", "verified", "rating",
  "createdAt", "updatedAt"
)
SELECT
  'so_' || p."id",
  s."code" || ':' || p."code",
  p."id",
  p."sellerId",
  p."price",
  p."stock",
  p."minOrderQty",
  p."status",
  p."reorderLevel",
  p."soldCount",
  1,
  true,
  NULL,
  p."createdAt",
  p."updatedAt"
FROM "Product" p
JOIN "Seller" s ON s."id" = p."sellerId";

-- 4. Point historical lines and carts at the resolved offer ------------------

UPDATE "OrderLine" ol
SET "sellerOfferId" = so."id"
FROM "SellerOffer" so
WHERE so."productId" = ol."productId"
  AND so."sellerId" = ol."sellerId";

ALTER TABLE "CartItem" ADD COLUMN "sellerOfferId" TEXT;

-- Offer index 0 is the real seller listing; higher indices were frontend-only
-- synthetic offers and have no database row. If any such cart row exists the
-- NOT NULL below aborts the transaction instead of deleting customer data.
UPDATE "CartItem" ci
SET "sellerOfferId" = so."id"
FROM "Product" p
JOIN "SellerOffer" so
  ON so."productId" = p."id" AND so."sellerId" = p."sellerId"
WHERE ci."productId" = p."id"
  AND ci."offerIndex" = 0;

ALTER TABLE "CartItem" ALTER COLUMN "sellerOfferId" SET NOT NULL;

-- 5. Drop superseded Product seller columns ---------------------------------

ALTER TABLE "Product" DROP CONSTRAINT "Product_sellerId_fkey";
DROP INDEX "Product_categoryId_status_idx";
DROP INDEX "Product_sellerId_idx";

ALTER TABLE "Product"
  DROP COLUMN "minOrderQty",
  DROP COLUMN "price",
  DROP COLUMN "reorderLevel",
  DROP COLUMN "sellerId",
  DROP COLUMN "soldCount",
  DROP COLUMN "status",
  DROP COLUMN "stock",
  ADD COLUMN "brand" TEXT;

CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- 6. Drop superseded CartItem columns ---------------------------------------

ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_productId_fkey";
DROP INDEX "CartItem_cartId_productId_offerIndex_key";

ALTER TABLE "CartItem"
  DROP COLUMN "offerIndex",
  DROP COLUMN "productId";

CREATE INDEX "CartItem_sellerOfferId_idx" ON "CartItem"("sellerOfferId");
CREATE UNIQUE INDEX "CartItem_cartId_sellerOfferId_key" ON "CartItem"("cartId", "sellerOfferId");

ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_sellerOfferId_fkey"
  FOREIGN KEY ("sellerOfferId") REFERENCES "SellerOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. OrderLine offer reference ---------------------------------------------

CREATE INDEX "OrderLine_sellerOfferId_idx" ON "OrderLine"("sellerOfferId");

ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_sellerOfferId_fkey"
  FOREIGN KEY ("sellerOfferId") REFERENCES "SellerOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
