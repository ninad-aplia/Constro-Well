// Seller Hub API facade - the only module Seller Portal UI should import
// mock data through (see data/seller.ts header). Still mock-backed today; the
// PostgreSQL inventory client is `lib/api/sellerApi.ts` and the server service
// is `src/server/seller/inventory.ts`. Pages migrate incrementally.
//
// Mutations remain client-side preview state until the Seller Hub is wired to
// `sellerApi.ts` with a signed-in seller session.
import { createSellerSeed } from "@/data/seller";
import type { SellerState } from "@/lib/seller/types";

export async function getSellerState(): Promise<SellerState> {
  return createSellerSeed();
}
