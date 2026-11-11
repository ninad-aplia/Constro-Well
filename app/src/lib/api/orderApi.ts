import { apiFetch } from "./client";
import type { CheckoutPreviewDto, OrderDto } from "./orderDto";

export async function previewCheckout(
  addressId: string,
  baseUrl = "",
): Promise<CheckoutPreviewDto> {
  const response = await apiFetch<{ preview: CheckoutPreviewDto }>(
    "/api/checkout/preview",
    { method: "POST", body: JSON.stringify({ addressId }) },
    baseUrl,
  );
  return response.preview;
}

export async function placeOrder(
  addressId: string,
  idempotencyKey: string,
  baseUrl = "",
): Promise<OrderDto> {
  const response = await apiFetch<{ order: OrderDto }>(
    "/api/orders",
    {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: JSON.stringify({ addressId, paymentMethod: "COD" }),
    },
    baseUrl,
  );
  return response.order;
}

export async function fetchOrders(baseUrl = ""): Promise<OrderDto[]> {
  const response = await apiFetch<{ orders: OrderDto[] }>("/api/orders", {}, baseUrl);
  return response.orders;
}

export async function fetchOrder(id: string, baseUrl = ""): Promise<OrderDto> {
  const response = await apiFetch<{ order: OrderDto }>(
    `/api/orders/${encodeURIComponent(id)}`,
    {},
    baseUrl,
  );
  return response.order;
}

export async function cancelOrder(id: string, reason: string, baseUrl = ""): Promise<OrderDto> {
  const response = await apiFetch<{ order: OrderDto }>(
    `/api/orders/${encodeURIComponent(id)}/cancel`,
    { method: "POST", body: JSON.stringify({ reason }) },
    baseUrl,
  );
  return response.order;
}

export async function confirmShipmentDelivery(
  id: string,
  shipmentId: string,
  baseUrl = "",
): Promise<OrderDto> {
  const response = await apiFetch<{ order: OrderDto }>(
    `/api/orders/${encodeURIComponent(id)}/shipments/${encodeURIComponent(shipmentId)}/confirm`,
    { method: "POST" },
    baseUrl,
  );
  return response.order;
}

export async function reportShipmentIssue(
  id: string,
  shipmentId: string,
  note: string,
  baseUrl = "",
): Promise<OrderDto> {
  const response = await apiFetch<{ order: OrderDto }>(
    `/api/orders/${encodeURIComponent(id)}/shipments/${encodeURIComponent(shipmentId)}/report-issue`,
    { method: "POST", body: JSON.stringify({ type: "damaged_goods", note }) },
    baseUrl,
  );
  return response.order;
}
