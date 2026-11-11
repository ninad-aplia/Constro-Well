-- CreateEnum
CREATE TYPE "FinanceModel" AS ENUM ('escrow', 'seller_collected');

-- CreateEnum
CREATE TYPE "CodCollectionStatus" AS ENUM ('pending', 'confirmed', 'disputed', 'cancelled');

-- CreateEnum
CREATE TYPE "CodCollector" AS ENUM ('seller', 'agent');

-- CreateEnum
CREATE TYPE "CommissionBasis" AS ENUM ('order_value', 'collected_cod');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('assessed', 'partially_remitted', 'remitted', 'waived');

-- CreateEnum
CREATE TYPE "RemittanceStatus" AS ENUM ('initiated', 'received', 'allocated', 'failed', 'returned');

-- CreateEnum
CREATE TYPE "RemittanceAllocationKind" AS ENUM ('allocation', 'reversal');

-- CreateEnum
CREATE TYPE "SellerAdjustmentType" AS ENUM ('customer_refund', 'adjustment', 'reversal');

-- CreateEnum
CREATE TYPE "SellerAdjustmentStatus" AS ENUM ('open', 'applied');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "financeModel" "FinanceModel" NOT NULL DEFAULT 'escrow';

-- CreateTable
CREATE TABLE "CodCollection" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "expectedAmount" DECIMAL(14,2) NOT NULL,
    "collectedAmount" DECIMAL(14,2),
    "collectedBy" "CodCollector",
    "collectorUserId" TEXT,
    "status" "CodCollectionStatus" NOT NULL DEFAULT 'pending',
    "evidenceRef" TEXT,
    "note" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionAssessment" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "basis" "CommissionBasis" NOT NULL DEFAULT 'order_value',
    "basisAmount" DECIMAL(14,2) NOT NULL,
    "rate" DECIMAL(7,6) NOT NULL,
    "commissionAmount" DECIMAL(14,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'assessed',
    "assessedByUserId" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Remittance" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "RemittanceStatus" NOT NULL DEFAULT 'initiated',
    "initiatedByUserId" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Remittance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemittanceAllocation" (
    "id" TEXT NOT NULL,
    "remittanceId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "kind" "RemittanceAllocationKind" NOT NULL DEFAULT 'allocation',
    "reversesId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemittanceAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerAdjustment" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "orderId" TEXT,
    "type" "SellerAdjustmentType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceRef" TEXT,
    "status" "SellerAdjustmentStatus" NOT NULL DEFAULT 'open',
    "createdByUserId" TEXT,
    "appliedByUserId" TEXT,
    "appliedAt" TIMESTAMP(3),
    "reversesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPolicy" (
    "id" TEXT NOT NULL,
    "basis" "CommissionBasis" NOT NULL DEFAULT 'order_value',
    "rate" DECIMAL(7,6) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CodCollection_shipmentId_key" ON "CodCollection"("shipmentId");

-- CreateIndex
CREATE INDEX "CodCollection_sellerId_status_idx" ON "CodCollection"("sellerId", "status");

-- CreateIndex
CREATE INDEX "CodCollection_sellerId_createdAt_idx" ON "CodCollection"("sellerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionAssessment_shipmentId_key" ON "CommissionAssessment"("shipmentId");

-- CreateIndex
CREATE INDEX "CommissionAssessment_sellerId_status_idx" ON "CommissionAssessment"("sellerId", "status");

-- CreateIndex
CREATE INDEX "CommissionAssessment_sellerId_createdAt_idx" ON "CommissionAssessment"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "Remittance_sellerId_status_idx" ON "Remittance"("sellerId", "status");

-- CreateIndex
CREATE INDEX "Remittance_sellerId_createdAt_idx" ON "Remittance"("sellerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Remittance_sellerId_reference_key" ON "Remittance"("sellerId", "reference");

-- CreateIndex
CREATE INDEX "RemittanceAllocation_remittanceId_idx" ON "RemittanceAllocation"("remittanceId");

-- CreateIndex
CREATE INDEX "RemittanceAllocation_assessmentId_idx" ON "RemittanceAllocation"("assessmentId");

-- CreateIndex
CREATE INDEX "RemittanceAllocation_reversesId_idx" ON "RemittanceAllocation"("reversesId");

-- CreateIndex
CREATE INDEX "SellerAdjustment_sellerId_status_idx" ON "SellerAdjustment"("sellerId", "status");

-- CreateIndex
CREATE INDEX "SellerAdjustment_sellerId_createdAt_idx" ON "SellerAdjustment"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "CommissionPolicy_isActive_effectiveFrom_idx" ON "CommissionPolicy"("isActive", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "CodCollection" ADD CONSTRAINT "CodCollection_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodCollection" ADD CONSTRAINT "CodCollection_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAssessment" ADD CONSTRAINT "CommissionAssessment_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAssessment" ADD CONSTRAINT "CommissionAssessment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remittance" ADD CONSTRAINT "Remittance_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceAllocation" ADD CONSTRAINT "RemittanceAllocation_remittanceId_fkey" FOREIGN KEY ("remittanceId") REFERENCES "Remittance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceAllocation" ADD CONSTRAINT "RemittanceAllocation_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "CommissionAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerAdjustment" ADD CONSTRAINT "SellerAdjustment_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerAdjustment" ADD CONSTRAINT "SellerAdjustment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerAdjustment" ADD CONSTRAINT "SellerAdjustment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique index: at most one open (non-reversed) allocation per
-- (remittance, assessment). Reversal rows (kind='reversal') are unaffected, so
-- a compensating record can always target the same pair. This is extra SQL in
-- the migration, intentionally invisible to Prisma (same pattern as the
-- AuditEvent append-only triggers).
CREATE UNIQUE INDEX "RemittanceAllocation_one_open_per_pair"
    ON "RemittanceAllocation"("remittanceId", "assessmentId")
    WHERE kind = 'allocation';
