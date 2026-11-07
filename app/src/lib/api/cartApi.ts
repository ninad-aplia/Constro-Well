import { apiFetch } from "./client";
import type { CartDto } from "./cartDto";

export async function fetchCart(baseUrl = ""): Promise<CartDto> {
  const response = await apiFetch<{ cart: CartDto }>("/api/cart", {}, baseUrl);
  return response.cart;
}

export async function addCartItem(
  sellerOfferId: string,
  qty: number,
  baseUrl = "",
): Promise<CartDto> {
  const response = await apiFetch<{ cart: CartDto }>(
    "/api/cart/items",
    { method: "POST", body: JSON.stringify({ sellerOfferId, qty }) },
    baseUrl,
  );
  return response.cart;
}

export async function updateCartItem(
  itemId: string,
  input: { qty?: number; savedForLater?: boolean },
  baseUrl = "",
): Promise<CartDto> {
  const response = await apiFetch<{ cart: CartDto }>(
    `/api/cart/items/${encodeURIComponent(itemId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
    baseUrl,
  );
  return response.cart;
}

export async function removeCartItem(itemId: string, baseUrl = ""): Promise<CartDto> {
  const response = await apiFetch<{ cart: CartDto }>(
    `/api/cart/items/${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
    baseUrl,
  );
  return response.cart;
}

export async function applyCartCoupon(code: string, baseUrl = ""): Promise<CartDto> {
  const response = await apiFetch<{ cart: CartDto }>(
    "/api/cart/coupon",
    { method: "POST", body: JSON.stringify({ code }) },
    baseUrl,
  );
  return response.cart;
}

export async function removeCartCoupon(baseUrl = ""): Promise<CartDto> {
  const response = await apiFetch<{ cart: CartDto }>("/api/cart/coupon", { method: "DELETE" }, baseUrl);
  return response.cart;
}
