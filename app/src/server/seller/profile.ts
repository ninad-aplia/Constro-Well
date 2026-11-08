// Seller store-profile persistence — backs the Settings page's "Store
// details" form and the vacation-mode toggle (Dashboard/TopBar). Every write
// is scoped by the sellerId resolved server-side from the session
// (requireSeller), never a client-supplied id.
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { SellerProfileDto } from "@/lib/api/sellerOrderDto";
import { db } from "@/server/db";
import { ApiError } from "@/server/http";

export const updateSellerProfileSchema = z
  .object({
    storeName: z.string().trim().min(3).max(120),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, "Enter a valid 15-character GSTIN"),
    phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
    pickupAddress: z.string().trim().min(5).max(300),
    vacationMode: z.boolean(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });

export type UpdateSellerProfileInput = z.infer<typeof updateSellerProfileSchema>;

function toDto(seller: {
  storeName: string;
  gstin: string;
  phone: string;
  city: string;
  pickupAddress: string;
  vacationMode: boolean;
  kycGst: "verified" | "pending";
  kycPan: "verified" | "pending";
  kycCheque: "verified" | "pending";
}): SellerProfileDto {
  return {
    storeName: seller.storeName,
    gstin: seller.gstin,
    phone: seller.phone,
    city: seller.city,
    pickupAddress: seller.pickupAddress,
    vacationMode: seller.vacationMode,
    kyc: { gst: seller.kycGst, pan: seller.kycPan, cheque: seller.kycCheque },
  };
}

const profileSelect = {
  storeName: true,
  gstin: true,
  phone: true,
  city: true,
  pickupAddress: true,
  vacationMode: true,
  kycGst: true,
  kycPan: true,
  kycCheque: true,
} as const;

export async function getSellerProfile(sellerId: string): Promise<SellerProfileDto> {
  const seller = await db.seller.findUnique({ where: { id: sellerId }, select: profileSelect });
  if (!seller) throw new ApiError(403, "seller_profile_missing", "No seller profile is linked to this account");
  return toDto(seller);
}

export async function updateSellerProfile(
  sellerId: string,
  input: UpdateSellerProfileInput,
): Promise<SellerProfileDto> {
  try {
    const seller = await db.seller.update({
      where: { id: sellerId },
      data: input,
      select: profileSelect,
    });
    return toDto(seller);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "gstin_in_use", "That GSTIN is already registered to another seller");
    }
    throw error;
  }
}
