import { describe, expect, it } from "vitest";
import {
  listPageState,
  adminUsersHref,
  auditEventsHref,
  ordersHref,
  pageWindow,
  parseAdminPage,
  sellersHref,
} from "./pagination";

describe("parseAdminPage", () => {
  it("defaults to page 1 for missing or malformed input", () => {
    expect(parseAdminPage(undefined)).toBe(1);
    expect(parseAdminPage("")).toBe(1);
    expect(parseAdminPage("abc")).toBe(1);
    expect(parseAdminPage("0")).toBe(1);
    expect(parseAdminPage("-3")).toBe(1);
    expect(parseAdminPage("1.5")).toBe(1);
    expect(parseAdminPage("10001")).toBe(1);
  });

  it("accepts valid pages and the first value of a repeated param", () => {
    expect(parseAdminPage("2")).toBe(2);
    expect(parseAdminPage("10000")).toBe(10000);
    expect(parseAdminPage(["3", "4"])).toBe(3);
  });
});

describe("adminUsersHref", () => {
  it("omits the query string on page 1", () => {
    expect(adminUsersHref(1)).toBe("/admin/users");
    expect(adminUsersHref(4)).toBe("/admin/users?page=4");
    expect(auditEventsHref(1)).toBe("/admin/activity");
    expect(auditEventsHref(3)).toBe("/admin/activity?page=3");
    expect(sellersHref(1)).toBe("/admin/sellers");
    expect(sellersHref(2)).toBe("/admin/sellers?page=2");
    expect(ordersHref(1)).toBe("/admin/orders");
    expect(ordersHref(3)).toBe("/admin/orders?page=3");
  });
});

describe("pageWindow", () => {
  it("returns an empty window when there are no pages", () => {
    expect(pageWindow(1, 0)).toEqual([]);
  });

  it("clamps to the available range and always includes the current page", () => {
    expect(pageWindow(1, 2)).toEqual([1, 2]);
    expect(pageWindow(6, 10)).toEqual([4, 5, 6, 7, 8]);
    expect(pageWindow(10, 10)).toEqual([6, 7, 8, 9, 10]);
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("listPageState", () => {
  it("returns a normal page for a valid request", () => {
    expect(listPageState(2, 60, 3)).toEqual({ kind: "page", page: 2, totalPages: 3 });
  });

  it("returns a single-page state without change", () => {
    expect(listPageState(1, 8, 1)).toEqual({ kind: "page", page: 1, totalPages: 1 });
  });

  it("flags an out-of-range page instead of rendering page 2 of 1", () => {
    expect(listPageState(2, 8, 1)).toEqual({
      kind: "out-of-range",
      requestedPage: 2,
      totalPages: 1,
    });
  });

  it("treats zero records as empty without division or a page count", () => {
    expect(listPageState(1, 0, 0)).toEqual({ kind: "empty" });
    expect(listPageState(3, 0, 0)).toEqual({ kind: "empty" });
  });
});
