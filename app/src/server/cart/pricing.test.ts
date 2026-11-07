import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  deliveryFeeFor,
  evaluateCoupon,
  taxFor,
  unitPrice,
  type CouponRule,
} from "./pricing";

const D = (value: string | number) => new Prisma.Decimal(value);

function rule(overrides: Partial<CouponRule>): CouponRule {
  return {
    code: "TEST",
    label: "Test",
    isActive: true,
    discountPercent: null,
    discountAmount: null,
    maxDiscount: null,
    minSubtotal: D(0),
    firstOrderOnly: false,
    freeDelivery: false,
    ...overrides,
  };
}

describe("cart pricing", () => {
  it("applies the approved bulk tiers with Decimal rounding", () => {
    expect(unitPrice(D("390"), 9).toFixed(2)).toBe("390.00");
    expect(unitPrice(D("390"), 10).toFixed(2)).toBe("378.30");
    expect(unitPrice(D("390"), 50).toFixed(2)).toBe("366.60");
    expect(unitPrice(D("390"), 200).toFixed(2)).toBe("351.00");
  });

  it("uses seller-specific free-delivery thresholds", () => {
    expect(deliveryFeeFor(D("4999.99"), D(5000), D(199)).toFixed(2)).toBe("199.00");
    expect(deliveryFeeFor(D("5000"), D(5000), D(199)).toFixed(2)).toBe("0.00");
    expect(deliveryFeeFor(D(0), D(5000), D(199)).toFixed(2)).toBe("0.00");
  });

  it("calculates inclusive GST with Decimal math", () => {
    expect(taxFor(D("1180")).toFixed(2)).toBe("180.00");
  });

  it("caps percentage coupons and enforces minimum/first-order rules", () => {
    const build = rule({ code: "BUILD10", discountPercent: D("0.10"), maxDiscount: D(5000), minSubtotal: D(2000) });
    expect(evaluateCoupon(build, D("3000"), true).discount.toFixed(2)).toBe("300.00");
    expect(evaluateCoupon(build, D("60000"), true).discount.toFixed(2)).toBe("5000.00");
    expect(() => evaluateCoupon(build, D("1999"), true)).toThrow();

    const first = rule({ code: "FIRST250", discountAmount: D(250), firstOrderOnly: true, minSubtotal: D(1500) });
    expect(evaluateCoupon(first, D("1500"), true).discount.toFixed(2)).toBe("250.00");
    expect(() => evaluateCoupon(first, D("1500"), false)).toThrow();

    const free = rule({ code: "FREESHIP", minSubtotal: D(500), freeDelivery: true });
    expect(evaluateCoupon(free, D("500"), true).freeDelivery).toBe(true);
    expect(() => evaluateCoupon(free, D("499"), true)).toThrow();
  });
});
