import { describe, expect, it } from "vitest";
import {
  BULK,
  bulkTier,
  calcTotals,
  couponCheck,
  effectiveBulkTiers,
  normalizeBulkTiers,
  unitPrice,
  FREE_DELIVERY_AT,
  DELIVERY_FEE,
  COD_CAP,
} from "./pricing";
import type { SellerOffer } from "./types";

const offer: SellerOffer = { name: "Test Seller", price: 100, days: 2, verified: true, rating: 4.5 };

describe("bulkTier", () => {
  it("has no tier below 10 units", () => {
    expect(bulkTier(1)).toBeUndefined();
    expect(bulkTier(9)).toBeUndefined();
  });
  it("applies 3% at the 10-unit boundary", () => {
    expect(bulkTier(10)).toEqual([10, 3]);
    expect(bulkTier(49)).toEqual([10, 3]);
  });
  it("applies 6% at the 50-unit boundary", () => {
    expect(bulkTier(50)).toEqual([50, 6]);
    expect(bulkTier(199)).toEqual([50, 6]);
  });
  it("applies 10% at the 200-unit boundary", () => {
    expect(bulkTier(200)).toEqual([200, 10]);
    expect(bulkTier(10_000)).toEqual([200, 10]);
  });
});

describe("unitPrice", () => {
  it("charges full price below the bulk threshold", () => {
    expect(unitPrice(offer, 1)).toBe(100);
  });  it("applies the bulk discount at and above the threshold, rounded", () => {
    expect(unitPrice(offer, 10)).toBe(97); // 100 * 0.97
    expect(unitPrice(offer, 200)).toBe(90); // 100 * 0.90
  });
});

describe("couponCheck", () => {
  it("rejects BUILD10 under its minimum", () => {
    expect(couponCheck("BUILD10", 1999, true).ok).toBe(false);
  });
  it("applies BUILD10 at 10% capped at ₹5,000", () => {
    expect(couponCheck("BUILD10", 2000, true)).toMatchObject({ ok: true, disc: 200 });
    expect(couponCheck("BUILD10", 100_000, true)).toMatchObject({ ok: true, disc: 5000 });
  });
  it("rejects FIRST250 for repeat customers regardless of total", () => {
    expect(couponCheck("FIRST250", 10_000, false).ok).toBe(false);
  });
  it("applies FIRST250 as a flat ₹250 off for first orders above its minimum", () => {
    expect(couponCheck("FIRST250", 1500, true)).toMatchObject({ ok: true, disc: 250 });
    expect(couponCheck("FIRST250", 1499, true).ok).toBe(false);
  });
  it("applies FREESHIP as free delivery, no discount", () => {
    expect(couponCheck("FREESHIP", 500, true)).toMatchObject({ ok: true, disc: 0, free: true });
    expect(couponCheck("FREESHIP", 499, true).ok).toBe(false);
  });
  it("rejects an unknown code", () => {
    expect(couponCheck("NOTREAL", 10_000, true).ok).toBe(false);
  });
});

describe("calcTotals", () => {
  it("charges delivery below the free-delivery threshold", () => {
    const t = calcTotals([{ total: FREE_DELIVERY_AT - 1, q: 1 }], null, true);
    expect(t.ship).toBe(DELIVERY_FEE);
  });
  it("waives delivery at/above the free-delivery threshold", () => {
    const t = calcTotals([{ total: FREE_DELIVERY_AT, q: 1 }], null, true);
    expect(t.ship).toBe(0);
  });
  it("charges nothing on an empty cart", () => {
    const t = calcTotals([], null, true);
    expect(t.ship).toBe(0);
    expect(t.sub).toBe(0);
  });
  it("computes GST as 18/118 of the discounted subtotal", () => {
    const t = calcTotals([{ total: 11_800, q: 1 }], null, true);
    expect(t.gst).toBeCloseTo(1800, 5);
  });
  it("applies a valid coupon's discount into the grand total", () => {
    const t = calcTotals([{ total: 5000, q: 10 }], "FREESHIP", true);
    expect(t.ship).toBe(0);
    expect(t.code).toBe("FREESHIP");
  });
  it("ignores an invalid coupon (no discount, no code)", () => {
    const t = calcTotals([{ total: 5000, q: 10 }], "NOPE", true);
    expect(t.code).toBeNull();
    expect(t.disc).toBe(0);
  });
  it("respects the COD cap as an independent concern (not auto-rejected by calcTotals)", () => {
    const t = calcTotals([{ total: COD_CAP + 1, q: 1 }], null, true);
    expect(t.total).toBeGreaterThan(COD_CAP);
  });
});

describe("per-offer bulk tiers", () => {
  it("falls back to the marketplace defaults when no tiers are configured", () => {
    expect(effectiveBulkTiers([])).toEqual(BULK);
    expect(effectiveBulkTiers(null)).toEqual(BULK);
    expect(unitPrice(offer, 10, effectiveBulkTiers([]))).toBe(97);
  });

  it("applies a custom tier at and above its threshold, replacing defaults", () => {
    const tiers = effectiveBulkTiers([[5, 20], [25, 40]]);
    expect(unitPrice(offer, 4, tiers)).toBe(100);
    expect(unitPrice(offer, 5, tiers)).toBe(80);
    expect(unitPrice(offer, 25, tiers)).toBe(60);
    expect(bulkTier(4, tiers)).toBeUndefined();
  });

  it("normalises ragged input, drops invalid rows and sorts tiers", () => {
    expect(
      normalizeBulkTiers([
        [50, 6],
        [10, 3],
        [10, 9],
        [1, 5],
        [10, 0],
        ["20", 4],
        [20, 101],
        [30, 10],
      ]),
    ).toEqual([[10, 3], [50, 6], [30, 10]].sort((a, b) => a[0] - b[0]));
    expect(normalizeBulkTiers("not-a-list")).toEqual([]);
  });
});
