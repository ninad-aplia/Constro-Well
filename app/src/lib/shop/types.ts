// Customer-shop domain types. Shape mirrors buildgrid-shop.html exactly;
// real API responses (Phase 2+) must serialize to the same shape so the UI
// never notices the swap.
//
// "Interior Design" is the one entry not from the original prototype (which
// has exactly these 12) — owner-approved addition (DECISIONS.md D15),
// appended at the end so every existing category keeps its position. It
// currently has zero sample products — see data/catalog.ts.
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
  "Interior Design",
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
  /** Effective, stock-clamped quantity — this is what `u`/`total` are priced at, never the raw requested qty. 0 when `outOfStock`. */
  q: number;
  /** Most recently requested quantity, before any stock clamp — lets the UI say "reduced from N" instead of silently showing a smaller number. */
  requestedQty: number;
  /** True when the resolved product's stock is 0 — the UI must show this explicitly, never a 0-qty/₹0 row as if nothing were wrong. */
  outOfStock: boolean;
  saved: boolean;
  name: string;
  cat: Category;
  p: Product;
  offer: SellerOffer;
  u: number;
  total: number;
  bulk: boolean;
  /** category artwork + hue (resolved server-side; clients render without importing the catalogue) */
  art: string;
  hue: string;
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

/** Persisted cart row (prototype `cart()` entry): product + offer index + qty + save-for-later flag. Client-side only until the Stage-2 cart API exists. */
export interface CartEntry {
  id: number;
  s: number; // offer index
  q: number;
  saved: boolean;
}

/** Delivery address (prototype `Address` object shape). Reused by checkout now, the account page later. */
export interface Address {
  name: string;
  phone: string;
  pin: string;
  line: string;
  city: string;
  state: string;
  def?: boolean;
}

/** Customer order stages (prototype `STAGES`, buildgrid-shop.html:577). The index is the stage counter. */
export const ORDER_STAGES = ["Ordered", "Packed", "Shipped", "Out for delivery", "Delivered"] as const;

/** One order line as stored on the order (prototype `items` entries — snapshot, not a live product reference). art/hue ride along so order views render artwork without re-resolving the catalogue (prototype looked the product up; Stage 2 keeps this as a denormalized snapshot). */
export interface OrderItem {
  id: number;
  name: string;
  cat: Category;
  unit: string;
  q: number;
  total: number;
  seller: string;
  art: string;
  hue: string;
}

/** Totals snapshot on an order (prototype `o.t`). */
export interface OrderTotals {
  sub: number;
  ship: number;
  disc: number;
  total: number;
  gst: number;
  code: string | null;
}

/**
 * Preview order (prototype `DB.orders` order object). Stage-1 frontend state
 * only — stored in this browser; the real `Order` Prisma model (TASK 2.1)
 * replaces this shape at the Stage-2 API boundary, at which point the ids,
 * stock and payment handling all move server-side (D14 condition 5).
 */
export interface OrderPreview {
  id: string;
  created: number;
  items: OrderItem[];
  t: OrderTotals;
  addr: Address;
  pay: string;
  /** estimated delivery epoch ms (prototype `eta`) */
  eta: number;
  stage: number;
  /** per-stage timestamps (length co-varies with stage progress) */
  times: number[];
  cancelled: boolean;
}
