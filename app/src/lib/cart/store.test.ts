import { beforeEach, describe, expect, it } from "vitest";
import { addEntry, readCart, writeCart, readCoupon, writeCoupon } from "./store";
import type { CartEntry } from "@/lib/shop/types";

describe("addEntry (pure merge logic)", () => {
  it("appends a new entry, clamped to the given max", () => {
    const next = addEntry([], 1, 50, 0, false, 20);
    expect(next).toEqual([{ id: 1, s: 0, q: 20, saved: false }]);
  });
  it("merges into an existing matching entry, clamped to max", () => {
    const list: CartEntry[] = [{ id: 1, s: 0, q: 5, saved: false }];
    const next = addEntry(list, 1, 10, 0, false, 12);
    expect(next).toEqual([{ id: 1, s: 0, q: 12, saved: false }]);
  });
  it("does not add more to an out-of-stock (max <= 0) existing line", () => {
    const list: CartEntry[] = [{ id: 1, s: 0, q: 5, saved: false }];
    const next = addEntry(list, 1, 10, 0, false, 0);
    expect(next).toEqual([{ id: 1, s: 0, q: 5, saved: false }]); // unchanged, not forced to 1 nor incremented
  });
  it("treats different offer indexes as separate lines", () => {
    const list: CartEntry[] = [{ id: 1, s: 0, q: 5, saved: false }];
    const next = addEntry(list, 1, 3, 1, false, 99);
    expect(next).toHaveLength(2);
  });
  it("treats saved-for-later as a separate line from the active cart", () => {
    const list: CartEntry[] = [{ id: 1, s: 0, q: 5, saved: false }];
    const next = addEntry(list, 1, 3, 0, true, 99);
    expect(next).toHaveLength(2);
  });
});

describe("readCart / writeCart (localStorage round trip)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a written cart", () => {
    const entries: CartEntry[] = [{ id: 1, s: 0, q: 2, saved: false }];
    writeCart(entries);
    expect(readCart()).toEqual(entries);
  });

  it("returns an empty list when nothing has been stored", () => {
    expect(readCart()).toEqual([]);
  });

  it("drops malformed rows (e.g. a manually edited q < 1) instead of crashing", () => {
    window.localStorage.setItem("cw-cart", JSON.stringify([{ id: 1, s: 0, q: 0, saved: false }]));
    expect(readCart()).toEqual([]);
  });

  it("merges duplicate rows for the same (id, s, saved) on read", () => {
    window.localStorage.setItem(
      "cw-cart",
      JSON.stringify([
        { id: 1, s: 0, q: 2, saved: false },
        { id: 1, s: 0, q: 3, saved: false },
      ]),
    );
    expect(readCart()).toEqual([{ id: 1, s: 0, q: 5, saved: false }]);
  });
});

describe("readCoupon / writeCoupon", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a coupon code", () => {
    writeCoupon("BUILD10");
    expect(readCoupon()).toBe("BUILD10");
  });

  it("returns null when cleared", () => {
    writeCoupon("BUILD10");
    writeCoupon(null);
    expect(readCoupon()).toBeNull();
  });
});
