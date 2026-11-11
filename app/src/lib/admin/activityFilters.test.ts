import { describe, expect, it } from "vitest";
import {
  activityHref,
  filterIso,
  hasActiveFilters,
  parseActivityFilters,
} from "./activityFilters";

describe("parseActivityFilters", () => {
  it("keeps valid values and drops malformed dates safely", () => {
    const filters = parseActivityFilters({
      action: "admin.users.list",
      actorId: " user-1 ",
      from: "2026-11-01",
      to: "not-a-date",
    });
    expect(filters).toEqual({
      action: "admin.users.list",
      actorId: "user-1",
      from: "2026-11-01",
      to: "",
    });
  });

  it("ignores reversed or equal date ranges", () => {
    expect(parseActivityFilters({ from: "2026-11-10", to: "2026-11-01" })).toMatchObject({ from: "", to: "" });
    expect(parseActivityFilters({ from: "2026-11-10", to: "2026-11-10" })).toMatchObject({ from: "", to: "" });
  });

  it("takes the first value of repeated params and caps lengths", () => {
    const filters = parseActivityFilters({ action: ["a", "b"], actorId: "x".repeat(150) });
    expect(filters.action).toBe("a");
    expect(filters.actorId).toHaveLength(100);
    expect(hasActiveFilters(filters)).toBe(true);
  });
});

describe("filterIso", () => {
  it("sends inclusive from and exclusive next-day to boundaries", () => {
    expect(filterIso({ action: "", actorId: "", from: "2026-11-01", to: "2026-11-10" })).toEqual({
      from: "2026-11-01T00:00:00Z",
      to: "2026-11-11T00:00:00.000Z",
    });
    expect(filterIso({ action: "", actorId: "", from: "", to: "" })).toEqual({});
  });
});

describe("activityHref", () => {
  it("serializes active filters and retains them on pagination", () => {
    const filters = { action: "admin.users.list", actorId: "", from: "2026-11-01", to: "" };
    expect(activityHref(filters, 1)).toBe("/admin/activity?action=admin.users.list&from=2026-11-01");
    expect(activityHref(filters, 3)).toBe(
      "/admin/activity?action=admin.users.list&from=2026-11-01&page=3",
    );
    expect(activityHref({ action: "", actorId: "", from: "", to: "" })).toBe("/admin/activity");
  });
});
