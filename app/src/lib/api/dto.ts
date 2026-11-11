// Shared API response shapes. Pure types only - safe to import from both
// server services and client bundles.
export interface PaginationDto {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

export interface OfferDto {
  id: string;
  sellerName: string;
  sellerCity: string;
  price: string;
  stock: number;
  minOrderQty: number;
  leadTimeDays: number;
  verified: boolean;
  rating: number | null;
  serviceablePincodes: string[];
  purchasable: boolean;
}

export interface ProductSummaryDto {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  category: string;
  unit: string;
  mrp: string;
  price: string;
  offerCount: number;
  leadTimeDays: number;
  rating: number | null;
  reviewCount: number;
  bulkFlag: boolean;
  imageUrl: string | null;
  specs: string[];
  /** Cheapest purchasable offer (active seller, in stock) — the card CTA's add target. */
  offerId: string | null;
  stock: number;
  minOrderQty: number;
  purchasable: boolean;
}

export interface ProductDetailDto extends ProductSummaryDto {
  available: boolean;
  offers: OfferDto[];
}

export interface SellerProductDto {
  offerId: string;
  code: string;
  productId: string;
  productCode: string;
  name: string;
  brand: string | null;
  category: string;
  unit: string;
  unitWeightKg: number;
  mrp: string;
  price: string;
  stock: number;
  minOrderQty: number;
  reorderLevel: number;
  leadTimeDays: number;
  status: "active" | "paused";
  soldCount: number;
  verified: boolean;
  rating: number | null;
  bulkFlag: boolean;
  imageUrl: string | null;
  updatedAt: string;
}
