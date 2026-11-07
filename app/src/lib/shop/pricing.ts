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

export function bulkTier(q: number): [number, number] | undefined {
  return [...BULK].reverse().find(([n]) => q >= n);
}

/** Unit price of one unit of an offer at quantity q (prototype `unitPrice`). */
export function unitPrice(offer: SellerOffer, q: number): number {
  const t = bulkTier(q);
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
