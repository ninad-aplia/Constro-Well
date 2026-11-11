import { describe, expect, it } from "vitest";
import {
  createSellerProductSchema,
  updateSellerProductSchema,
} from "./validation";

const validTiers = [
  [50, 6],
  [10, 3],
];

describe("seller bulk tier validation", () => {
  it("normalises valid tiers into ascending order", () => {
    const parsed = updateSellerProductSchema.parse({ bulkTiers: validTiers });
    expect(parsed.bulkTiers).toEqual([
      [10, 3],
      [50, 6],
    ]);
  });

  it("accepts an empty tier list (marketplace defaults)", () => {
    expect(createSellerProductSchema.parse({ productId: "p1", price: 100, bulkTiers: [] }).bulkTiers).toEqual([]);
  });

  it("rejects duplicate thresholds, bad bounds and more than five tiers", () => {
    expect(updateSellerProductSchema.safeParse({ bulkTiers: [[10, 3], [10, 5]] }).success).toBe(false);
    expect(updateSellerProductSchema.safeParse({ bulkTiers: [[1, 3]] }).success).toBe(false);
    expect(updateSellerProductSchema.safeParse({ bulkTiers: [[10, 0]] }).success).toBe(false);
    expect(updateSellerProductSchema.safeParse({ bulkTiers: [[10, 91]] }).success).toBe(false);
    expect(
      updateSellerProductSchema.safeParse({
        bulkTiers: [[2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1]],
      }).success,
    ).toBe(false);
  });
});
