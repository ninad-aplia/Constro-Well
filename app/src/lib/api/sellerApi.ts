// Authenticated seller inventory client. The session cookie is sent by
// `apiFetch`; never pass a sellerId from the client.
import { apiFetch } from "./client";
import type { SellerProductDto } from "./dto";
import type {
  SellerDeliverySettingsDto,
  SellerPaymentsDto,
  SellerPerformanceDto,
  SellerProfileDto,
} from "./sellerOrderDto";

export interface CreateSellerProductInput {
  productId: string;
  price: string | number;
  stock?: number;
  minOrderQty?: number;
  reorderLevel?: number;
  leadTimeDays?: number;
  bulkTiers?: [number, number][];
  status?: "active" | "paused";
}

export interface UpdateSellerProductInput {
  price?: string | number;
  stock?: number;
  minOrderQty?: number;
  reorderLevel?: number;
  leadTimeDays?: number;
  bulkTiers?: [number, number][];
  status?: "active" | "paused";
}

export async function fetchSellerProducts(baseUrl = ""): Promise<SellerProductDto[]> {
  const response = await apiFetch<{ products: SellerProductDto[] }>(
    "/api/seller/products",
    {},
    baseUrl,
  );
  return response.products;
}

export async function createSellerProduct(
  input: CreateSellerProductInput,
  baseUrl = "",
): Promise<SellerProductDto> {
  const response = await apiFetch<{ product: SellerProductDto }>(
    "/api/seller/products",
    { method: "POST", body: JSON.stringify(input) },
    baseUrl,
  );
  return response.product;
}

export async function updateSellerProduct(
  offerId: string,
  input: UpdateSellerProductInput,
  baseUrl = "",
): Promise<SellerProductDto> {
  const response = await apiFetch<{ product: SellerProductDto }>(
    `/api/seller/products/${encodeURIComponent(offerId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
    baseUrl,
  );
  return response.product;
}

export async function updateSellerStock(
  offerId: string,
  stock: number,
  baseUrl = "",
): Promise<SellerProductDto> {
  const response = await apiFetch<{ product: SellerProductDto }>(
    `/api/seller/products/${encodeURIComponent(offerId)}/stock`,
    { method: "PATCH", body: JSON.stringify({ stock }) },
    baseUrl,
  );
  return response.product;
}

export interface UpdateSellerProfileInput {
  storeName?: string;
  gstin?: string;
  phone?: string;
  pickupAddress?: string;
  vacationMode?: boolean;
}

export async function fetchSellerProfile(baseUrl = ""): Promise<SellerProfileDto> {
  const response = await apiFetch<{ profile: SellerProfileDto }>("/api/seller/settings", {}, baseUrl);
  return response.profile;
}

export async function updateSellerProfile(
  input: UpdateSellerProfileInput,
  baseUrl = "",
): Promise<SellerProfileDto> {
  const response = await apiFetch<{ profile: SellerProfileDto }>(
    "/api/seller/settings",
    { method: "PATCH", body: JSON.stringify(input) },
    baseUrl,
  );
  return response.profile;
}

export async function fetchSellerDelivery(baseUrl = ""): Promise<SellerDeliverySettingsDto> {
  return apiFetch<SellerDeliverySettingsDto>("/api/seller/delivery", {}, baseUrl);
}

export async function updateSellerDeliveryRules(
  input: { freeAbove: string | number; fee: string | number; slotsPerDay: number[] },
  baseUrl = "",
): Promise<SellerDeliverySettingsDto> {
  return apiFetch<SellerDeliverySettingsDto>(
    "/api/seller/delivery",
    { method: "PATCH", body: JSON.stringify(input) },
    baseUrl,
  );
}

export async function addSellerServiceArea(
  pin: string,
  baseUrl = "",
): Promise<SellerDeliverySettingsDto> {
  return apiFetch<SellerDeliverySettingsDto>(
    "/api/seller/delivery/service-areas",
    { method: "POST", body: JSON.stringify({ pin }) },
    baseUrl,
  );
}

export async function removeSellerServiceArea(
  pin: string,
  baseUrl = "",
): Promise<SellerDeliverySettingsDto> {
  return apiFetch<SellerDeliverySettingsDto>(
    "/api/seller/delivery/service-areas",
    { method: "DELETE", body: JSON.stringify({ pin }) },
    baseUrl,
  );
}

export async function fetchSellerPayments(baseUrl = ""): Promise<SellerPaymentsDto> {
  return apiFetch<SellerPaymentsDto>("/api/seller/payments", {}, baseUrl);
}

export async function fetchSellerPerformance(baseUrl = ""): Promise<SellerPerformanceDto> {
  return apiFetch<SellerPerformanceDto>("/api/seller/performance", {}, baseUrl);
}
