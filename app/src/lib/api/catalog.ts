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
