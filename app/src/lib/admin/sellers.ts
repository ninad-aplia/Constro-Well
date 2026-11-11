// Formatting/status helpers for the admin seller pages.
import { ApiClientError } from "@/lib/api/client";

const TONES: Record<string, "ok" | "warn" | "neutral"> = {
  verified: "ok",
  pending: "warn",
};

/** Stored KycStatus values only — never inferred labels. */
export function kycTone(value: string): "ok" | "warn" | "neutral" {
  return TONES[value] ?? "neutral";
}

export function kycLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Treat FastAPI's naive UTC timestamps as UTC before formatting. */
export function formatDateOnly(iso: string): string {
  const normalized = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export type SellerDetailError = "unauthorized" | "forbidden" | "not-found" | "failed";

/** Maps API failures to the detail page's honest states (no fallback data). */
export function sellerDetailError(error: unknown): SellerDetailError {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return "unauthorized";
    if (error.status === 403) return "forbidden";
    if (error.status === 404) return "not-found";
  }
  return "failed";
}
