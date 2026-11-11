import { describe, expect, it } from "vitest";
import { actorActivityHref, actorHref } from "./actors";

describe("admin actor links", () => {
  it("builds the detail route and encodes the id", () => {
    expect(actorHref("usr_123")).toBe("/admin/actors/usr_123");
    expect(actorHref("a/b c")).toBe("/admin/actors/a%2Fb%20c");
  });

  it("builds the actor-filtered activity route", () => {
    expect(actorActivityHref("usr_123")).toBe("/admin/activity?actorId=usr_123");
    expect(actorActivityHref("a/b c")).toBe("/admin/activity?actorId=a%2Fb%20c");
  });
});
