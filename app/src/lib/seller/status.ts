// Order status labels/tones, ported verbatim from buildgrid-seller-dashboard.html's `ST` (line 129).
import type { SellerOrderStatus } from "./types";

export const ORDER_STATUS: Record<SellerOrderStatus, { label: string; tone: "ok" | "warn" | "bad" | "info" }> = {
  new: { label: "New, accept it", tone: "warn" },
  accepted: { label: "To dispatch", tone: "info" },
  packed: { label: "Packed", tone: "info" },
  dispatched: { label: "On the road", tone: "info" },
  failed: { label: "Failed attempt", tone: "bad" },
  review: { label: "Delivered, in review", tone: "ok" },
  disputed: { label: "Disputed", tone: "bad" },
  settled: { label: "Paid", tone: "ok" },
  rejected: { label: "Rejected", tone: "bad" },
  missed: { label: "Missed, expired", tone: "bad" },
};
