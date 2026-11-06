// Catalog API facade — the only module UI code should import catalog data
// through (see data/catalog.ts header). Wraps the mock catalogue behind async
// calls today; swaps to real fetch/DB-backed calls once TASK 2.1/2.2 land,
// without UI call sites changing shape.
import { ART, HUE, PRODUCTS, SLIDES, type Slide } from "@/data/catalog";
import { CATEGORIES, type Category } from "@/lib/shop/types";

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
