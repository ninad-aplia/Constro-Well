// Pricing + coupon business rules, ported VERBATIM from buildgrid-shop.html
// (`BULK`, `unitPrice`, `couponCheck`, `calc`). Single source of truth; the
// server-side API (Phase 2+) must reuse this module — client totals stay
// display hints and the backend re-runs the same math before accepting orders.

import type { CouponOutcome, SellerOffer, Totals } from "./types";

/** Bulk tiers: [minUnits, percentOff] */
export const BULK: [number, number][] = [
  [10, 3],
  [50, 6],
  [200, 10],
];

export type BulkTiers = readonly (readonly [number, number])[];

/**
 * Normalises a per-offer tier list from JSON/API input: integer thresholds
 * (2..100000), integer percentages (1..90), duplicate thresholds removed and
 * ascending order. Invalid entries are dropped rather than trusted.
 */
export function normalizeBulkTiers(raw: unknown): [number, number][] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const tiers: [number, number][] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length !== 2) continue;
    const [qty, percent] = entry;
    if (!Number.isInteger(qty) || qty < 2 || qty > 100_000) continue;
    if (!Number.isInteger(percent) || percent < 1 || percent > 90) continue;
    if (seen.has(qty)) continue;
    seen.add(qty);
    tiers.push([qty, percent]);
  }
  return tiers.sort((a, b) => a[0] - b[0]);
}

/** An offer with no custom tiers keeps the marketplace defaults. */
export function effectiveBulkTiers(raw: unknown): BulkTiers {
  const custom = normalizeBulkTiers(raw);
  return custom.length ? custom : BULK;
}

export function bulkTier(q: number, tiers: BulkTiers = BULK): [number, number] | undefined {
  const found = [...tiers].reverse().find(([n]) => q >= n);
  return found ? [found[0], found[1]] : undefined;
}

/** Unit price of one unit of an offer at quantity q (prototype `unitPrice`). */
export function unitPrice(offer: SellerOffer, q: number, tiers: BulkTiers = BULK): number {
  const t = bulkTier(q, tiers);
  return Math.round(offer.price * (1 - (t ? t[1] : 0) / 100));
}

export const FREE_DELIVERY_AT = 5000;
export const DELIVERY_FEE = 199;
export const COD_CAP = 50000;

/** Coupon engine (prototype `couponCheck`). `firstOrder` = customer has no prior orders. */
export function couponCheck(code: string, sub: number, firstOrder: boolean): CouponOutcome {
  const c = String(code || "").trim().toUpperCase();
  if (c === "BUILD10")
    return sub < 2000
      ? { ok: false, msg: "BUILD10 needs an order of ₹2,000 or more", disc: 0, free: false }
      : { ok: true, msg: "BUILD10 applied: 10% off, up to ₹5,000", disc: Math.min(5000, Math.round(sub * 0.1)), free: false };
  if (c === "FIRST250") {
    if (!firstOrder) return { ok: false, msg: "FIRST250 is for your first order only", disc: 0, free: false };
    return sub < 1500
      ? { ok: false, msg: "FIRST250 needs an order of ₹1,500 or more", disc: 0, free: false }
      : { ok: true, msg: "FIRST250 applied: ₹250 off", disc: 250, free: false };
  }
  if (c === "FREESHIP")
    return sub < 500
      ? { ok: false, msg: "FREESHIP needs an order of ₹500 or more", disc: 0, free: false }
      : { ok: true, msg: "FREESHIP applied: free delivery", disc: 0, free: true };
  return { ok: false, msg: "That code is not valid", disc: 0, free: false };
}

/** Totals (prototype `calc`): free delivery ≥ ₹5,000 else ₹199; GST inclusive shown as (sub−disc)*18/118. */
export function calcTotals(
  ls: { total: number; q: number }[],
  code: string | null,
  firstOrder = true,
): Totals {
  const sub = ls.reduce((a, l) => a + l.total, 0);
  let ship = !sub ? 0 : sub >= FREE_DELIVERY_AT ? 0 : DELIVERY_FEE;
  let disc = 0;
  let msg = "";
  let okCode: string | null = null;
  if (code) {
    const c = couponCheck(code, sub, firstOrder);
    msg = c.msg;
    disc = c.disc || 0;
    if (c.free) ship = 0;
    if (c.ok) okCode = String(code).toUpperCase();
  }
  return {
    sub,
    ship,
    disc,
    total: sub - disc + ship,
    gst: ((sub - disc) * 18) / 118,
    code: okCode,
    msg,
    items: ls.reduce((a, l) => a + l.q, 0),
  };
}
