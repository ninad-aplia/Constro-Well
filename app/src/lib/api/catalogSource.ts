// Configuration + fallback control for the catalogue read cutover.
//
// SERVER-ONLY BY USAGE: this module is imported exclusively by server modules
// (`lib/api/catalogDb.ts` and the `/api/categories` route). `FASTAPI_BASE_URL`
// is deliberately NOT a NEXT_PUBLIC_ variable, so Next never inlines it into
// browser bundles. Never import this from a Client Component.
//
// Rollout:
//   FASTAPI_BASE_URL unset            -> current Next.js/Prisma implementation
//   FASTAPI_BASE_URL set              -> FastAPI first, Next.js fallback on error
//   CATALOG_SOURCE=next               -> force the old implementation (instant rollback)
//   CATALOG_FALLBACK=off              -> surface FastAPI errors instead of falling back
import { ApiClientError } from "./client";

export function fastApiBaseUrl(): string {
  return (process.env.FASTAPI_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

export function catalogueApiEnabled(): boolean {
  if (!fastApiBaseUrl()) return false;
  return (process.env.CATALOG_SOURCE ?? "").trim().toLowerCase() !== "next";
}

export function catalogueFallbackEnabled(): boolean {
  return (process.env.CATALOG_FALLBACK ?? "on").trim().toLowerCase() !== "off";
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 404;
}

/** Log label + error name only — the base URL and credentials must never be logged. */
export function reportCatalogueFallback(label: string, error: unknown): void {
  console.error(
    `[catalogue] FastAPI ${label} request failed; using the Next.js implementation`,
    error instanceof Error ? error.name : "unknown error",
  );
}

export async function withCatalogueFallback<T>(
  label: string,
  remote: () => Promise<T>,
  local: () => Promise<T>,
): Promise<T> {
  if (!catalogueApiEnabled()) return local();
  try {
    return await remote();
  } catch (error) {
    reportCatalogueFallback(label, error);
    if (!catalogueFallbackEnabled()) throw error;
    return local();
  }
}
