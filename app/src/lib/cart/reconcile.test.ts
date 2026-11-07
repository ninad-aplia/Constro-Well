import { describe, expect, it } from "vitest";
import { reconcileCartEntries } from "./reconcile";
import type { CartEntry, CartLine } from "@/lib/shop/types";

const entry = (id: number, q: number): CartEntry => ({ id, s: 0, q, saved: false });

const line = (overrides: Partial<CartLine>): CartLine => ({
  key: "0:0",
  id: 0,
  s: 0,
  q: 1,
  requestedQty: 1,
  outOfStock: false,
  saved: false,
  name: "Test",
  cat: "Cement",
  p: { id: 0, cat: "Cement", name: "Test", brand: "Test", mrp: 100, price: 100, unit: "bag", rating: 4, reviews: 1, stock: 10, days: 1, specs: [], off: 0, best: false },
  offer: { name: "Test Official", price: 100, days: 1, verified: true, rating: 4 },
  u: 100,
  total: 100,
  bulk: false,
  art: "",
  hue: "#000",
  ...overrides,
});

describe("reconcileCartEntries", () => {
  it("is a no-op when every entry resolved cleanly at its requested quantity", () => {
    const entries = [entry(0, 2)];
    const resolved = [line({ id: 0, q: 2, requestedQty: 2 })];
    const outcome = reconcileCartEntries(entries, resolved);
    expect(outcome.changed).toBe(false);
    expect(outcome.entries).toEqual(entries);
    expect(outcome.notice).toBeNull();
  });

  it("clamps a stored quantity down to the resolved (stock-limited) amount", () => {
    const entries = [entry(0, 50)];
    const resolved = [line({ id: 0, q: 10, requestedQty: 50 })];
    const outcome = reconcileCartEntries(entries, resolved);
    expect(outcome.changed).toBe(true);
    expect(outcome.entries).toEqual([{ id: 0, s: 0, q: 10, saved: false }]);
    expect(outcome.notice).toBeNull(); // clamping isn't a "removed" notice
  });

  it("leaves an out-of-stock entry's stored quantity untouched (nothing valid to clamp to)", () => {
    const entries = [entry(0, 5)];
    const resolved = [line({ id: 0, q: 0, requestedQty: 5, outOfStock: true })];
    const outcome = reconcileCartEntries(entries, resolved);
    expect(outcome.changed).toBe(false);
    expect(outcome.entries).toEqual(entries);
  });

  it("prunes an entry whose product/offer no longer resolved, and reports a notice", () => {
    const entries = [entry(0, 2), entry(1, 3)];
    const resolved = [line({ id: 0, q: 2, requestedQty: 2 })]; // id 1 didn't resolve
    const outcome = reconcileCartEntries(entries, resolved);
    expect(outcome.changed).toBe(true);
    expect(outcome.entries).toEqual([{ id: 0, s: 0, q: 2, saved: false }]);
    expect(outcome.notice).toMatch(/no longer available/);
  });

  it("pluralizes the notice for more than one pruned entry", () => {
    const entries = [entry(0, 1), entry(1, 1)];
    const outcome = reconcileCartEntries(entries, []);
    expect(outcome.notice).toMatch(/^2 items/);
  });
});
