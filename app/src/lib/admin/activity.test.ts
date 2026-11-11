import { describe, expect, it } from "vitest";
import { auditActionLabel, formatAuditMetadata, formatAuditTime } from "./activity";

describe("formatAuditTime", () => {
  it("treats naive timestamps as UTC and renders a readable date/time", () => {
    expect(formatAuditTime("2026-11-10T14:30:00")).toMatch(/^10 Nov 2026, \d{1,2}:\d{2} [ap]m$/);
  });

  it("accepts explicit offsets and rejects malformed values", () => {
    expect(formatAuditTime("2026-11-10T14:30:00Z")).toContain("Nov 2026");
    expect(formatAuditTime("not-a-date")).toBe("—");
  });
});

describe("formatAuditMetadata", () => {
  it("renders only primitive entries as compact text", () => {
    expect(formatAuditMetadata({ page: 2, pageSize: 20, total: 91 })).toBe(
      "page 2 · pageSize 20 · total 91",
    );
    expect(formatAuditMetadata({})).toBe("");
  });
});

describe("auditActionLabel", () => {
  it("maps known actions and falls back to the raw identifier", () => {
    expect(auditActionLabel("admin.users.list")).toBe("User overview viewed");
    expect(auditActionLabel("admin.sellers.verify")).toBe("admin.sellers.verify");
  });
});
