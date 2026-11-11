// Fallback/routing control for the catalogue cutover. These tests only cover
// the decision helper - the HTTP paths are exercised by the running app and by
// the FastAPI contract tests.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  catalogueApiEnabled,
  catalogueFallbackEnabled,
  fastApiBaseUrl,
  withCatalogueFallback,
} from "./catalogSource";

const ENV_KEYS = ["FASTAPI_BASE_URL", "CATALOG_SOURCE", "CATALOG_FALLBACK"];

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  vi.restoreAllMocks();
});

describe("catalogue source configuration", () => {
  it("is disabled when FASTAPI_BASE_URL is unset", () => {
    expect(catalogueApiEnabled()).toBe(false);
    expect(fastApiBaseUrl()).toBe("");
  });

  it("normalises the configured base url and honours the rollback switch", () => {
    process.env.FASTAPI_BASE_URL = "http://127.0.0.1:8000/";
    expect(fastApiBaseUrl()).toBe("http://127.0.0.1:8000");
    expect(catalogueApiEnabled()).toBe(true);

    process.env.CATALOG_SOURCE = "next";
    expect(catalogueApiEnabled()).toBe(false);
  });

  it("falls back unless CATALOG_FALLBACK=off", () => {
    expect(catalogueFallbackEnabled()).toBe(true);
    process.env.CATALOG_FALLBACK = "OFF";
    expect(catalogueFallbackEnabled()).toBe(false);
  });
});

describe("withCatalogueFallback", () => {
  it("uses the local implementation when FastAPI is not configured", async () => {
    const remote = vi.fn();
    const local = vi.fn().mockResolvedValue("next");

    await expect(withCatalogueFallback("list", remote, local)).resolves.toBe("next");
    expect(remote).not.toHaveBeenCalled();
    expect(local).toHaveBeenCalledOnce();
  });

  it("returns the FastAPI result without touching the local path", async () => {
    process.env.FASTAPI_BASE_URL = "http://127.0.0.1:8000";
    const remote = vi.fn().mockResolvedValue("fastapi");
    const local = vi.fn();

    await expect(withCatalogueFallback("list", remote, local)).resolves.toBe("fastapi");
    expect(local).not.toHaveBeenCalled();
  });

  it("falls back and logs only the label and error name, never the base url", async () => {
    process.env.FASTAPI_BASE_URL = "http://internal-api.local:8000";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const remote = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const local = vi.fn().mockResolvedValue("next");

    await expect(withCatalogueFallback("product list", remote, local)).resolves.toBe("next");
    expect(local).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();
    const logged = JSON.stringify(errorSpy.mock.calls[0]);
    expect(logged).toContain("product list");
    expect(logged).toContain("TypeError");
    expect(logged).not.toContain("internal-api.local");
  });

  it("surfaces the FastAPI error when the fallback is disabled", async () => {
    process.env.FASTAPI_BASE_URL = "http://127.0.0.1:8000";
    process.env.CATALOG_FALLBACK = "off";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new TypeError("fetch failed");
    const local = vi.fn();

    await expect(withCatalogueFallback("list", vi.fn().mockRejectedValue(error), local)).rejects.toBe(error);
    expect(local).not.toHaveBeenCalled();
  });
});
