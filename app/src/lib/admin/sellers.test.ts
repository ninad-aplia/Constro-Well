import { describe, expect, it } from "vitest";
import { ApiClientError } from "@/lib/api/client";
import { formatDateOnly, kycLabel, kycTone, sellerDetailError } from "./sellers";

describe("kycTone / kycLabel", () => {
  it("maps only the stored enum values and falls back neutrally", () => {
    expect(kycTone("verified")).toBe("ok");
    expect(kycTone("pending")).toBe("warn");
    expect(kycTone("anything-else")).toBe("neutral");
    expect(kycLabel("pending")).toBe("Pending");
  });
});

describe("formatDateOnly", () => {
  it("formats UTC dates and rejects malformed input", () => {
    expect(formatDateOnly("2026-11-10T14:30:00")).toMatch(/10 Nov 2026/);
    expect(formatDateOnly("2026-11-10T14:30:00Z")).toContain("Nov 2026");
    expect(formatDateOnly("nope")).toBe("—");
  });
});

describe("sellerDetailError", () => {
  it("classifies API errors for the detail page", () => {
    expect(sellerDetailError(new ApiClientError(401, "unauthenticated", "no"))).toBe("unauthorized");
    expect(sellerDetailError(new ApiClientError(403, "forbidden", "no"))).toBe("forbidden");
    expect(sellerDetailError(new ApiClientError(404, "seller_not_found", "no"))).toBe("not-found");
    expect(sellerDetailError(new ApiClientError(500, "internal_error", "no"))).toBe("failed");
    expect(sellerDetailError(new Error("network"))).toBe("failed");
  });
});
