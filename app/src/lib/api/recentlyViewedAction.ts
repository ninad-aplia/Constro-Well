"use server";
// Server Action boundary for `RecentlyViewedRow` (a Client Component):
// recently-viewed IDs only exist in the browser's localStorage, so resolving
// them to `ProductCardData` has to be called from client code, but the
// resolution itself (mock `PRODUCTS` lookup) must stay server-side — a plain
// function export from `catalog.ts` would bundle the whole mock catalogue
// into client JS. This file-level "use server" directive keeps
// `getProductCardsByIds` and its `PRODUCTS` import server-only; the client
// only receives a thin RPC call. (Next.js requires this directive to live in
// its own file, separate from `catalog.ts`, since that module is also
// imported type-only into the client component.)
import { getProductCardsByIds } from "./catalogDb";
import type { ProductCardData } from "./catalog";

export async function getRecentlyViewedCards(ids: number[]): Promise<ProductCardData[]> {
  return getProductCardsByIds(ids);
}
