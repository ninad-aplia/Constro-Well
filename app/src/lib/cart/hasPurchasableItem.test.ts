import { describe, expect, it } from "vitest";
import { hasPurchasableItem } from "./hasPurchasableItem";

describe("hasPurchasableItem", () => {
  it("is false for an empty cart", () => {
    expect(hasPurchasableItem([])).toBe(false);
  });

  it("is false when every item is unavailable", () => {
    expect(hasPurchasableItem([{ available: false }, { available: false }])).toBe(false);
  });

  it("is true when at least one item is available", () => {
    expect(hasPurchasableItem([{ available: false }, { available: true }])).toBe(true);
  });

  it("is true when every item is available", () => {
    expect(hasPurchasableItem([{ available: true }])).toBe(true);
  });
});
