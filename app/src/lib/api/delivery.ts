// Delivery Portal API facade — the only module Delivery Portal UI should
// import data through. Reuses the seller facade's mock orders rather than a
// second set of fixtures: a dispatched order and its delivery job are the
// same shipment (PROJECT_CONTEXT.md §7), so this derives the driver-facing
// view from `getSellerState()` instead of duplicating it. Swappable later
// for a real per-shipment fetch without UI call sites changing shape.
//
// There is no write-side here either, for the same reason as `lib/api/seller.ts`:
// driver actions (confirm delivery, mark failed attempt) live entirely in
// client-side preview state (`DeliveryStoreProvider`), never claimed as
// saved remotely.
import { getSellerState } from "./seller";
import { buildDeliveryJobs } from "@/lib/delivery/derive";
import type { DeliveryState } from "@/lib/delivery/types";

export async function getDeliveryState(): Promise<DeliveryState> {
  const seller = await getSellerState();
  return {
    jobs: buildDeliveryJobs(seller),
    vehicles: seller.vehicles,
    drivers: seller.drivers,
    storeName: seller.store.name,
  };
}
