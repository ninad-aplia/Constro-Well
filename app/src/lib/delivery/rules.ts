// Delivery-specific business rules — ported from buildgrid-delivery-workflow.html's
// `doDeliver()` (3-wrong-OTP-fails, shortfall auto-dispute). Shared constants
// already owned by the seller domain (review window, commission, etc.) live
// in `lib/seller/rules.ts` and are imported from there, not redefined here.
import type { DeliveryJob } from "./types";

export const MAX_OTP_TRIES = 3;

/**
 * Deterministic 4-digit demo OTP derived from the order id — stable across
 * reloads (not random). The prototype shows this to the customer on their
 * order page; since Customer Portal order tracking isn't built yet, this
 * preview surfaces it directly in the delivery job detail instead, clearly
 * labelled as sample data, not a real one-time password.
 */
export function deriveOtp(orderId: string): string {
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) hash = (hash * 31 + orderId.charCodeAt(i)) >>> 0;
  return String(1000 + (hash % 9000));
}

/** Shortfall claim when the delivered quantity is less than ordered (prototype's auto-dispute claim). */
export function shortfallClaim(job: DeliveryJob, deliveredQty: number): number {
  return Math.max(0, job.qty - deliveredQty) * job.price;
}
