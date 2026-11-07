// Seller inventory writes. Seller identity is always passed in from
// `requireSeller`; every query is scoped by sellerId and no client-supplied
// seller/product ownership is accepted.
import { Prisma, type PrismaClient, type Seller } from "@prisma/client";
import { db } from "@/server/db";
import { ApiError } from "@/server/http";
import type { SellerProductDto } from "@/lib/api/dto";
import type {
  CreateSellerProductInput,
  UpdateSellerProductInput,
} from "./validation";

export type InventoryDb = Pick<PrismaClient, "sellerOffer" | "product">;

const offerInclude = {
  product: {
    include: { category: { select: { name: true } } },
  },
} satisfies Prisma.SellerOfferInclude;

type OfferWithProduct = Prisma.SellerOfferGetPayload<{ include: typeof offerInclude }>;

function serialize(offer: OfferWithProduct): SellerProductDto {
  return {
    offerId: offer.id,
    code: offer.code,
    productId: offer.product.id,
    productCode: offer.product.code,
    name: offer.product.name,
    brand: offer.product.brand,
    category: offer.product.category.name,
    unit: offer.product.unit,
    unitWeightKg: offer.product.unitWeightKg,
    mrp: offer.product.mrp.toFixed(2),
    price: offer.price.toFixed(2),
    stock: offer.stock,
    minOrderQty: offer.minOrderQty,
    reorderLevel: offer.reorderLevel,
    leadTimeDays: offer.leadTimeDays,
    status: offer.status,
    soldCount: offer.soldCount,
    verified: offer.verified,
    rating: offer.rating,
    bulkFlag: offer.product.bulkFlag,
    imageUrl: offer.product.imageUrl,
    updatedAt: offer.updatedAt.toISOString(),
  };
}

export async function listSellerProducts(
  sellerId: string,
  client: InventoryDb = db,
): Promise<SellerProductDto[]> {
  const offers = await client.sellerOffer.findMany({
    where: { sellerId },
    include: offerInclude,
    orderBy: { updatedAt: "desc" },
  });
  return offers.map(serialize);
}

export async function createSellerProduct(
  seller: Pick<Seller, "id" | "code">,
  input: CreateSellerProductInput,
  client: InventoryDb = db,
): Promise<SellerProductDto> {
  const product = await client.product.findFirst({
    where: { OR: [{ id: input.productId }, { code: input.productId }] },
  });
  if (!product) {
    throw new ApiError(404, "product_not_found", "Product not found");
  }

  const existing = await client.sellerOffer.findUnique({
    where: { sellerId_productId: { sellerId: seller.id, productId: product.id } },
  });
  if (existing) {
    throw new ApiError(409, "offer_exists", "You already list this product");
  }

  const nextStatus =
    input.status ?? (input.stock > 0 ? ("active" as const) : ("paused" as const));
  if (nextStatus === "active" && input.stock === 0) {
    throw new ApiError(400, "out_of_stock", "Add stock before activating this listing");
  }

  try {
    const offer = await client.sellerOffer.create({
      data: {
        code: `${seller.code}:${product.code}`,
        sellerId: seller.id,
        productId: product.id,
        price: input.price,
        stock: input.stock,
        minOrderQty: input.minOrderQty,
        reorderLevel: input.reorderLevel,
        leadTimeDays: input.leadTimeDays,
        status: nextStatus,
      },
      include: offerInclude,
    });
    return serialize(offer);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, "offer_exists", "You already list this product");
    }
    throw error;
  }
}

export async function updateSellerProduct(
  sellerId: string,
  offerId: string,
  input: UpdateSellerProductInput,
  client: InventoryDb = db,
): Promise<SellerProductDto> {
  const current = await client.sellerOffer.findFirst({
    where: { id: offerId, sellerId },
    include: offerInclude,
  });
  if (!current) {
    throw new ApiError(404, "offer_not_found", "Listing not found");
  }

  const nextStock = input.stock ?? current.stock;
  let nextStatus = input.status ?? current.status;
  if (nextStock === 0 && input.status === undefined) nextStatus = "paused";
  if (nextStatus === "active" && nextStock === 0) {
    throw new ApiError(400, "out_of_stock", "Add stock before activating this listing");
  }

  const data: Prisma.SellerOfferUpdateInput = { stock: nextStock, status: nextStatus };
  if (input.price !== undefined) data.price = input.price;
  if (input.minOrderQty !== undefined) data.minOrderQty = input.minOrderQty;
  if (input.reorderLevel !== undefined) data.reorderLevel = input.reorderLevel;
  if (input.leadTimeDays !== undefined) data.leadTimeDays = input.leadTimeDays;

  const offer = await client.sellerOffer.update({
    where: { id: current.id },
    data,
    include: offerInclude,
  });
  return serialize(offer);
}

export async function updateSellerStock(
  sellerId: string,
  offerId: string,
  stock: number,
  client: InventoryDb = db,
): Promise<SellerProductDto> {
  const current = await client.sellerOffer.findFirst({
    where: { id: offerId, sellerId },
    include: offerInclude,
  });
  if (!current) {
    throw new ApiError(404, "offer_not_found", "Listing not found");
  }

  const offer = await client.sellerOffer.update({
    where: { id: current.id },
    data: {
      stock,
      status: stock === 0 ? "paused" : current.status,
    },
    include: offerInclude,
  });
  return serialize(offer);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
