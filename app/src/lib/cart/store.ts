// Customer-side temporary state store (Stage 1): cart, coupon, saved
// addresses. Framework-free, framework runs no business logic here — money
// math stays in shop/pricing.ts and validation in shop/validate.ts; this file
// only owns the browser-persistence plumbing and the list invariants.
//
// This is the ONLY file in the app that reads/writes these keys, so a later
// backend swap (guest cart → server cart, TASK 3.3) changes one module.
//
// Storage is best-effort: any read failure degrades to an empty list rather
// than breaking the page (private-browsing / disabled storage).
import type { Address, CartEntry } from "@/lib/shop/types";

type SafeStorage = Pick<Storage, "getItem" | "setItem"> | null;

// Event pages run in browsers without localStorage; expose a tiny indirection
// so tests or callers can swap the source (defaults to window.localStorage).
function storage(): SafeStorage {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Low-level guarded read (also used by the orders preview store). */
export function read<T>(key: string, guard: (v: unknown) => T | null, fallback: T): T {
  const raw = storage()?.getItem(key);
  if (raw == null) return fallback;
  try {
    const parsed = guard(JSON.parse(raw));
    if (parsed === null) return fallback;
    return parsed;
  } catch {
    // Malformed JSON from manual edits — safest is the empty state, not a crash.
    return fallback;
  }
}

/** Low-level guarded write (also used by the orders preview store). */
export function write(key: string, value: unknown): void {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Quota/disabled storage: the demo keeps working in-memory for the session.
  }
}

/* ---------------- cart ---------------- */

const isEntry = (v: unknown): v is CartEntry =>
  typeof v === "object" && v !== null && typeof (v as CartEntry).id === "number" &&
  typeof (v as CartEntry).s === "number" && (v as CartEntry).s >= 0 &&
  typeof (v as CartEntry).q === "number" && (v as CartEntry).q >= 1 &&
  typeof (v as CartEntry).saved === "boolean";

/** Rows in localStorage, invalid rows dropped (guards manual edits). Not sorted — order is insertion. */
export function readCart(): CartEntry[] {
  const list = read<CartEntry[]>("cw-cart", (v) => (Array.isArray(v) && v.every(isEntry) ? v : null), []);
  // Invariant: no two entries share (id, s, saved) — merge on any duplicate.
  const merged: CartEntry[] = [];
  for (const e of list) {
    const ex = merged.find((x) => x.id === e.id && x.s === e.s && x.saved === e.saved);
    if (ex) ex.q += e.q;
    else merged.push(e);
  }
  return merged;
}

export function writeCart(entries: CartEntry[]): void {
  write("cw-cart", entries);
}

/** Adds quantity for (id, s, saved), merging into an existing row or appending one. `max` clamps the result (stock); the caller resolves it (it owns product data). */
export function addEntry(
  list: CartEntry[],
  id: number,
  q: number,
  s: number,
  saved: boolean,
  max: number,
): CartEntry[] {
  const ex = list.find((x) => x.id === id && x.s === s && x.saved === saved);
  if (ex) {
    // max <= 0 means the caller already knows this line is out of stock —
    // don't add more to it (the authoritative resolve pass corrects display
    // either way; this just avoids pointlessly growing a dead quantity).
    const nextQty = max <= 0 ? ex.q : Math.min(ex.q + q, max);
    return list.map((x) => (x === ex ? { ...x, q: nextQty } : x));
  }
  return [...list, { id, s, q: Math.max(1, Math.min(q, max)), saved }];
}

/* ---------------- coupon ---------------- */

export function readCoupon(): string | null {
  return read<string | null>("cw-coupon", (v) => (typeof v === "string" && v ? v : null), null);
}

export function writeCoupon(code: string | null): void {
  write("cw-coupon", code);
}

/* ---------------- addresses (saved at checkout; account page later) ---------------- */

function isAddress(v: unknown): v is Address {
  const a = v as Address;
  return typeof a?.name === "string" && typeof a?.phone === "string" && typeof a?.pin === "string";
}

export function readAddresses(): Address[] {
  return read<Address[]>("cw-addresses", (v) => (Array.isArray(v) && v.every(isAddress) ? v : null), []);
}

export function writeAddresses(list: Address[]): void {
  write("cw-addresses", list);
}

/** Saves an address, returning the list with `def` exclusivity applied when the new one is default. */
export function saveAddress(list: Address[], addr: Address): Address[] {
  const next = addr.def ? list.map((a) => ({ ...a, def: false })) : [...list];
  next.push(addr);
  return next;
}
