// Derives the driver-facing delivery job list from the seller's dispatched
// orders. A dispatched order and its delivery job describe the same
// shipment (PROJECT_CONTEXT.md §7), so this reads `SellerState` rather than
// keeping a second, divergent set of order fixtures — the Delivery Portal
// does not duplicate the Seller Portal's mock data, it re-derives from it.
import { deriveOtp } from "./rules";
import type { SellerState } from "@/lib/seller/types";
import type { DeliveryJob, DeliveryStatus } from "./types";

const DELIVERY_STATUSES = new Set<string>(["dispatched", "failed", "review", "disputed", "settled"]);

export function buildDeliveryJobs(seller: SellerState): DeliveryJob[] {
  return seller.orders
    .filter((o) => !!o.vehicleId && DELIVERY_STATUSES.has(o.status))
    .map((o) => {
      const status = o.status as DeliveryStatus;
      const alreadyDelivered = status === "review" || status === "settled" || status === "disputed";
      const deliveredQty = !alreadyDelivered
        ? undefined
        : status === "disputed" && o.issue?.type === "Short quantity" && o.issue.claim
          ? o.qty - Math.round(o.issue.claim / o.price)
          : o.qty;

      return {
        id: o.id,
        buyer: o.buyer,
        city: o.city,
        pin: o.pin,
        productName: o.productName,
        productCategory: o.productCategory,
        unit: o.unit,
        price: o.price,
        qty: o.qty,
        weightKg: o.weightKg,
        bulk: o.bulk,
        status,
        slot: o.slot,
        vehicleId: o.vehicleId as string,
        docs: o.docs,
        otp: deriveOtp(o.id),
        otpTries: 0,
        photoConfirmed: alreadyDelivered,
        deliveredQty,
        createdLabel: o.createdLabel,
        deliveredAtLabel: o.deliveredAtLabel,
        reviewEndsLabel: o.reviewEndsLabel,
        paidAtLabel: o.paidAtLabel,
        issue: o.issue,
        events: o.events,
      };
    });
}
