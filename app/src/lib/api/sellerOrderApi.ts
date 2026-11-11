import { apiFetch } from "./client";
import type { SellerOrdersResponse, SellerShipmentDto } from "./sellerOrderDto";

export async function fetchSellerOrders(baseUrl = ""): Promise<SellerOrdersResponse> {
  return apiFetch<SellerOrdersResponse>("/api/seller/orders", {}, baseUrl);
}

export async function fetchSellerShipment(
  shipmentId: string,
  baseUrl = "",
): Promise<SellerShipmentDto> {
  const response = await apiFetch<{ order: SellerShipmentDto }>(
    `/api/seller/orders/${encodeURIComponent(shipmentId)}`,
    {},
    baseUrl,
  );
  return response.order;
}

export async function acceptSellerShipment(
  shipmentId: string,
  baseUrl = "",
): Promise<SellerShipmentDto> {
  const response = await apiFetch<{ order: SellerShipmentDto }>(
    `/api/seller/orders/${encodeURIComponent(shipmentId)}/accept`,
    { method: "POST" },
    baseUrl,
  );
  return response.order;
}

export async function packSellerShipment(
  shipmentId: string,
  baseUrl = "",
): Promise<SellerShipmentDto> {
  const response = await apiFetch<{ order: SellerShipmentDto }>(
    `/api/seller/orders/${encodeURIComponent(shipmentId)}/pack`,
    { method: "POST" },
    baseUrl,
  );
  return response.order;
}

export async function rejectSellerShipment(
  shipmentId: string,
  reason: string,
  baseUrl = "",
): Promise<SellerShipmentDto> {
  const response = await apiFetch<{ order: SellerShipmentDto }>(
    `/api/seller/orders/${encodeURIComponent(shipmentId)}/reject`,
    { method: "POST", body: JSON.stringify({ reason }) },
    baseUrl,
  );
  return response.order;
}

export interface SellerDispatchInput {
  vehicleId: string;
  slot: string;
  challan: boolean;
  invoice: boolean;
  eway?: string;
  weighbridge?: string;
}

export async function dispatchSellerShipment(
  shipmentId: string,
  input: SellerDispatchInput,
  baseUrl = "",
): Promise<SellerShipmentDto> {
  const response = await apiFetch<{ order: SellerShipmentDto }>(
    `/api/seller/orders/${encodeURIComponent(shipmentId)}/dispatch`,
    { method: "POST", body: JSON.stringify(input) },
    baseUrl,
  );
  return response.order;
}

/** Reassigns a failed delivery attempt to a (possibly different) vehicle/driver and retries. */
export async function redispatchSellerShipment(
  shipmentId: string,
  input: SellerDispatchInput,
  baseUrl = "",
): Promise<SellerShipmentDto> {
  const response = await apiFetch<{ order: SellerShipmentDto }>(
    `/api/seller/orders/${encodeURIComponent(shipmentId)}/redispatch`,
    { method: "POST", body: JSON.stringify(input) },
    baseUrl,
  );
  return response.order;
}

/** Gives up on a failed delivery attempt: restores stock, cancels the COD expectation. */
export async function markSellerShipmentMissed(
  shipmentId: string,
  reason: string,
  baseUrl = "",
): Promise<SellerShipmentDto> {
  const response = await apiFetch<{ order: SellerShipmentDto }>(
    `/api/seller/orders/${encodeURIComponent(shipmentId)}/missed`,
    { method: "POST", body: JSON.stringify({ reason }) },
    baseUrl,
  );
  return response.order;
}
