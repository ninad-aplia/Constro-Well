// Shared seller-collected COD finance DTOs (mirrors FastAPI `schemas/finance.py`,
// camelCase on the wire). Money is exact decimal strings — never `number`.

export type CollectionStatus = "pending" | "confirmed" | "disputed" | "cancelled";
export type RemittanceStatus = "initiated" | "received" | "allocated" | "failed" | "returned";
export type AdjustmentType = "customer_refund" | "adjustment" | "commission_credit" | "reversal";
export type AdjustmentStatus = "open" | "applied";

export interface CodCollectionDto {
  id: string;
  shipmentId: string;
  sellerId: string;
  storeName?: string | null;
  expectedAmount: string;
  collectedAmount: string | null;
  collectedBy: string | null;
  status: CollectionStatus;
  evidenceRef: string | null;
  note: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

export interface CommissionAssessmentDto {
  id: string;
  sellerId: string;
  storeName?: string | null;
  shipmentId: string;
  basis: string;
  basisAmount: string;
  rate: string;
  commissionAmount: string;
  status: string;
  assessedAt: string;
  createdAt: string;
}

export interface RemittanceDto {
  id: string;
  sellerId: string;
  storeName?: string | null;
  amount: string;
  method: string;
  reference: string;
  status: RemittanceStatus;
  initiatedAt: string;
  receivedAt: string | null;
  createdAt: string;
}

export interface RemittanceAllocationDto {
  id: string;
  remittanceId: string;
  assessmentId: string;
  amount: string;
  kind: "allocation" | "reversal";
  reversesId: string | null;
  createdAt: string;
}

export interface AssessmentRunResultDto {
  policyId: string;
  basis: string;
  rate: string;
  attempted: number;
  created: number;
  skipped: number;
  failed: { shipmentId: string; code: string }[];
}

export interface SellerAdjustmentDto {
  id: string;
  sellerId: string;
  storeName?: string | null;
  shipmentId: string | null;
  orderId: string | null;
  type: AdjustmentType;
  amount: string;
  reason: string;
  evidenceRef: string | null;
  status: AdjustmentStatus;
  reversesId: string | null;
  appliedAt: string | null;
  createdAt: string;
}

export interface SellerStatementDto {
  sellerId: string;
  generatedAt: string;
  collections: {
    expectedCod: string;
    confirmedCod: string;
    pendingCount: number;
    confirmedCount: number;
    disputedCount: number;
    discrepancyCount: number;
    discrepancyAmount: string;
  };
  commission: {
    assessed: string;
    remitted: string;
    outstanding: string;
    creditApplied: string;
    creditBalance: string;
  };
  remittances: { received: string; unallocated: string; initiated: string };
  adjustments: { net: string; commissionCredits: string };
  legacyEscrow: {
    held: string;
    commission: string;
    penalty: string;
    refund: string;
    released: string;
    withdrawn: string;
  };
}
