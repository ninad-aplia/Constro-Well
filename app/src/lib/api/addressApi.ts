import { apiFetch } from "./client";
import type { AddressDto } from "./orderDto";

export interface AddressInput {
  label: string;
  name: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  pin: string;
  isDefault: boolean;
}

export async function fetchAddresses(baseUrl = ""): Promise<AddressDto[]> {
  const response = await apiFetch<{ addresses: AddressDto[] }>("/api/addresses", {}, baseUrl);
  return response.addresses;
}

export async function createAddress(input: AddressInput, baseUrl = ""): Promise<AddressDto> {
  const response = await apiFetch<{ address: AddressDto }>(
    "/api/addresses",
    { method: "POST", body: JSON.stringify(input) },
    baseUrl,
  );
  return response.address;
}

export async function updateAddress(
  id: string,
  input: Partial<AddressInput>,
  baseUrl = "",
): Promise<AddressDto> {
  const response = await apiFetch<{ address: AddressDto }>(
    `/api/addresses/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) },
    baseUrl,
  );
  return response.address;
}

export async function deleteAddress(id: string, baseUrl = ""): Promise<void> {
  await apiFetch<{ ok: boolean }>(
    `/api/addresses/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    baseUrl,
  );
}
