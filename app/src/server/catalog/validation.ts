import { z } from "zod";

export const productSortSchema = z.enum([
  "relevance",
  "price_asc",
  "price_desc",
  "name_asc",
  "newest",
]);

export const productListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  sort: productSortSchema.default("relevance"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const productIdParamSchema = z.string().trim().min(1).max(100);

export type ProductListQueryInput = z.infer<typeof productListQuerySchema>;
