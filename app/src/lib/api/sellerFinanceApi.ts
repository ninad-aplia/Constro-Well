// Seller finance client — hits the Next.js BFF (`/api/seller/finance/*`) which
// forwards to the FastAPI finance domain. The session cookie is sent by
// `apiFetch`; never pass a sellerId from the client.
import { apiFetch } from "./client";
import type {
  CodCollectionDto,
  RemittanceDto,
  SellerAdjustmentDto,
  SellerStatementDto,
} from "./financeDto";

export async function fetchSellerStatement(baseUrl = ""): Promise<SellerStatementDto> {
  return apiFetch<SellerStatementDto>("/api/seller/finance/statement", {}, baseUrl);
}

export async function fetchSellerCollections(baseUrl = ""): Promise<CodCollectionDto[]> {
  const response = await apiFetch<{ collections: CodCollectionDto[] }>(
    "/api/seller/finance/collections",
    {},
    baseUrl,
  );
  return response.collections;
}

export async function confirmSellerCollection(
  shipmentId: string,
  input: { collectedAmount: string; evidenceRef?: string; note?: string },
  baseUrl = "",
): Promise<CodCollectionDto> {
  return apiFetch<CodCollectionDto>(
    `/api/seller/finance/collections/${encodeURIComponent(shipmentId)}/confirm`,
    { method: "POST", body: JSON.stringify(input) },
    baseUrl,
  );
}

export async function fetchSellerRemittances(baseUrl = ""): Promise<RemittanceDto[]> {
  const response = await apiFetch<{ remittances: RemittanceDto[] }>(
    "/api/seller/finance/remittances",
    {},
    baseUrl,
  );
  return response.remittances;
}

export async function initiateSellerRemittance(
  input: { amount: string; method: string; reference: string; note?: string },
  baseUrl = "",
): Promise<RemittanceDto> {
  return apiFetch<RemittanceDto>("/api/seller/finance/remittances", {
    method: "POST",
    body: JSON.stringify(input),
  }, baseUrl);
}

export async function fetchSellerAdjustments(baseUrl = ""): Promise<SellerAdjustmentDto[]> {
  const response = await apiFetch<{ adjustments: SellerAdjustmentDto[] }>(
    "/api/seller/finance/adjustments",
    {},
    baseUrl,
  );
  return response.adjustments;
}

export async function createSellerAdjustment(
  input: {
    type: "customer_refund";
    amount: string;
    reason: string;
    evidenceRef?: string;
    shipmentId?: string;
  },
  baseUrl = "",
): Promise<SellerAdjustmentDto> {
  return apiFetch<SellerAdjustmentDto>("/api/seller/finance/adjustments", {
    method: "POST",
    body: JSON.stringify(input),
  }, baseUrl);
}
