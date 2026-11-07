// Delivery status labels/tones, ported from buildgrid-delivery-workflow.html's
// `ST` (line 136), restricted to the statuses a dispatched job can reach.
import type { DeliveryStatus } from "./types";

export const DELIVERY_STATUS: Record<DeliveryStatus, { label: string; tone: "ok" | "warn" | "bad" | "info" }> = {
  dispatched: { label: "On the road", tone: "info" },
  failed: { label: "Failed attempt", tone: "bad" },
  review: { label: "Delivered, in review", tone: "ok" },
  disputed: { label: "Disputed", tone: "bad" },
  settled: { label: "Paid out", tone: "ok" },
};
