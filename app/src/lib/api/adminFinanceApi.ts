// Admin finance client — hits the Next.js BFF (`/api/admin/finance/*`) which
// forwards to the FastAPI finance domain. Every write is audited server-side.
import { apiFetch } from "./client";
import type {
  AssessmentRunResultDto,
  CodCollectionDto,
  CommissionAssessmentDto,
  RemittanceAllocationDto,
  RemittanceDto,
  SellerAdjustmentDto,
  SellerStatementDto,
} from "./financeDto";

export async function fetchAdminCollections(baseUrl = ""): Promise<CodCollectionDto[]> {
  const response = await apiFetch<{ collections: CodCollectionDto[] }>(
    "/api/admin/finance/collections",
    {},
    baseUrl,
  );
  return response.collections;
}

export async function fetchAdminDiscrepancies(baseUrl = ""): Promise<CodCollectionDto[]> {
  const response = await apiFetch<{ collections: CodCollectionDto[] }>(
    "/api/admin/finance/collections/discrepancies",
    {},
    baseUrl,
  );
  return response.collections;
}

export async function disputeCollection(
  collectionId: string,
  note?: string,
  baseUrl = "",
): Promise<CodCollectionDto> {
  return apiFetch<CodCollectionDto>(
    `/api/admin/finance/collections/${encodeURIComponent(collectionId)}/dispute`,
    { method: "POST", body: JSON.stringify({ note }) },
    baseUrl,
  );
}

export async function fetchAdminRemittances(baseUrl = ""): Promise<RemittanceDto[]> {
  const response = await apiFetch<{ remittances: RemittanceDto[] }>(
    "/api/admin/finance/remittances",
    {},
    baseUrl,
  );
  return response.remittances;
}

export async function verifyRemittance(remittanceId: string, baseUrl = ""): Promise<RemittanceDto> {
  return apiFetch<RemittanceDto>(
    `/api/admin/finance/remittances/${encodeURIComponent(remittanceId)}/verify`,
    { method: "POST" },
    baseUrl,
  );
}

export async function failRemittance(
  remittanceId: string,
  note?: string,
  baseUrl = "",
): Promise<RemittanceDto> {
  return apiFetch<RemittanceDto>(
    `/api/admin/finance/remittances/${encodeURIComponent(remittanceId)}/fail`,
    { method: "POST", body: JSON.stringify({ note }) },
    baseUrl,
  );
}

export async function returnRemittance(
  remittanceId: string,
  note?: string,
  baseUrl = "",
): Promise<RemittanceDto> {
  return apiFetch<RemittanceDto>(
    `/api/admin/finance/remittances/${encodeURIComponent(remittanceId)}/return`,
    { method: "POST", body: JSON.stringify({ note }) },
    baseUrl,
  );
}

export async function allocateRemittance(
  remittanceId: string,
  assessmentId: string,
  amount: string,
  baseUrl = "",
): Promise<RemittanceAllocationDto> {
  return apiFetch<RemittanceAllocationDto>(
    `/api/admin/finance/remittances/${encodeURIComponent(remittanceId)}/allocations`,
    { method: "POST", body: JSON.stringify({ assessmentId, amount }) },
    baseUrl,
  );
}

export async function fetchRemittanceAllocations(
  remittanceId: string,
  baseUrl = "",
): Promise<RemittanceAllocationDto[]> {
  return apiFetch<RemittanceAllocationDto[]>(
    `/api/admin/finance/remittances/${encodeURIComponent(remittanceId)}/allocations`,
    {},
    baseUrl,
  );
}

export async function reverseAllocation(
  allocationId: string,
  baseUrl = "",
): Promise<RemittanceAllocationDto> {
  return apiFetch<RemittanceAllocationDto>(
    `/api/admin/finance/allocations/${encodeURIComponent(allocationId)}/reverse`,
    { method: "POST" },
    baseUrl,
  );
}

export async function fetchAdminAssessments(baseUrl = ""): Promise<CommissionAssessmentDto[]> {
  const response = await apiFetch<{ assessments: CommissionAssessmentDto[] }>(
    "/api/admin/finance/assessments",
    {},
    baseUrl,
  );
  return response.assessments;
}

export async function assessCommission(shipmentId: string, baseUrl = ""): Promise<CommissionAssessmentDto> {
  return apiFetch<CommissionAssessmentDto>(
    `/api/admin/finance/assessments/${encodeURIComponent(shipmentId)}`,
    { method: "POST" },
    baseUrl,
  );
}

// Bulk assessment of every confirmed collection that has none. Idempotent and
// fail-closed server-side: returns 409 `policy_not_configured` instead of
// guessing a rate, and a repeat run creates nothing.
export async function runCommissionAssessments(
  limit = 200,
  baseUrl = "",
): Promise<AssessmentRunResultDto> {
  return apiFetch<AssessmentRunResultDto>(
    "/api/admin/finance/assessments/run",
    { method: "POST", body: JSON.stringify({ limit }) },
    baseUrl,
  );
}

export async function waiveAssessment(assessmentId: string, baseUrl = ""): Promise<CommissionAssessmentDto> {
  return apiFetch<CommissionAssessmentDto>(
    `/api/admin/finance/assessments/${encodeURIComponent(assessmentId)}/waive`,
    { method: "POST" },
    baseUrl,
  );
}

export async function createPolicy(
  basis: string,
  rate: string,
  baseUrl = "",
): Promise<{ id: string; basis: string; rate: string; isActive: boolean }> {
  return apiFetch(
    "/api/admin/finance/policies",
    { method: "POST", body: JSON.stringify({ basis, rate }) },
    baseUrl,
  );
}

export async function fetchAdminAdjustments(baseUrl = ""): Promise<SellerAdjustmentDto[]> {
  const response = await apiFetch<{ adjustments: SellerAdjustmentDto[] }>(
    "/api/admin/finance/adjustments",
    {},
    baseUrl,
  );
  return response.adjustments;
}

export async function applyAdjustment(adjustmentId: string, baseUrl = ""): Promise<SellerAdjustmentDto> {
  return apiFetch<SellerAdjustmentDto>(
    `/api/admin/finance/adjustments/${encodeURIComponent(adjustmentId)}/apply`,
    { method: "POST" },
    baseUrl,
  );
}

export async function reverseAdjustment(
  adjustmentId: string,
  reason: string,
  baseUrl = "",
): Promise<SellerAdjustmentDto> {
  return apiFetch<SellerAdjustmentDto>(
    `/api/admin/finance/adjustments/${encodeURIComponent(adjustmentId)}/reverse`,
    { method: "POST", body: JSON.stringify({ reason }) },
    baseUrl,
  );
}

export async function fetchAdminSellerStatement(
  sellerId: string,
  baseUrl = "",
): Promise<SellerStatementDto> {
  return apiFetch<SellerStatementDto>(
    `/api/admin/finance/sellers/${encodeURIComponent(sellerId)}/statement`,
    {},
    baseUrl,
  );
}
