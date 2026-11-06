// Recently-viewed tracking — port of buildgrid-shop.html's `DB.recent` +
// `pushRecent`/`recentList` (lines 190-193, 358-359): MRU order, dedup,
// capped at 12, localStorage-backed with an in-memory fallback when storage
// is unavailable (private/incognito, disabled, quota exceeded, etc.) — same
// defensive intent as the prototype's `pickStore`. Pure, framework- and
// mock-data-independent: no React, no catalogue import. Client-only (reads
// `window.localStorage`); safe no-op during any server render.
const STORAGE_KEY = "constro_well_recent_products_v1";
const MAX_RECENT = 12;

let memoryFallback: number[] = [];

function readIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryFallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : memoryFallback;
  } catch {
    return memoryFallback;
  }
}

function writeIds(ids: number[]): void {
  memoryFallback = ids;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable (blocked/quota) — memoryFallback above still holds
    // for the rest of this page's lifetime, matching the prototype's intent.
  }
}

/** IDs of recently viewed products, most-recently-viewed first. */
export function getRecentlyViewedIds(): number[] {
  return readIds();
}

/** Record a product view (prototype `pushRecent`): MRU order, dedup, capped at 12. */
export function recordRecentlyViewed(id: number): void {
  const current = readIds();
  const next = [id, ...current.filter((existing) => existing !== id)].slice(0, MAX_RECENT);
  writeIds(next);
}
