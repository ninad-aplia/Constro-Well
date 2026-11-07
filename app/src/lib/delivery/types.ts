// Delivery Portal domain types. A delivery job is the driver-facing view of
// a seller's dispatched order — the same underlying shipment the Seller Hub
// already models (PROJECT_CONTEXT.md §7 unifies Order -> Shipment), so this
// reuses the seller domain's shared shapes (documents, issues, events,
// vehicles, drivers) instead of redefining them. See `lib/delivery/derive.ts`
// for how a `DeliveryJob[]` is built from `SellerState.orders`.
import type { SellerOrderDocs, SellerOrderEvent, SellerOrderIssue, Vehicle, Driver } from "@/lib/seller/types";

/** Subset of `SellerOrderStatus` relevant once an order has a vehicle assigned. */
export type DeliveryStatus = "dispatched" | "failed" | "review" | "disputed" | "settled";

export interface DeliveryJob {
  id: string;
  buyer: string;
  city: string;
  pin: string;
  productName: string;
  productCategory: string;
  unit: string;
  price: number;
  qty: number;
  weightKg: number;
  bulk: boolean;
  status: DeliveryStatus;
  slot?: string;
  vehicleId: string;
  docs?: SellerOrderDocs;
  /** Deterministic demo OTP for this preview (see `deriveOtp`) — not a real, secret one-time password. */
  otp: string;
  otpTries: number;
  photoConfirmed: boolean;
  deliveredQty?: number;
  createdLabel: string;
  deliveredAtLabel?: string;
  reviewEndsLabel?: string;
  paidAtLabel?: string;
  issue?: SellerOrderIssue;
  events: SellerOrderEvent[];
}

export interface DeliveryState {
  jobs: DeliveryJob[];
  vehicles: Vehicle[];
  drivers: Driver[];
  storeName: string;
}
