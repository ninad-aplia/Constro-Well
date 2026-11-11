import { Prisma } from "@prisma/client";
import { z } from "zod";

const bulkTiers = z
  .array(
    z.tuple([
      z.number().int().min(2).max(100_000),
      z.number().int().min(1).max(90),
    ]),
  )
  .max(5)
  .transform((tiers) => [...tiers].sort((a, b) => a[0] - b[0]))
  .refine(
    (tiers) => new Set(tiers.map(([minQty]) => minQty)).size === tiers.length,
    "Bulk tier thresholds must be distinct",
  );

const money = z
  .union([z.string(), z.number()])
  .transform((value) => new Prisma.Decimal(value))
  .refine(
    (value) => value.isFinite() && value.gt(0) && value.lte(10_000_000),
    "Price must be greater than 0 and at most 10,000,000",
  );

const stock = z.number().int().min(0).max(1_000_000);
const minOrderQty = z.number().int().min(1).max(10_000);
const reorderLevel = z.number().int().min(0).max(1_000_000);
const leadTimeDays = z.number().int().min(0).max(60);
const status = z.enum(["active", "paused"]);

export const createSellerProductSchema = z
  .object({
    productId: z.string().trim().min(1).max(100),
    price: money,
    stock: stock.default(0),
    minOrderQty: minOrderQty.default(1),
    reorderLevel: reorderLevel.default(0),
    leadTimeDays: leadTimeDays.default(1),
    bulkTiers: bulkTiers.default([]),
    status: status.optional(),
  })
  .strict();

export const updateSellerProductSchema = z
  .object({
    price: money.optional(),
    stock: stock.optional(),
    minOrderQty: minOrderQty.optional(),
    reorderLevel: reorderLevel.optional(),
    leadTimeDays: leadTimeDays.optional(),
    bulkTiers: bulkTiers.optional(),
    status: status.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });

export const updateSellerStockSchema = z.object({ stock }).strict();

export const sellerOfferIdSchema = z.string().trim().min(1).max(100);

export type CreateSellerProductInput = z.infer<typeof createSellerProductSchema>;
export type UpdateSellerProductInput = z.infer<typeof updateSellerProductSchema>;
export type UpdateSellerStockInput = z.infer<typeof updateSellerStockSchema>;
