import { describe, expect, it } from "vitest";
import { barPercent, dayLabel, maxCount } from "./overview";

describe("overview helpers", () => {
  it("never divides by zero and keeps a visible minimum for non-zero values", () => {
    expect(barPercent(0, 0)).toBe(0);
    expect(barPercent(3, 0)).toBe(0);
    expect(barPercent(0, 10)).toBe(0);
    expect(barPercent(1, 1000)).toBe(2);
    expect(barPercent(5, 10)).toBe(50);
    expect(barPercent(10, 10)).toBe(100);
  });

  it("finds the chart maximum safely", () => {
    expect(maxCount([])).toBe(0);
    expect(maxCount([{ count: 2 }, { count: 9 }, { count: 0 }])).toBe(9);
  });

  it("labels day buckets without timezone conversion", () => {
    expect(dayLabel("2026-11-10")).toBe("10/11");
    expect(dayLabel("bad")).toBe("bad");
  });
});
