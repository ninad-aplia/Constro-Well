"use client";
// Client cart state (Stage 1). Owns cart entries + resolved display lines +
// coupon; persists to localStorage via lib/cart/store. Money math reuses
// lib/shop/pricing.ts — no duplicated rules.
//
// Line resolution for products NOT already on screen goes through the server
// action in lib/api/cart ("use server") so the mock catalogue never lands in
// client bundles (D14 condition 2; same pattern as RecentlyViewedRow).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartEntry, CartLine, Totals } from "@/lib/shop/types";
import type { ProductCardData } from "@/lib/api/catalog";
import { addEntry, readCart, readCoupon, writeCart, writeCoupon } from "@/lib/cart/store";
import { reconcileCartEntries } from "@/lib/cart/reconcile";
import { bulkTier, calcTotals, unitPrice } from "@/lib/shop/pricing";
import { getPairsWithCart, resolveCartLines } from "@/lib/api/cart";

export type CartStatus = "loading" | "ready" | "error";

interface CartApi {
  status: CartStatus;
  /** unsaved lines, resolved for display */
  lines: CartLine[];
  /** save-for-later rows */
  savedLines: CartLine[];
  coupon: string | null;
  totals: Totals;
  /** headline count for the header badge (prototype `cCount`) */
  count: number;
  /** "Pairs well with your cart" recommendation row */
  pairs: ProductCardData[];
  /** qty change clamped to stock: `max` is stock, known on the line already on screen. */
  add(id: number, q: number, s?: number, max?: number): void;
  setQty(key: string, q: number, max: number): void;
  remove(key: string): void;
  saveForLater(key: string): void;
  moveToCart(key: string): void;
  /** coupon apply — returns the outcome for inline status text */
  applyCoupon(code: string): { ok: boolean; msg: string };
  clearCoupon(): void;
  /** retry after the initial resolution failed */
  revalidate(): void;
  /** set when the last resolve pass pruned an entry whose product/offer no longer exists */
  notice: string | null;
  dismissNotice(): void;
}

const Ctx = createContext<CartApi | null>(null);

export function useCart(): CartApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useCart must be used inside <CartProvider>");
  return api;
}

const lineKeyOf = (id: number, s: number): string => `${id}:${s}`;

/** Recomputes one line's money fields after a qty change (prototype `unitPrice`/`bulk`). `max <= 0` means the line is out of stock — price/total must be 0, not a floor-to-1 quantity. */
function recompute(l: CartLine, q: number, max: number): CartLine {
  const qty = max <= 0 ? 0 : Math.max(1, Math.min(q, max));
  const u = unitPrice(l.offer, qty);
  return { ...l, q: qty, requestedQty: q, u, total: u * qty, bulk: Boolean(bulkTier(qty)) };
}

export default function CartProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CartStatus>("loading");
  const [linesAll, setLinesAll] = useState<CartLine[]>([]);
  const [coupon, setCouponState] = useState<string | null>(() => readCoupon());
  const [pairs, setPairs] = useState<ProductCardData[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // Applies a resolved line set: reconciles persisted storage, then updates
  // every piece of derived state. Called from inside a `.then()` callback by
  // both `refresh` (used by mutate/add/remove/etc, all triggered from event
  // handlers) and the mount effect below — never invoked as an effect's own
  // top-level statement, which is what react-hooks/set-state-in-effect
  // actually flags (a *locally defined* async function called bare from an
  // effect), not a setState call made from inside an inline `.then()`.
  const applyResolved = useCallback((entries: CartEntry[], resolved: CartLine[]) => {
    const outcome = reconcileCartEntries(entries, resolved);
    if (outcome.changed) writeCart(outcome.entries);
    if (outcome.notice) setNotice(outcome.notice);

    setLinesAll(resolved);
    const saved = resolved.filter((l) => !l.saved);
    if (saved.length) {
      getPairsWithCart([...new Set(saved.map((l) => l.cat))])
        .then(setPairs)
        .catch(() => setPairs([])); // recommendations are decorative: never fail the cart
    } else {
      setPairs([]);
    }
    setStatus("ready");
  }, []);

  const refresh = useCallback(
    async (entries: CartEntry[]) => {
      writeCart(entries);
      const resolved = await resolveCartLines(entries); // throws → caller catches
      applyResolved(entries, resolved);
    },
    [applyResolved],
  );

  const revalidate = useCallback(() => {
    setStatus("loading");
    setCouponState(readCoupon());
    refresh(readCart()).catch(() => setStatus("error"));
  }, [refresh]);

  // Mount-only load. Calls the imported `resolveCartLines` directly (not the
  // locally-defined `refresh`) with an inline `.then()/.catch()` — the shape
  // react-hooks/set-state-in-effect recognizes as a deferred async load, same
  // as every other fetch-on-mount effect in this codebase (e.g. ThanksView).
  // Calling a local async function bare from an effect is what the rule
  // actually flags, regardless of where the await sits inside it. The
  // initial `coupon` value comes from a lazy useState initializer above
  // instead of being set here, for the same reason; `revalidate` (which DOES
  // set state synchronously) is only ever invoked from "Try again" buttons —
  // plain event handlers, not effects, so that reset is fine there.
  useEffect(() => {
    const entries = readCart();
    writeCart(entries);
    resolveCartLines(entries)
      .then((resolved) => applyResolved(entries, resolved))
      .catch(() => setStatus("error"));
  }, [applyResolved]);

  const lines = useMemo(() => linesAll.filter((l) => !l.saved), [linesAll]);
  const savedLines = useMemo(() => linesAll.filter((l) => l.saved), [linesAll]);
  const totals = useMemo(
    () =>
      calcTotals(
        lines.map((l) => ({ total: l.total, q: l.q })),
        coupon,
        true, // customer order history is Stage-2 data; the default coupon window applies in preview
      ),
    [lines, coupon],
  );
  const count = useMemo(() => lines.reduce((a, l) => a + l.q, 0), [lines]);

  const mutate = useCallback(
    (next: CartEntry[]) => refresh(next).catch(() => setStatus("error")),
    [refresh],
  );

  const api = useMemo<CartApi>(() => ({
    status,
    lines,
    savedLines,
    coupon,
    totals,
    count,
    pairs,
    add: (id, q, s = 0, max = Number.MAX_SAFE_INTEGER) => {
      // Merge into an existing entry locally when it's already resolved
      // (instant, no flicker); otherwise a server-side resolve runs.
      const known = linesAll.find((l) => l.id === id && l.s === s && !l.saved);
      const stock = max === Number.MAX_SAFE_INTEGER ? (known ? known.p.stock : Number.MAX_SAFE_INTEGER) : max;
      mutate(addEntry(readCart(), id, q, s, false, stock)).catch(() => {});
      // Optimistic merge when we can — the resolve in `mutate` corrects anything left.
      setLinesAll((ls) => {
        const ex = ls.find((l) => l.id === id && l.s === s && !l.saved);
        if (!ex) return ls;
        return ls.map((l) => (l === ex ? recompute(ex, ex.q + q, stock) : l));
      });
    },
    setQty: (key, q, max) => {
      setLinesAll((ls) => ls.map((l) => (l.key === key ? recompute(l, q, max) : l)));
      // entries stay the resolved source of truth for persistence
      const entries = readCart().map((e) =>
        lineKeyOf(e.id, e.s) === key ? { ...e, q: Math.max(1, Math.min(q, max)) } : e,
      );
      writeCart(entries);
    },
    remove: (key) => mutate(readCart().filter((e) => lineKeyOf(e.id, e.s) !== key)).catch(() => {}),
    saveForLater: (key) =>
      mutate(readCart().map((e) => (lineKeyOf(e.id, e.s) === key && !e.saved ? { ...e, saved: true } : e))).catch(() => {}),
    moveToCart: (key) =>
      mutate(readCart().map((e) => (lineKeyOf(e.id, e.s) === key && e.saved ? { ...e, saved: false } : e))).catch(() => {}),
    applyCoupon: (code) => {
      const t = calcTotals(
        lines.map((l) => ({ total: l.total, q: l.q })),
        code,
        true,
      );
      const applied = t.code;
      if (applied) {
        setCouponState(applied);
        writeCoupon(applied);
      }
      return { ok: applied != null, msg: t.msg };
    },
    clearCoupon: () => {
      setCouponState(null);
      writeCoupon(null);
    },
    revalidate,
    notice,
    dismissNotice: () => setNotice(null),
  }), [status, lines, savedLines, coupon, totals, count, pairs, linesAll, mutate, revalidate, notice]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
