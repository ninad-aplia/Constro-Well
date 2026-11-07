import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError, assertSameOrigin, handleApi, parseJson } from "./http";

function postRequest(
  origin?: string,
  extraHeaders: Record<string, string> = {},
  body?: unknown,
): Request {
  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: {
      ...(origin ? { origin } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...extraHeaders,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe("assertSameOrigin", () => {
  it("allows a same-origin mutation", () => {
    expect(() => assertSameOrigin(postRequest("http://localhost:3000"))).not.toThrow();
  });

  it("rejects a cross-origin mutation", () => {
    expect(() => assertSameOrigin(postRequest("http://evil.example"))).toThrow(ApiError);
  });

  it("rejects an explicit cross-site fetch even without Origin", () => {
    expect(() =>
      assertSameOrigin(postRequest(undefined, { "sec-fetch-site": "cross-site" })),
    ).toThrow(ApiError);
  });

  it("does not gate safe GET requests", () => {
    const req = new Request("http://localhost:3000/api/auth/me", {
      headers: { origin: "http://evil.example" },
    });
    expect(() => assertSameOrigin(req)).not.toThrow();
  });
});

describe("handleApi", () => {
  it("returns the standard error shape without leaking internals", async () => {
    const res = await handleApi(postRequest(), async () => {
      throw new ApiError(401, "unauthenticated", "Sign in to continue");
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "unauthenticated", message: "Sign in to continue" },
    });
    expect(JSON.stringify(body)).not.toContain("stack");
  });

  it("turns Zod validation failures into a 400", async () => {
    const schema = z.object({ name: z.string().min(2) }).strict();
    const req = postRequest(undefined, {}, { name: "x" });
    const res = await handleApi(req, async () => {
      await parseJson(req, schema);
      return Response.json({ ok: true });
    });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "validation_error", field: "name" },
    });
  });

  it("rejects malformed JSON with 400", async () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: "{",
    });
    await expect(parseJson(req, z.object({}))).rejects.toMatchObject({
      status: 400,
      code: "invalid_json",
    });
  });
});
