// Public catalogue reads. All money leaves this module as exact decimal
// strings; no float arithmetic or private seller fields cross the boundary.
import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/server/db";
import { ApiError } from "@/server/http";
import type {
  CategoryDto,
  OfferDto,
  ProductDetailDto,
  ProductSummaryDto,
} from "@/lib/api/dto";

export type CatalogDb = Pick<PrismaClient, "product" | "category">;

export type ProductSort = "relevance" | "price_asc" | "price_desc" | "name_asc" | "newest";

export interface ProductListQuery {
  q?: string;
  category?: string;
  sort: ProductSort;
  page: number;
  pageSize: number;
}

const publicOfferWhere = {
  status: "active" as const,
  stock: { gte: 1 },
  seller: { vacationMode: false },
};

const offerSellerSelect = {
  storeName: true,
  city: true,
  pincodes: { select: { pin: true } },
} as const;

const productInclude = {
  category: { select: { id: true, name: true } },
  offers: {
    where: publicOfferWhere,
    // `id` breaks price ties deterministically. Several sellers quote the same
    // price; without a secondary key Postgres may return ties in any order, so
    // the "cheapest offer" (and its displayed stock) could differ per request and
    // from the FastAPI reader (catalogue contract test).
    orderBy: [{ price: "asc" as const }, { id: "asc" as const }],
    include: { seller: { select: offerSellerSelect } },
  },
  reviews: { select: { stars: true } },
} satisfies Prisma.ProductInclude;

function money(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function specsOf(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function ratingOf(stars: { stars: number }[]): number | null {
  if (!stars.length) return null;
  const total = stars.reduce((sum, review) => sum + review.stars, 0);
  return Math.round((total / stars.length) * 10) / 10;
}

function summarize(product: Prisma.ProductGetPayload<{ include: typeof productInclude }>): ProductSummaryDto {
  const offers = product.offers.filter((offer) => offer.stock >= offer.minOrderQty);
  const cheapest = offers.reduce(
    (lowest, offer) => (offer.price.lt(lowest.price) ? offer : lowest),
    offers[0],
  );
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    brand: product.brand,
    category: product.category.name,
    unit: product.unit,
    mrp: money(product.mrp),
    price: cheapest ? money(cheapest.price) : "0.00",
    offerCount: offers.length,
    leadTimeDays: offers.length ? Math.min(...offers.map((offer) => offer.leadTimeDays)) : 0,
    rating: ratingOf(product.reviews),
    reviewCount: product.reviews.length,
    bulkFlag: product.bulkFlag,
    imageUrl: product.imageUrl,
    specs: specsOf(product.specs),
    offerId: cheapest?.id ?? null,
    stock: cheapest?.stock ?? 0,
    minOrderQty: cheapest?.minOrderQty ?? 1,
    purchasable: Boolean(cheapest),
  };
}

function serializeOffer(
  offer: Prisma.SellerOfferGetPayload<{ include: { seller: { select: typeof offerSellerSelect } } }>,
): OfferDto {
  return {
    id: offer.id,
    sellerName: offer.seller.storeName,
    sellerCity: offer.seller.city,
    price: money(offer.price),
    stock: offer.stock,
    minOrderQty: offer.minOrderQty,
    leadTimeDays: offer.leadTimeDays,
    verified: offer.verified,
    rating: offer.rating,
    serviceablePincodes: offer.seller.pincodes.map((pincode) => pincode.pin),
    purchasable: offer.status === "active" && offer.stock >= offer.minOrderQty,
  };
}

export async function listCategories(client: CatalogDb = db): Promise<CategoryDto[]> {
  const categories = await client.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          products: { where: { offers: { some: publicOfferWhere } } },
        },
      },
    },
  });
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: slugify(category.name),
    productCount: category._count.products,
  }));
}

function productWhere(query: ProductListQuery): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ offers: { some: publicOfferWhere } }];
  if (query.q) {
    and.push({
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { brand: { contains: query.q, mode: "insensitive" } },
        { category: { name: { contains: query.q, mode: "insensitive" } } },
      ],
    });
  }
  if (query.category) {
    and.push({
      OR: [
        { category: { id: query.category } },
        { category: { name: { equals: query.category, mode: "insensitive" } } },
      ],
    });
  }
  return { AND: and };
}

function orderByFor(sort: ProductSort): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      // `id` is a deterministic tie-break (seed rows share created_at).
      return [{ createdAt: "desc" }, { id: "asc" }];
    case "name_asc":
    default:
      return [{ name: "asc" }, { id: "asc" }];
  }
}

export async function listProducts(
  query: ProductListQuery,
  client: CatalogDb = db,
): Promise<{ products: ProductSummaryDto[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }> {
  const where = productWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  if (query.sort === "price_asc" || query.sort === "price_desc") {
    // 48 catalogue rows today; sorting the exact decimal strings in memory is
    // cheaper than a raw SQL min-price window. Move to SQL if the catalogue grows.
    const rows = await client.product.findMany({ where, include: productInclude });
    const items = rows
      .map(summarize)
      .filter((product) => product.offerCount > 0)
      // Sort by id first, then by price, so equal prices keep a stable order that
      // matches the FastAPI reader instead of whatever order the DB returned.
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .sort((a, b) => {
        const compared = new Prisma.Decimal(a.price).comparedTo(new Prisma.Decimal(b.price));
        return query.sort === "price_asc" ? compared : -compared;
      });
    return {
      products: items.slice(skip, skip + query.pageSize),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: items.length,
        totalPages: Math.ceil(items.length / query.pageSize),
      },
    };
  }

  const [total, rows] = await Promise.all([
    client.product.count({ where }),
    client.product.findMany({
      where,
      include: productInclude,
      orderBy: orderByFor(query.sort),
      skip,
      take: query.pageSize,
    }),
  ]);
  return {
    products: rows.map(summarize).filter((product) => product.offerCount > 0),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export async function getProductById(
  id: string,
  client: CatalogDb = db,
): Promise<ProductDetailDto> {
  const product = await client.product.findFirst({
    where: { OR: [{ id }, { code: id }] },
    include: productInclude,
  });
  if (!product) {
    throw new ApiError(404, "product_not_found", "Product not found");
  }
  const summary = summarize(product);
  const offers = product.offers
    .filter((offer) => offer.stock >= offer.minOrderQty)
    .map(serializeOffer);
  return { ...summary, available: offers.length > 0, offers };
}

export async function getProductSummariesByCodes(
  codes: string[],
  client: CatalogDb = db,
): Promise<ProductSummaryDto[]> {
  if (!codes.length) return [];
  const rows = await client.product.findMany({
    where: { code: { in: codes }, offers: { some: publicOfferWhere } },
    include: productInclude,
  });
  const byCode = new Map(rows.map((row) => [row.code, summarize(row)]));
  return codes.map((code) => byCode.get(code)).filter((row): row is ProductSummaryDto => Boolean(row));
}

export interface ProductReviewDto {
  name: string;
  stars: number;
  title: string;
  body: string;
  postedOn: string;
}

export async function listProductReviews(
  id: string,
  client: CatalogDb = db,
): Promise<ProductReviewDto[]> {
  const product = await client.product.findFirst({
    where: { OR: [{ id }, { code: id }] },
    select: {
      reviews: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      },
    },
  });
  if (!product) throw new ApiError(404, "product_not_found", "Product not found");
  return product.reviews.map((review) => ({
    name: review.user.name,
    stars: review.stars,
    title: review.title,
    body: review.body,
    postedOn: review.createdAt.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  }));
}

export async function getReviewHistogram(
  id: string,
  client: CatalogDb = db,
): Promise<number[]> {
  const product = await client.product.findFirst({
    where: { OR: [{ id }, { code: id }] },
    select: { reviews: { select: { stars: true } } },
  });
  if (!product) throw new ApiError(404, "product_not_found", "Product not found");
  const counts = [0, 0, 0, 0, 0];
  for (const review of product.reviews) {
    const index = Math.min(4, Math.max(0, 5 - Math.round(review.stars)));
    counts[index] += 1;
  }
  const total = product.reviews.length;
  return total ? counts.map((count) => Math.round((count / total) * 100)) : counts;
}

export async function listProductOffers(
  id: string,
  client: CatalogDb = db,
): Promise<{ product: ProductDetailDto; offers: OfferDto[] }> {
  const product = await getProductById(id, client);
  return { product, offers: product.offers };
}
