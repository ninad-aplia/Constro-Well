// Seller delivery configuration — free-above/fee/slot capacity live on the
// Seller row itself (read elsewhere via sellerMeta for the Orders page);
// service-area pincodes are a separate SellerPincode row per pin. Both are
// read by the real checkout/serviceability check in server/orders/service.ts,
// so persisting them for real (rather than a client-only mock) changes what
// customers can actually order from this seller.
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { SellerDeliverySettingsDto } from "@/lib/api/sellerOrderDto";
import { db } from "@/server/db";
import { ApiError } from "@/server/http";
import { DELIVERY_SLOTS } from "@/lib/seller/rules";

const money = z
  .union([z.string(), z.number()])
  .transform((value) => new Prisma.Decimal(value))
  .refine((value) => value.isFinite() && value.gte(0) && value.lte(1_000_000), "Must be between 0 and 1,000,000");

export const updateDeliveryRulesSchema = z
  .object({
    freeAbove: money,
    fee: money,
    slotsPerDay: z.array(z.number().int().min(0).max(100)).length(DELIVERY_SLOTS.length),
  })
  .strict();

export type UpdateDeliveryRulesInput = z.infer<typeof updateDeliveryRulesSchema>;

export const servicePinSchema = z
  .object({ pin: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode") })
  .strict();

async function getRules(sellerId: string) {
  const seller = await db.seller.findUnique({
    where: { id: sellerId },
    select: { freeAbove: true, fee: true, slotsPerDay: true },
  });
  if (!seller) throw new ApiError(403, "seller_profile_missing", "No seller profile is linked to this account");
  return seller;
}

export async function getSellerDeliverySettings(sellerId: string): Promise<SellerDeliverySettingsDto> {
  const [seller, pincodes] = await Promise.all([
    getRules(sellerId),
    db.sellerPincode.findMany({ where: { sellerId }, orderBy: { pin: "asc" }, select: { pin: true } }),
  ]);
  return {
    rules: {
      freeAbove: seller.freeAbove.toFixed(2),
      fee: seller.fee.toFixed(2),
      slotsPerDay: seller.slotsPerDay,
    },
    serviceAreas: pincodes.map((p) => p.pin),
  };
}

export async function updateDeliveryRules(
  sellerId: string,
  input: UpdateDeliveryRulesInput,
): Promise<SellerDeliverySettingsDto> {
  await db.seller.update({
    where: { id: sellerId },
    data: { freeAbove: input.freeAbove, fee: input.fee, slotsPerDay: input.slotsPerDay },
  });
  return getSellerDeliverySettings(sellerId);
}

export async function addServiceArea(sellerId: string, pin: string): Promise<SellerDeliverySettingsDto> {
  try {
    await db.sellerPincode.create({ data: { sellerId, pin } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "pincode_exists", "That pincode is already on your service area list");
    }
    throw error;
  }
  return getSellerDeliverySettings(sellerId);
}

export async function removeServiceArea(sellerId: string, pin: string): Promise<SellerDeliverySettingsDto> {
  await db.sellerPincode.deleteMany({ where: { sellerId, pin } });
  return getSellerDeliverySettings(sellerId);
}
