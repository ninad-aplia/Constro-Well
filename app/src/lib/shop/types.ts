// Customer-shop domain types. Shape mirrors buildgrid-shop.html exactly;
// real API responses (Phase 2+) must serialize to the same shape so the UI
// never notices the swap.
export const CATEGORIES = [
  "Cement",
  "Steel",
  "Sand",
  "Bricks",
  "Blocks",
  "Ready mix",
  "Tiles",
  "Plumbing",
  "Electrical",
  "Paint",
  "Doors and windows",
  "Safety",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Product {
  id: number;
  cat: Category;
  name: string;
  brand: string;
  mrp: number;
  price: number;
  unit: string;
  rating: number;
  reviews: number;
  stock: number;
  days: number;
  specs: string[];
  /** percent off vs MRP */
  off: number;
  /** best seller in its category (highest review count, prototype rule) */
  best: boolean;
}

/** Mock seller offer for a product (prototype synthesizes 3 per product). */
export interface SellerOffer {
  name: string;
  price: number;
  days: number;
  verified: boolean;
  rating: number;
}

/** One cart line resolved for display: `p` = the product, `u` = unit price after bulk tier. */
export interface CartLine {
  key: string; // "productId:offerIndex"
  id: number;
  s: number; // offer index
  q: number;
  saved: boolean;
  name: string;
  cat: Category;
  p: Product;
  offer: SellerOffer;
  u: number;
  total: number;
  bulk: boolean;
}

export interface Totals {
  sub: number;
  ship: number;
  disc: number;
  total: number;
  gst: number;
  code: string | null;
  msg: string;
  items: number;
}

export interface CouponOutcome {
  ok: boolean;
  msg: string;
  disc: number;
  free: boolean;
}
