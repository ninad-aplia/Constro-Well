// Server-side adapters that keep the existing customer UI component shapes
// while sourcing catalogue data from PostgreSQL. Promotional artwork (ART/HUE)
// and FBT pairing remain presentation metadata from data/catalog.ts - no
// product, price or stock values are read from the mock fixtures here.
import { ART, HUE, PAIR } from "@/data/catalog";
import {
  getProductById as getProductDtoById,
  getProductSummariesByCodes,
  getReviewHistogram,
  listCategories,
  listProductReviews,
  listProducts,
} from "@/server/catalog/service";
import { ApiError } from "@/server/http";
import {
  fetchCategories,
  fetchProduct,
  fetchProductReviews,
  fetchProducts,
  fetchRatingHistogram,
  type ProductListParams,
  type ProductListResponse,
} from "./catalogApi";
import {
  catalogueApiEnabled,
  catalogueFallbackEnabled,
  fastApiBaseUrl,
  isNotFound,
  reportCatalogueFallback,
  withCatalogueFallback,
} from "./catalogSource";
import type { CategoryDto, ProductDetailDto } from "./dto";
import { BULK } from "@/lib/shop/pricing";
import { CATEGORIES, type Category } from "@/lib/shop/types";
import type { ProductSummaryDto } from "@/lib/api/dto";
import type {
  DealTile,
  ProductCardData,
  ProductDetail,
  ProductReview,
  SearchQuery,
  SearchResult,
  SortOrder,
} from "@/lib/api/catalog";
import type { OfferDto } from "@/lib/api/dto";

const SEARCH_PAGE_SIZE = 12;
const ALL_PRODUCTS_PAGE_SIZE = 50;

export interface ProductOffer {
  id: string;
  name: string;
  city: string;
  price: number;
  stock: number;
  minOrderQty: number;
  leadTimeDays: number;
  verified: boolean;
  rating: number | null;
  serviceablePincodes: string[];
  bulkTiers: [number, number][];
}

function asCategory(name: string): Category {
  return CATEGORIES.includes(name as Category) ? (name as Category) : "Cement";
}

function offPercent(price: string, mrp: string): number {
  const priceValue = Number(price);
  const mrpValue = Number(mrp);
  if (!Number.isFinite(priceValue) || !Number.isFinite(mrpValue) || mrpValue <= 0) return 0;
  return Math.max(0, Math.round((1 - priceValue / mrpValue) * 100));
}

function cardOf(product: ProductSummaryDto): ProductCardData {
  const category = asCategory(product.category);
  return {
    id: Number(product.code),
    name: product.name,
    category,
    price: Number(product.price),
    mrp: Number(product.mrp),
    off: offPercent(product.price, product.mrp),
    rating: product.rating ?? 0,
    reviews: product.reviewCount,
    best: false,
    hue: HUE[category],
    art: ART[category],
    offerId: product.offerId,
    stock: product.stock,
    minOrderQty: product.minOrderQty,
    purchasable: product.purchasable,
  };
}

function detailOf(product: Awaited<ReturnType<typeof getProductDtoById>>): ProductDetail {
  const category = asCategory(product.category);
  return {
    id: Number(product.code),
    name: product.name,
    brand: product.brand ?? "Constro Well",
    category,
    mrp: Number(product.mrp),
    price: Number(product.price),
    off: offPercent(product.price, product.mrp),
    unit: product.unit,
    rating: product.rating ?? 0,
    reviews: product.reviewCount,
    best: false,
    specs: product.specs,
    hue: HUE[category],
    art: ART[category],
  };
}

function offerOf(offer: OfferDto): ProductOffer {
  return {
    id: offer.id,
    name: offer.sellerName,
    city: offer.sellerCity,
    price: Number(offer.price),
    stock: offer.stock,
    minOrderQty: offer.minOrderQty,
    leadTimeDays: offer.leadTimeDays,
    verified: offer.verified,
    rating: offer.rating,
    serviceablePincodes: offer.serviceablePincodes,
    bulkTiers: offer.bulkTiers,
  };
}

async function allProducts(): Promise<ProductSummaryDto[]> {
  const result = await listSummaries({
    sort: "relevance",
    page: 1,
    pageSize: ALL_PRODUCTS_PAGE_SIZE,
  });
  return result.products;
}

/**
 * Product listing source: FastAPI when `FASTAPI_BASE_URL` is configured,
 * otherwise (or on failure, unless `CATALOG_FALLBACK=off`) the existing
 * Next.js/Prisma service. Both paths return the same DTO contract.
 */
async function listSummaries(params: ProductListParams): Promise<ProductListResponse> {
  return withCatalogueFallback(
    "product list",
    () => fetchProducts(params, fastApiBaseUrl()),
    () =>
      listProducts({
        q: params.q,
        category: params.category,
        sort: params.sort ?? "relevance",
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 12,
      }),
  );
}

/**
 * Product detail source. A FastAPI 404 maps to `null` (the same not-found
 * behaviour the Prisma path has) instead of triggering a pointless fallback.
 */
async function loadProduct(id: string): Promise<ProductDetailDto | null> {
  if (catalogueApiEnabled()) {
    try {
      return await fetchProduct(id, fastApiBaseUrl());
    } catch (error) {
      if (isNotFound(error)) return null;
      reportCatalogueFallback("product detail", error);
      if (!catalogueFallbackEnabled()) throw error;
    }
  }
  try {
    return await getProductDtoById(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

function discounted(products: ProductSummaryDto[]) {
  return products
    .map((product) => ({ product, off: offPercent(product.price, product.mrp) }))
    .filter((row) => row.off >= 15)
    .sort((a, b) => b.off - a.off);
}

export async function getTodaysDealsRow(): Promise<ProductCardData[]> {
  return discounted(await allProducts())
    .slice(0, 10)
    .map((row) => cardOf(row.product));
}

export async function getDealTiles(): Promise<DealTile[]> {
  return discounted(await allProducts())
    .slice(0, 4)
    .map(({ product, off }) => {
      const category = asCategory(product.category);
      return { id: Number(product.code), category, off, hue: HUE[category], art: ART[category] };
    });
}

async function byCategories(categories: Category[], perCategory: number): Promise<ProductSummaryDto[]> {
  const results = await Promise.all(
    categories.map((category) =>
      listSummaries({ category, sort: "relevance", page: 1, pageSize: perCategory }),
    ),
  );
  const byCode = new Map<string, ProductSummaryDto>();
  for (const result of results) {
    for (const product of result.products) byCode.set(product.code, product);
  }
  return [...byCode.values()];
}

export async function getBestSellersRow(): Promise<ProductCardData[]> {
  const products = await byCategories(["Cement", "Steel", "Sand"], 4);
  return products
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, 10)
    .map(cardOf);
}

export async function getFinishingTouchesRow(): Promise<ProductCardData[]> {
  const products = await byCategories(
    ["Tiles", "Paint", "Doors and windows", "Plumbing", "Electrical"],
    4,
  );
  return products
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, 10)
    .map(cardOf);
}

export async function searchProducts(query: SearchQuery): Promise<SearchResult> {
  const tokens = query.q.toLowerCase().split(/\s+/).filter(Boolean);
  const base = (await allProducts())
    .filter((product) => {
      if (!tokens.length) return true;
      const haystack = `${product.name} ${product.brand ?? ""} ${product.category} ${product.specs.join(" ")}`.toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    })
    .map((product) => ({ product, card: cardOf(product) }))
    .filter((row) => !query.deal || row.card.off >= 15);

  const categoryCountMap = new Map<Category, number>();
  for (const row of base) {
    const category = row.card.category;
    categoryCountMap.set(category, (categoryCountMap.get(category) ?? 0) + 1);
  }

  let list = query.cat === "All" ? base : base.filter((row) => row.card.category === query.cat);

  const brandOf = (row: (typeof base)[number]) => row.product.brand ?? "Constro Well";
  const brandCountMap = new Map<string, number>();
  for (const row of list) brandCountMap.set(brandOf(row), (brandCountMap.get(brandOf(row)) ?? 0) + 1);

  if (query.brands.length) list = list.filter((row) => query.brands.includes(brandOf(row)));
  if (query.price) {
    const [min, max] = query.price.split("-");
    list = list.filter(
      (row) => row.card.price >= Number(min) && (max === "" || row.card.price < Number(max)),
    );
  }
  if (query.rating) list = list.filter((row) => row.card.rating >= query.rating);

  const sorters: Record<SortOrder, (a: (typeof base)[number], b: (typeof base)[number]) => number> = {
    rel: (a, b) => b.product.reviewCount - a.product.reviewCount,
    low: (a, b) => a.card.price - b.card.price,
    high: (a, b) => b.card.price - a.card.price,
    rating: (a, b) => b.card.rating - a.card.rating || b.product.reviewCount - a.product.reviewCount,
    deal: (a, b) => b.card.off - a.card.off,
  };
  list = [...list].sort(sorters[query.sort]);

  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), pages);
  const offset = (page - 1) * SEARCH_PAGE_SIZE;
  const pageRows = list.slice(offset, offset + SEARCH_PAGE_SIZE);

  return {
    items: pageRows.map((row) => row.card),
    title: query.deal
      ? "Today’s deals"
      : query.q
        ? `Results for “${query.q}”`
        : query.cat !== "All"
          ? query.cat
          : "All products",
    total,
    from: total ? offset + 1 : 0,
    to: offset + pageRows.length,
    page,
    pages,
    allCategoriesCount: base.length,
    categoryCounts: CATEGORIES.filter((category) => categoryCountMap.has(category)).map(
      (category) => ({ category, count: categoryCountMap.get(category)! }),
    ),
    brandCounts:
      brandCountMap.size > 1
        ? [...brandCountMap.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([brand, count]) => ({ brand, count }))
        : [],
    activeFilters:
      query.brands.length > 0 || query.price !== "" || query.rating > 0 || query.cat !== "All",
  };
}

export async function getProductById(id: string | number): Promise<ProductDetail | null> {
  const product = await loadProduct(String(id));
  return product ? detailOf(product) : null;
}

export async function getSellerOffers(id: string | number): Promise<ProductOffer[]> {
  const product = await loadProduct(String(id));
  return product ? product.offers.map(offerOf) : [];
}

export async function getCategories(): Promise<CategoryDto[]> {
  return withCatalogueFallback(
    "categories",
    () => fetchCategories(fastApiBaseUrl()),
    () => listCategories(),
  );
}

export async function getFrequentlyBoughtTogether(id: string | number): Promise<ProductCardData[]> {
  const current = await loadProduct(String(id));
  if (!current) return [];
  const category = asCategory(current.category);
  const related = await byCategories([category, ...PAIR[category]], 4);
  const seen = new Set([current.code]);
  const picks: ProductSummaryDto[] = [current];
  for (const product of related) {
    if (seen.has(product.code)) continue;
    seen.add(product.code);
    picks.push(product);
    if (picks.length >= 4) break;
  }
  return picks.map(cardOf);
}

export async function getSimilarProducts(id: string | number): Promise<ProductCardData[]> {
  const current = await loadProduct(String(id));
  if (!current) return [];
  const category = asCategory(current.category);
  const same = await listSummaries({
    category,
    sort: "relevance",
    page: 1,
    pageSize: 10,
  });
  const seen = new Set([current.code]);
  const picks = same.products.filter((product) => product.code !== current.code);
  for (const product of picks) seen.add(product.code);
  if (picks.length < 10) {
    const all = await allProducts();
    const fillers = all
      .filter((product) => !seen.has(product.code))
      .sort((a, b) => b.reviewCount - a.reviewCount);
    picks.push(...fillers.slice(0, 10 - picks.length));
  }
  return picks.sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 10).map(cardOf);
}

export async function getProductCardsByIds(ids: number[]): Promise<ProductCardData[]> {
  const products = await getProductSummariesByCodes(ids.map(String));
  return products.map(cardOf);
}

export async function getProductReviews(id: string | number): Promise<ProductReview[]> {
  if (catalogueApiEnabled()) {
    try {
      return await fetchProductReviews(String(id), fastApiBaseUrl());
    } catch (error) {
      if (isNotFound(error)) return [];
      reportCatalogueFallback("product reviews", error);
      if (!catalogueFallbackEnabled()) throw error;
    }
  }
  try {
    return await listProductReviews(String(id));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return [];
    throw error;
  }
}

export async function getRatingBreakdown(id: string | number): Promise<number[]> {
  if (catalogueApiEnabled()) {
    try {
      return await fetchRatingHistogram(String(id), fastApiBaseUrl());
    } catch (error) {
      if (isNotFound(error)) return [0, 0, 0, 0, 0];
      reportCatalogueFallback("rating histogram", error);
      if (!catalogueFallbackEnabled()) throw error;
    }
  }
  try {
    return await getReviewHistogram(String(id));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return [0, 0, 0, 0, 0];
    throw error;
  }
}

export async function getBulkTiers(): Promise<readonly [number, number][]> {
  return BULK;
}
