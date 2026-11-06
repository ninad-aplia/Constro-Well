// Catalog API facade — the only module UI code should import catalog data
// through (see data/catalog.ts header). Wraps the mock catalogue behind async
// calls today; swaps to real fetch/DB-backed calls once TASK 2.1/2.2 land,
// without UI call sites changing shape.
import { ART, HUE, PRODUCTS, SLIDES, type Slide } from "@/data/catalog";
import { BULK } from "@/lib/shop/pricing";
import { CATEGORIES, type Category, type Product } from "@/lib/shop/types";

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

function toCardData(p: Product): ProductCardData {
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
