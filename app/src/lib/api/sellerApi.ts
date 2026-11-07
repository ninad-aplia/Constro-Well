// Authenticated seller inventory client. The session cookie is sent by
// `apiFetch`; never pass a sellerId from the client.
import { apiFetch } from "./client";
import type { SellerProductDto } from "./dto";

export interface CreateSellerProductInput {
  productId: string;
  price: string | number;
  stock?: number;
  minOrderQty?: number;
  reorderLevel?: number;
  leadTimeDays?: number;
  status?: "active" | "paused";
}

export interface UpdateSellerProductInput {
  price?: string | number;
  stock?: number;
  minOrderQty?: number;
  reorderLevel?: number;
  leadTimeDays?: number;
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
