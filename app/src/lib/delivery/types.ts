// Delivery Portal domain types. A delivery job is the driver-facing view of
// a seller's dispatched shipment; the API adapter maps the server DTO onto
// these shapes so the portal keeps its prototype layout.
import type { SellerOrderDocs, SellerOrderEvent, SellerOrderIssue } from "@/lib/seller/types";

/** Subset of `ShipmentStatus` relevant once a driver is assigned. */
export type DeliveryStatus = "dispatched" | "failed" | "review" | "disputed" | "settled";

export interface DeliveryJob {
  /** Shipment code shown to the driver (e.g. BG-123456-1). */
  id: string;
  /** Internal Shipment.id used by the driver APIs. */
  shipmentId: string;
  orderCode: string;
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
  vehicleReg?: string;
  vehicleType?: string;
  driverName?: string;
  driverPhone?: string;
  docs?: SellerOrderDocs;
  /** True once the driver has accepted the job (audit event recorded). */
  accepted: boolean;
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
  vehicles: { id: string; regNumber: string; type: string; driverId: string | null }[];
  drivers: { id: string; name: string; phone: string }[];
  storeName: string;
  driverName: string;
}
