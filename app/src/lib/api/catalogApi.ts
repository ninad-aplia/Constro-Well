// DB-backed catalogue client. Browser callers use the relative default;
// Server Components should pass an absolute base URL.
import { apiFetch, queryString } from "./client";
import type { CategoryDto, OfferDto, PaginationDto, ProductDetailDto, ProductSummaryDto } from "./dto";

export type ProductSort = "relevance" | "price_asc" | "price_desc" | "name_asc" | "newest";

export interface ProductListParams {
  q?: string;
  category?: string;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
}

export interface ProductListResponse {
  products: ProductSummaryDto[];
  pagination: PaginationDto;
}

export async function fetchCategories(baseUrl = ""): Promise<CategoryDto[]> {
  const response = await apiFetch<{ categories: CategoryDto[] }>("/api/categories", {}, baseUrl);
  return response.categories;
}

export async function fetchProducts(
  params: ProductListParams = {},
  baseUrl = "",
): Promise<ProductListResponse> {
  const query = queryString({
    q: params.q,
    category: params.category,
    sort: params.sort,
    page: params.page,
    pageSize: params.pageSize,
  });
  return apiFetch<ProductListResponse>(`/api/products${query}`, {}, baseUrl);
}

export async function fetchProduct(id: string, baseUrl = ""): Promise<ProductDetailDto> {
  const response = await apiFetch<{ product: ProductDetailDto }>(
    `/api/products/${encodeURIComponent(id)}`,
    {},
    baseUrl,
  );
  return response.product;
}

export async function fetchProductOffers(
  id: string,
  baseUrl = "",
): Promise<{ product: ProductDetailDto; offers: OfferDto[] }> {
  return apiFetch<{ product: ProductDetailDto; offers: OfferDto[] }>(
    `/api/products/${encodeURIComponent(id)}/offers`,
    {},
    baseUrl,
  );
}

export interface ProductReview {
  name: string;
  stars: number;
  title: string;
  body: string;
  postedOn: string;
}

export async function fetchProductReviews(
  id: string,
  baseUrl = "",
): Promise<ProductReview[]> {
  const response = await apiFetch<{ reviews: ProductReview[] }>(
    `/api/products/${encodeURIComponent(id)}/reviews`,
    {},
    baseUrl,
  );
  return response.reviews;
}

/** Five buckets, 5★ → 1★, as integer percentages. */
export async function fetchRatingHistogram(id: string, baseUrl = ""): Promise<number[]> {
  const response = await apiFetch<{ histogram: number[] }>(
    `/api/products/${encodeURIComponent(id)}/rating`,
    {},
    baseUrl,
  );
  return response.histogram;
}
