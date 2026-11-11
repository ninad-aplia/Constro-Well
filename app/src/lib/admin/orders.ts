// Shared order presentation helpers (list + detail).

export type StatusTone = "neutral" | "ok" | "warn" | "info" | "bad";

const STAGE_TONES: Record<string, StatusTone> = {
  ordered: "neutral",
  packed: "info",
  shipped: "info",
  out_for_delivery: "warn",
  delivered: "ok",
};

const SHIPMENT_TONES: Record<string, StatusTone> = {
  new: "neutral",
  accepted: "info",
  packed: "info",
  dispatched: "info",
  review: "warn",
  settled: "ok",
  failed: "bad",
  rejected: "bad",
  missed: "bad",
  disputed: "bad",
  cancelled: "neutral",
};

export function orderStageTone(stage: string): StatusTone {
  return STAGE_TONES[stage] ?? "neutral";
}

export function shipmentStatusTone(status: string): StatusTone {
  return SHIPMENT_TONES[status] ?? "neutral";
}

/** Exact decimal string from the API; no float parsing. */
export function formatInrAmount(value: string): string {
  return `₹${value}`;
}
