// Catalog API facade - the only module UI code should import catalog data
// through (see data/catalog.ts header). Still mock-backed today; the
// PostgreSQL HTTP client is `lib/api/catalogApi.ts` and the server query
// service is `src/server/catalog/service.ts`. Pages migrate incrementally.
import { ART, HUE, PAIR, PRODUCTS, sellersOf, SLIDES, type Slide } from "@/data/catalog";
import { BULK } from "@/lib/shop/pricing";
import { CATEGORIES, type Category, type Product, type SellerOffer } from "@/lib/shop/types";

/** Categories featured on the homepage "Shop by category" tile (prototype `catTiles`, buildgrid-shop.html:405). */
const FEATURED_CATEGORIES: Category[] = ["Cement", "Steel", "Tiles", "Paint"];

export interface CategoryTile {
  category: Category;
  hue: string;
  art: string;
}

function toTile(category: Category): CategoryTile {
  return { category, hue: HUE[category], art: ART[category] };
}

export async function getCategories(): Promise<readonly Category[]> {
  return CATEGORIES;
}

/** Tiles for the homepage "Shop by category" card. */
export async function getFeaturedCategoryTiles(): Promise<CategoryTile[]> {
  return FEATURED_CATEGORIES.map(toTile);
}

/** Hero slide with its `art` category names resolved to rendered SVG markup. */
export interface HeroSlide extends Omit<Slide, "art"> {
  art: [string, string];
}

/** Home hero carousel slides (prototype `SLIDES`, buildgrid-shop.html:391-397). */
export async function getHeroSlides(): Promise<HeroSlide[]> {
  return SLIDES.map((s) => ({ ...s, art: s.art.map((c) => ART[c as Category]) as [string, string] }));
}

export interface DealTile {
  id: number;
  category: Category;
  off: number;
  hue: string;
  art: string;
}

/** Discounted products (prototype `deals()`, buildgrid-shop.html:401: off >= 15%, highest discount first). */
function discountedProducts() {
  return PRODUCTS.filter((p) => p.off >= 15).sort((a, b) => b.off - a.off);
}

/** Tiles for the homepage "Today's deals" card (prototype `dealTiles`, buildgrid-shop.html:406). */
export async function getDealTiles(): Promise<DealTile[]> {
  return discountedProducts()
    .slice(0, 4)
    .map((p) => ({ id: p.id, category: p.cat, off: p.off, hue: HUE[p.cat], art: ART[p.cat] }));
}

/** Bulk-pricing tiers for the homepage "Bulk saver" card (`lib/shop/pricing.ts` `BULK`, verified business logic, not mock data). */
export async function getBulkTiers(): Promise<readonly [number, number][]> {
  return BULK;
}

/** Fields a product-card row needs — no stock/delivery/brand data (see ProductCard for why). */
export interface ProductCardData {
  id: number;
  name: string;
  category: Category;
  price: number;
  mrp: number;
  off: number;
  rating: number;
  reviews: number;
  best: boolean;
  hue: string;
  art: string;
}

export function toCardData(p: Product): ProductCardData {
  return {
    id: p.id,
    name: p.name,
    category: p.cat,
    price: p.price,
    mrp: p.mrp,
    off: p.off,
    rating: p.rating,
    reviews: p.reviews,
    best: p.best,
    hue: HUE[p.cat],
    art: ART[p.cat],
  };
}

/** "Today's deals" product row (prototype `dl.slice(0,10)`, buildgrid-shop.html:412; same off>=15 selection as the homepage deal tiles). */
export async function getTodaysDealsRow(): Promise<ProductCardData[]> {
  return discountedProducts().slice(0, 10).map(toCardData);
}

const BEST_SELLER_CATEGORIES: Category[] = ["Cement", "Steel", "Sand"];

/** "Best sellers in cement, steel and sand" row (prototype, buildgrid-shop.html:413). */
export async function getBestSellersRow(): Promise<ProductCardData[]> {
  return PRODUCTS.filter((p) => BEST_SELLER_CATEGORIES.includes(p.cat))
    .sort((a, b) => b.reviews - a.reviews)
    .slice(0, 10)
    .map(toCardData);
}

const FINISHING_TOUCH_CATEGORIES: Category[] = ["Tiles", "Paint", "Doors and windows", "Plumbing", "Electrical"];

/** "Finishing touches: tiles, paint, doors and fittings" row (prototype, buildgrid-shop.html:414). */
export async function getFinishingTouchesRow(): Promise<ProductCardData[]> {
  return PRODUCTS.filter((p) => FINISHING_TOUCH_CATEGORIES.includes(p.cat))
    .sort((a, b) => b.reviews - a.reviews)
    .slice(0, 10)
    .map(toCardData);
}

export type SortOrder = "rel" | "low" | "high" | "rating" | "deal";

/** Rating-filter buttons (prototype `[4,3]`, buildgrid-shop.html:442). */
export const RATING_OPTIONS = [4, 3] as const;

/** Fixed price buckets (prototype `PRICES`, buildgrid-shop.html:420). */
export const PRICE_BUCKETS: { value: string; label: string }[] = [
  { value: "", label: "Any price" },
  { value: "0-500", label: "Under ₹500" },
  { value: "500-2000", label: "₹500 – ₹2,000" },
  { value: "2000-10000", label: "₹2,000 – ₹10,000" },
  { value: "10000-", label: "Over ₹10,000" },
];

/** `/search` request shape — deliberately Next.js-agnostic (the page parses raw searchParams into this before calling the facade). */
export interface SearchQuery {
  q: string;
  cat: string;
  deal: boolean;
  sort: SortOrder;
  page: number;
  brands: string[];
  price: string;
  rating: number;
}

export interface SearchResult {
  items: ProductCardData[];
  title: string;
  /** Final filtered count (post every filter, pre-pagination) — the prototype's `d.l.length`. */
  total: number;
  from: number;
  to: number;
  page: number;
  pages: number;
  /** Count for the "All categories" row — the prototype's `d.total` (post search+deal, pre-category). */
  allCategoriesCount: number;
  categoryCounts: { category: Category; count: number }[];
  /** Only populated when more than one brand is present (prototype: `Object.keys(d.brC).length>1`). */
  brandCounts: { brand: string; count: number }[];
  /** Drives "Clear all filters" visibility — mirrors the prototype's `active` (brands/price/rating/category only; deal is intentionally excluded, matching buildgrid-shop.html:440). */
  activeFilters: boolean;
}

const SEARCH_PAGE_SIZE = 12;

const SORTERS: Record<SortOrder, (a: Product, b: Product) => number> = {
  rel: (a, b) => b.reviews - a.reviews,
  low: (a, b) => a.price - b.price,
  high: (a, b) => b.price - a.price,
  rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
  deal: (a, b) => b.off - a.off,
};

/**
 * Search / category results pipeline — port of the prototype's `searchData`
 * + `searchBody` (buildgrid-shop.html:421-450). Filter order matters for the
 * facet counts: category counts come from the search+deal-filtered set
 * (before the category filter itself), brand counts come from the
 * category-filtered set (before brand/price/rating are applied) — exactly
 * mirroring the prototype so counts don't collapse to zero as filters stack.
 */
export async function searchProducts(query: SearchQuery): Promise<SearchResult> {
  const tokens = query.q.toLowerCase().split(/\s+/).filter(Boolean);

  let base = PRODUCTS.filter((p) => {
    const haystack = `${p.name} ${p.brand} ${p.cat} ${p.specs.join(" ")}`.toLowerCase();
    return tokens.every((t) => haystack.includes(t));
  });
  if (query.deal) base = base.filter((p) => p.off >= 15);

  const categoryCountMap = new Map<Category, number>();
  base.forEach((p) => categoryCountMap.set(p.cat, (categoryCountMap.get(p.cat) ?? 0) + 1));

  let list = query.cat === "All" ? base : base.filter((p) => p.cat === query.cat);

  const brandCountMap = new Map<string, number>();
  list.forEach((p) => brandCountMap.set(p.brand, (brandCountMap.get(p.brand) ?? 0) + 1));

  if (query.brands.length) list = list.filter((p) => query.brands.includes(p.brand));
  if (query.price) {
    const [min, max] = query.price.split("-");
    list = list.filter((p) => p.price >= Number(min) && (max === "" || p.price < Number(max)));
  }
  if (query.rating) list = list.filter((p) => p.rating >= query.rating);

  list = [...list].sort(SORTERS[query.sort]);

  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), pages);
  const from = (page - 1) * SEARCH_PAGE_SIZE;
  const pageItems = list.slice(from, from + SEARCH_PAGE_SIZE);

  const title = query.deal
    ? "Today’s deals"
    : query.q
      ? `Results for “${query.q}”`
      : query.cat !== "All"
        ? query.cat
        : "All products";

  return {
    items: pageItems.map(toCardData),
    title,
    total,
    from: total ? from + 1 : 0,
    to: from + pageItems.length,
    page,
    pages,
    allCategoriesCount: base.length,
    categoryCounts: CATEGORIES.filter((c) => categoryCountMap.has(c)).map((c) => ({
      category: c,
      count: categoryCountMap.get(c)!,
    })),
    brandCounts:
      brandCountMap.size > 1
        ? [...brandCountMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([brand, count]) => ({ brand, count }))
        : [],
    activeFilters: query.brands.length > 0 || query.price !== "" || query.rating > 0 || query.cat !== "All",
  };
}

/**
 * Resolves recently-viewed product IDs to cards, preserving the given (MRU)
 * order and dropping any ID that no longer resolves (prototype `recentList`,
 * buildgrid-shop.html:358: `DB.recent.map(P).filter(Boolean)`).
 *
 * Exposed to the client via the `getRecentlyViewedCards` Server Action in
 * `recentlyViewedAction.ts` — not marked "use server" here directly, because
 * Next.js forbids an inline Server Action in a file that's also imported
 * (even type-only) into a Client Component's module graph.
 */
export async function getProductCardsByIds(ids: number[]): Promise<ProductCardData[]> {
  const byId = new Map(PRODUCTS.map((p) => [p.id, p]));
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is Product => Boolean(p))
    .map(toCardData);
}

/** Fields the product-detail page needs. Deliberately excludes `stock`/`days` — same mock-data-safety reasoning as `ProductCardData`: no live inventory/delivery claims. */
export interface ProductDetail {
  id: number;
  name: string;
  brand: string;
  category: Category;
  mrp: number;
  price: number;
  off: number;
  unit: string;
  rating: number;
  reviews: number;
  best: boolean;
  specs: string[];
  hue: string;
  art: string;
}

function toProductDetail(p: Product): ProductDetail {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.cat,
    mrp: p.mrp,
    price: p.price,
    off: p.off,
    unit: p.unit,
    rating: p.rating,
    reviews: p.reviews,
    best: p.best,
    specs: p.specs,
    hue: HUE[p.cat],
    art: ART[p.cat],
  };
}

/** Product detail lookup (prototype `P(id)` via `VIEWS_product`, buildgrid-shop.html:477-478). Returns `null` for an unknown/invalid id — callers should treat that as not-found, never render a fallback product. */
export async function getProductById(id: number): Promise<ProductDetail | null> {
  const product = PRODUCTS.find((p) => p.id === id);
  return product ? toProductDetail(product) : null;
}

/**
 * Synthetic seller comparison (prototype `sellers()`/`sellersOf`) — sample
 * data only. These are not real sellers (see PROJECT_CONTEXT.md §7: "shop
 * prototype's sellers-per-product are synthesized from the brand + a name
 * pool, not real seller rows"); the UI must disclose this, never present it
 * as live/verified seller availability.
 */
export async function getSellerOffers(id: number): Promise<SellerOffer[]> {
  const product = PRODUCTS.find((p) => p.id === id);
  return product ? sellersOf(product) : [];
}

function topRatedInCategory(category: Category): Product | undefined {
  return PRODUCTS.filter((p) => p.cat === category).sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)[0];
}

/** "Frequently bought together" (prototype `fbt`, buildgrid-shop.html:480): this product plus the top-rated product from each of its two paired categories (`PAIR`). */
export async function getFrequentlyBoughtTogether(id: number): Promise<ProductCardData[]> {
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) return [];
  const picks = [product, ...PAIR[product.cat].map(topRatedInCategory)].filter((p): p is Product => Boolean(p));
  return picks.map(toCardData);
}

/** "Customers also viewed" (prototype `simil`, buildgrid-shop.html:479): same-category products first (natural order), then other-category products by review count, capped at 10. */
export async function getSimilarProducts(id: number): Promise<ProductCardData[]> {
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) return [];
  const sameCategory = PRODUCTS.filter((p) => p.cat === product.cat && p.id !== id);
  const otherCategory = PRODUCTS.filter((p) => p.cat !== product.cat && p.id !== id).sort((a, b) => b.reviews - a.reviews);
  return [...sameCategory, ...otherCategory].slice(0, 10).map(toCardData);
}

export interface ProductReview {
  name: string;
  stars: number;
  title: string;
  body: string;
  /** Pre-formatted display date — computed here (data-fetch time), not in a component render body, which React's purity rules forbid for `Date.now()`. */
  postedOn: string;
}

// Sample review content ported verbatim from the prototype (buildgrid-shop.html:367-370) —
// generic placeholder names/text, not real individuals or purchases. The UI
// must never label these "Verified purchase" (the prototype does not either,
// for these synthetic entries) and must disclose they're sample content.
const REVIEW_NAMES = ["Rohit S.", "Anita K.", "Vikram P.", "Deepa R.", "Mohammed A.", "Sunita M.", "Karthik N.", "Priyanka T.", "Harish B.", "Lakshmi V.", "Ajay D.", "Farhan Q."];
const REVIEW_POSITIVE: [string, string][] = [
  ["Exactly as described", "Quality is good and it arrived on time. Used it on our site and had no complaints."],
  ["Good value for money", "Compared prices with local dealers and this was cheaper even with delivery."],
  ["Packed well", "Delivery was on schedule and the packaging was intact. Will order again."],
  ["Solid quality", "Used it for our house construction and the mason was happy with it."],
];
const REVIEW_MIXED: [string, string][] = [
  ["Good, but delivery was late", "The product is fine. The truck arrived a day later than promised."],
  ["Okay for the price", "Does the job. Packaging could be better."],
];
const REVIEW_NEGATIVE: [string, string][] = [
  ["Some pieces damaged", "A few units were damaged in transit. A replacement was arranged but took time."],
];

/** Deterministic seeded PRNG (prototype `rng`, buildgrid-shop.html:366) — same product id always yields the same sample reviews, not random noise on every request. */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fixed anchor for sample-review dates — NOT `Date.now()`. Two reasons: (1)
// Next's cacheComponents treats `Date.now()` as an "unstable value" that
// can't be read during prerendering, even deep inside a data-fetch helper;
// (2) more importantly, this is static mock content — it shouldn't silently
// drift ("reviewed 4 months ago" slowly becoming "8 months ago" as real time
// passes) for data that never actually changes. A fixed reference date keeps
// `getProductReviews` a pure function of `id`, like every other facade call.
const REVIEW_REFERENCE_DATE = Date.UTC(2026, 10, 1);

/** Sample reviews (prototype `genReviews`, buildgrid-shop.html:371) — 6 per product, seeded by id. Illustrative sample content, not real customer reviews. */
export async function getProductReviews(id: number): Promise<ProductReview[]> {
  const rand = seededRandom(id * 7919 + 13);
  const reviews: ProductReview[] = [];
  for (let i = 0; i < 6; i++) {
    const roll = rand();
    const pool = roll < 0.72 ? REVIEW_POSITIVE : roll < 0.92 ? REVIEW_MIXED : REVIEW_NEGATIVE;
    const stars = pool === REVIEW_POSITIVE ? (rand() < 0.65 ? 5 : 4) : pool === REVIEW_MIXED ? 3 : 2;
    const [title, body] = pool[Math.floor(rand() * pool.length)];
    const daysAgo = Math.floor(rand() * 120 + 2);
    const postedOn = new Date(REVIEW_REFERENCE_DATE - daysAgo * 86400000).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    reviews.push({
      name: REVIEW_NAMES[Math.floor(rand() * REVIEW_NAMES.length)],
      stars,
      title,
      body,
      postedOn,
    });
  }
  return reviews;
}

/** Rating-distribution bars, 5-star down to 1-star (prototype `hist`, buildgrid-shop.html:373). */
export async function getRatingBreakdown(rating: number): Promise<number[]> {
  const p1 = Math.round((5 - rating) * 4);
  const p2 = Math.round((5 - rating) * 2.5);
  const p3 = Math.round((5 - rating) * 7);
  const p4 = Math.round(18 + (4.5 - rating) * 10);
  return [100 - p1 - p2 - p3 - p4, p4, p3, p2, p1];
}
