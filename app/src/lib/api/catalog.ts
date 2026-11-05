// Catalog API facade — the only module UI code should import catalog data
// through (see data/catalog.ts header). Wraps the mock catalogue behind async
// calls today; swaps to real fetch/DB-backed calls once TASK 2.1/2.2 land,
// without UI call sites changing shape.
import { ART, HUE } from "@/data/catalog";
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
