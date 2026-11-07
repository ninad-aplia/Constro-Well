// Pure reconciliation of persisted cart entries against freshly resolved
// stock. No React — used by CartProvider, and easy to unit test on its own.
import type { CartEntry, CartLine } from "@/lib/shop/types";

const lineReconcileKey = (id: number, s: number, saved: boolean): string => `${id}:${s}:${saved}`;

/**
 * An entry whose product/seller-offer no longer exists is pruned (nothing
 * left for the user to act on); an entry requesting more than current stock
 * has its stored quantity clamped down so a stale over-limit number never
 * compounds across reloads. Out-of-stock (stock === 0) lines are left as
 * requested and rendered with an explicit "out of stock" state instead — the
 * resolved q/total are already 0 either way, so nothing is ever priced
 * incorrectly.
 */
export function reconcileCartEntries(
  entries: CartEntry[],
  resolved: CartLine[],
): { entries: CartEntry[]; changed: boolean; notice: string | null } {
  const resolvedByKey = new Map(resolved.map((l) => [lineReconcileKey(l.id, l.s, l.saved), l] as const));
  const reconciled: CartEntry[] = [];
  let changed = false;
  let prunedCount = 0;
  for (const e of entries) {
    const line = resolvedByKey.get(lineReconcileKey(e.id, e.s, e.saved));
    if (!line) {
      changed = true;
      prunedCount += 1;
      continue;
    }
    if (!line.outOfStock && line.q !== e.q) {
      reconciled.push({ ...e, q: line.q });
      changed = true;
    } else {
      reconciled.push(e);
    }
  }
  return {
    entries: reconciled,
    changed,
    notice: prunedCount
      ? prunedCount === 1
        ? "An item in your cart is no longer available and was removed."
        : `${prunedCount} items in your cart are no longer available and were removed.`
      : null,
  };
}
