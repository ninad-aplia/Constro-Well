import { describe, expect, it, vi } from "vitest";
import type { CartEntry } from "@/lib/shop/types";

// Adds one synthetic zero-stock product to the real catalogue so "out of
// stock" can be tested without inventing a parallel data source — every
// other test below uses the real mock catalogue as-is.
vi.mock("@/data/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/catalog")>();
  return {
    ...actual,
    PRODUCTS: [
      ...actual.PRODUCTS,
      {
        id: 9000,
        cat: "Cement" as const,
        name: "Zero Stock Test Product",
        brand: "Test",
        mrp: 100,
        price: 100,
        unit: "unit",
        rating: 4,
        reviews: 1,
        stock: 0,
        days: 1,
        specs: [],
        off: 0,
        best: false,
      },
    ],
  };
});

const { resolveCartLines } = await import("./cart");

// Product id 0 = "UltraBuild OPC 53 Grade Cement, 50 kg Bag", price 390, stock 420.
// Product id 3 = "RapidSet Fast-Setting Cement, 25 kg", price 820, stock 14 (low stock).
const entry = (id: number, q: number, overrides: Partial<CartEntry> = {}): CartEntry => ({ id, s: 0, q, saved: false, ...overrides });

describe("resolveCartLines", () => {
  it("prices a normal in-stock request at the requested quantity", async () => {
    const [line] = await resolveCartLines([entry(0, 2)]);
    expect(line.q).toBe(2);
    expect(line.requestedQty).toBe(2);
    expect(line.outOfStock).toBe(false);
    expect(line.total).toBe(line.u * 2);
  });

  it("flags low stock without clamping a request still within it", async () => {
    const [line] = await resolveCartLines([entry(3, 10)]); // stock 14, requesting 10
    expect(line.q).toBe(10);
    expect(line.outOfStock).toBe(false);
  });

  it("clamps an over-limit request AND prices the clamped amount (regression test for the fixed bug)", async () => {
    // Previously: q was clamped to stock for display, but u/total were
    // computed from the raw, unclamped requested qty — showing a clamped
    // quantity next to a total priced at the wrong (larger) bulk tier.
    const [line] = await resolveCartLines([entry(3, 1000)]); // stock 14, requesting 1000
    expect(line.q).toBe(14); // display clamped to stock
    expect(line.requestedQty).toBe(1000); // original request remembered for messaging
    // Price/total must be computed from the SAME clamped qty (14), not 1000.
    expect(line.total).toBe(line.u * 14);
    expect(line.total).toBeLessThan(820 * 1000); // sanity: nowhere near the unclamped total
  });

  it("resolves a zero-stock product to q=0/total=0 and flags outOfStock, never a misleading number", async () => {
    const [line] = await resolveCartLines([entry(9000, 5)]);
    expect(line.outOfStock).toBe(true);
    expect(line.q).toBe(0);
    expect(line.total).toBe(0);
    expect(line.requestedQty).toBe(5);
  });

  it("keeps bulk pricing consistent with lib/shop/pricing's tiers at the clamped quantity", async () => {
    const [line] = await resolveCartLines([entry(0, 500)]); // stock 420, well past the 200-unit/10% tier
    expect(line.q).toBe(420);
    expect(line.bulk).toBe(true);
    expect(line.u).toBe(Math.round(390 * 0.9));
  });

  it("drops a line whose product id no longer exists in the catalogue", async () => {
    const lines = await resolveCartLines([entry(999_999, 1)]);
    expect(lines).toHaveLength(0);
  });

  it("drops a line whose seller-offer index no longer exists", async () => {
    const lines = await resolveCartLines([entry(0, 1, { s: 99 })]);
    expect(lines).toHaveLength(0);
  });
});
