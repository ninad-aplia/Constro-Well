import { z } from "zod";

const qty = z.number().int().min(1).max(1_000_000);

export const addCartItemSchema = z
  .object({
    sellerOfferId: z.string().trim().min(1).max(100),
    qty,
  })
  .strict();

export const updateCartItemSchema = z
  .object({
    qty: qty.optional(),
    savedForLater: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.qty !== undefined || value.savedForLater !== undefined, {
    message: "Provide qty or savedForLater",
  });

export const couponSchema = z.object({ code: z.string().trim().min(1).max(50) }).strict();

export const cartItemIdSchema = z.string().trim().min(1).max(100);
