"use server";
// Cart + checkout API boundary (Stage 2 target). Today the resolution is
// server-side against the mock catalogue; Stage 2 replaces these actions with
// REST calls to `/api/v1` while keeping the same signatures, so client
// components never change.
//
// This file must stay a separate file from any client module (the file-level
// "use server" directive rule; same pattern as `recentlyViewedAction.ts`) —
// importing `data/catalog` here keeps the whole mock catalogue out of client
// bundles (D14 condition 2).
import { ART, HUE, PAIR, PRODUCTS, sellersOf } from "@/data/catalog";
import { toCardData, type ProductCardData } from "@/lib/api/catalog";
import { bulkTier, unitPrice } from "@/lib/shop/pricing";
import type { CartEntry, CartLine, Category } from "@/lib/shop/types";

const lineKey = (id: number, s: number): string => `${id}:${s}`;

/**
 * Resolves cart entries into display lines (prototype `mkLines`).
 * Unknown product ids (index out of bounds) are dropped rather than crashing
 * the page — a stale localStorage entry after a catalogue change heals itself.
 */
export async function resolveCartLines(entries: CartEntry[]): Promise<CartLine[]> {
  const lines: CartLine[] = [];
  for (const e of entries) {
    const p = PRODUCTS.find((p) => p.id === e.id);
    if (!p) continue;
    const offer = sellersOf(p)[e.s];
    if (!offer) continue;
    // Effective, priced quantity is resolved ONCE and used for the displayed
    // q AND the unit price/total (prototype clamps quantity to stock,
    // `addToCart`/`cq`, buildgrid-shop ~line 699 — stock lives only
    // server-side here, mock-data safety, D14). Previously the displayed q
    // was clamped but price/total were computed from the raw requested qty,
    // so an over-limit request showed a clamped quantity next to a total
    // priced at the wrong (larger) bulk-discount tier — fixed by clamping
    // first and pricing only the clamped amount. Zero stock resolves to
    // q=0/total=0; `outOfStock` lets the UI show that explicitly instead of
    // a silent, misleading ₹0 row.
    const effectiveQty = Math.max(0, Math.min(e.q, p.stock));
    const t = bulkTier(effectiveQty);
    const u = unitPrice(offer, effectiveQty);
    lines.push({
      key: lineKey(p.id, e.s),
      id: p.id,
      s: e.s,
      q: effectiveQty,
      requestedQty: e.q,
      outOfStock: p.stock === 0,
      saved: e.saved,
      name: p.name,
      cat: p.cat,
      p,
      offer,
      u,
      total: u * effectiveQty,
      bulk: Boolean(t),
      art: ART[p.cat],
      hue: HUE[p.cat],
    });
  }
  return lines;
}

/** Categories present among unsaved cart lines (for the recommendation row). */
export async function resolveCartCategories(entries: CartEntry[]): Promise<Category[]> {
  return [...new Set(
    entries.filter((e) => !e.saved).map((e) => PRODUCTS.find((p) => p.id === e.id)?.cat).filter((c): c is Category => Boolean(c)),
  )];
}

/**
 * "Pairs well with your cart" (prototype `VIEWS_cart` bottom row): the
 * top-rated product from each category paired with the cart's categories,
 * excluding what's already in the cart, capped at 8 (prototype `slice(0,8)`).
 */
export async function getPairsWithCart(cartCats: Category[]): Promise<ProductCardData[]> {
  if (!cartCats.length) return [];
  const inCart = new Set(cartCats as Category[]);
  const ids = new Set<number>();
  const picks: ProductCardData[] = [];
  for (const cat of cartCats) {
    for (const pairCat of PAIR[cat]) {
      // Top-rated of the pair category (prototype `topRated`/`topRatedInCategory` ordering).
      const pick = PRODUCTS.filter((p) => p.cat === pairCat && !inCart.has(p.cat) && !ids.has(p.id))
        .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)[0];
      if (pick) {
        ids.add(pick.id);
        picks.push(toCardData(pick));
      }
    }
    if (picks.length >= 8) break;
  }
  return picks.slice(0, 8);
}
