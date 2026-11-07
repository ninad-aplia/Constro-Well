// Server-side cart money rules. All values are Prisma Decimal; nothing here
// produces a JS float. Bulk tiers reuse the approved BULK table from
// lib/shop/pricing.ts so the prototype rule has one source of truth.
import { Prisma } from "@prisma/client";
import { BULK } from "@/lib/shop/pricing";
import { ApiError } from "@/server/http";

const D = Prisma.Decimal;
const ROUND = Prisma.Decimal.ROUND_HALF_UP;

export interface CouponRule {
  code: string;
  label: string;
  isActive: boolean;
  discountPercent: Prisma.Decimal | null;
  discountAmount: Prisma.Decimal | null;
  maxDiscount: Prisma.Decimal | null;
  minSubtotal: Prisma.Decimal;
  firstOrderOnly: boolean;
  freeDelivery: boolean;
}

// Transitional fallback until the Coupon table is populated by the seed:
// these are the three codes already supported by lib/shop/pricing.ts.
const FALLBACK_COUPONS: Record<string, CouponRule> = {
  BUILD10: {
    code: "BUILD10",
    label: "10% off up to ₹5,000",
    isActive: true,
    discountPercent: new D("0.10"),
    discountAmount: null,
    maxDiscount: new D(5000),
    minSubtotal: new D(2000),
    firstOrderOnly: false,
    freeDelivery: false,
  },
  FIRST250: {
    code: "FIRST250",
    label: "₹250 off your first order",
    isActive: true,
    discountPercent: null,
    discountAmount: new D(250),
    maxDiscount: null,
    minSubtotal: new D(1500),
    firstOrderOnly: true,
    freeDelivery: false,
  },
  FREESHIP: {
    code: "FREESHIP",
    label: "Free delivery",
    isActive: true,
    discountPercent: null,
    discountAmount: null,
    maxDiscount: null,
    minSubtotal: new D(500),
    firstOrderOnly: false,
    freeDelivery: true,
  },
};

export type CouponDb = {
  coupon: {
    findUnique: (args: {
      where: { code: string };
    }) => Promise<{
      code: string;
      label: string;
      isActive: boolean;
      discountPercent: Prisma.Decimal | null;
      discountAmount: Prisma.Decimal | null;
      maxDiscount: Prisma.Decimal | null;
      minSubtotal: Prisma.Decimal;
      firstOrderOnly: boolean;
      freeDelivery: boolean;
    } | null>;
  };
};

export function money(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

export function bulkPercent(qty: number): number {
  const tier = [...BULK].reverse().find(([minimum]) => qty >= minimum);
  return tier ? tier[1] : 0;
}

export function unitPrice(price: Prisma.Decimal, qty: number): Prisma.Decimal {
  const percent = bulkPercent(qty);
  if (!percent) return price.toDecimalPlaces(2, ROUND);
  const factor = new D(1).minus(new D(percent).div(100));
  return price.mul(factor).toDecimalPlaces(2, ROUND);
}

export function deliveryFeeFor(
  subtotal: Prisma.Decimal,
  freeAbove: Prisma.Decimal,
  fee: Prisma.Decimal,
): Prisma.Decimal {
  if (subtotal.lte(0)) return new D(0);
  return subtotal.gte(freeAbove) ? new D(0) : fee.toDecimalPlaces(2, ROUND);
}

export function taxFor(taxable: Prisma.Decimal): Prisma.Decimal {
  return taxable.mul(18).div(118).toDecimalPlaces(2, ROUND);
}

export async function loadCoupon(
  code: string | null | undefined,
  client: CouponDb,
): Promise<CouponRule | null> {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const row = await client.coupon.findUnique({ where: { code: normalized } });
  if (row) {
    return {
      code: row.code,
      label: row.label,
      isActive: row.isActive,
      discountPercent: row.discountPercent,
      discountAmount: row.discountAmount,
      maxDiscount: row.maxDiscount,
      minSubtotal: row.minSubtotal,
      firstOrderOnly: row.firstOrderOnly,
      freeDelivery: row.freeDelivery,
    };
  }
  return FALLBACK_COUPONS[normalized] ?? null;
}

function minimumMessage(rule: CouponRule): string {
  const amount = rule.minSubtotal.toNumber().toLocaleString("en-IN");
  if (rule.code === "BUILD10") return `BUILD10 needs an order of ₹${amount} or more`;
  if (rule.code === "FIRST250") return `FIRST250 needs an order of ₹${amount} or more`;
  if (rule.code === "FREESHIP") return `FREESHIP needs an order of ₹${amount} or more`;
  return `This coupon needs a subtotal of ₹${amount} or more`;
}

export function evaluateCoupon(
  rule: CouponRule,
  subtotal: Prisma.Decimal,
  firstOrder: boolean,
): { discount: Prisma.Decimal; freeDelivery: boolean } {
  if (!rule.isActive) {
    throw new ApiError(422, "coupon_inactive", "This coupon is not active");
  }
  if (subtotal.lt(rule.minSubtotal)) {
    throw new ApiError(422, "coupon_min_subtotal", minimumMessage(rule));
  }
  if (rule.firstOrderOnly && !firstOrder) {
    throw new ApiError(422, "coupon_first_order", `${rule.code} is for your first order only`);
  }

  let discount = new D(0);
  if (rule.discountPercent && rule.discountPercent.gt(0)) {
    discount = subtotal.mul(rule.discountPercent);
  } else if (rule.discountAmount && rule.discountAmount.gt(0)) {
    discount = rule.discountAmount;
  }
  if (rule.maxDiscount && discount.gt(rule.maxDiscount)) discount = rule.maxDiscount;
  if (discount.gt(subtotal)) discount = subtotal;

  return {
    discount: discount.toDecimalPlaces(2, ROUND),
    freeDelivery: rule.freeDelivery,
  };
}
