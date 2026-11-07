// Seller Hub API facade — the only module Seller Portal UI should import
// mock data through (see data/seller.ts header). Mirrors `lib/api/catalog.ts`'s
// pattern: wraps mock data behind an async call today, swappable for a real
// per-seller fetch once seller auth/backend exists, without UI call sites
// changing shape.
//
// There is no write-side here: this portal has no backend to persist to, so
// mutations (accept/reject/dispatch/stock edits/etc.) live entirely in
// client-side preview state (`SellerStoreProvider`), never claimed as saved
// remotely. This facade only supplies the initial seed.
import { createSellerSeed } from "@/data/seller";
import type { SellerState } from "@/lib/seller/types";

export async function getSellerState(): Promise<SellerState> {
  return createSellerSeed();
}
