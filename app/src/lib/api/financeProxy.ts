// Thin BFF proxy for the FastAPI finance domain. The browser's `cw_session`
// cookie is forwarded so FastAPI's `require_seller` / `require_admin` stays the
// single authorization boundary (mirrors the Admin console's "FastAPI re-checks
// every request" principle). No financial logic lives here.
//
// `FINANCE_API_URL` is deliberately separate from `FASTAPI_BASE_URL`: setting
// that one also flips the catalogue read cutover (lib/api/catalogSource.ts),
// and the finance screens must not force a catalogue rollout. Operators who
// already set `FASTAPI_BASE_URL` still get finance via the fallback below.
import { NextRequest, NextResponse } from "next/server";

function baseUrl(): string {
  const configured = process.env.FINANCE_API_URL ?? process.env.FASTAPI_BASE_URL ?? "";
  return configured.trim().replace(/\/+$/, "");
}

export async function forwardFinance(
  req: NextRequest,
  segments: string[],
  prefix: "/api/seller/finance" | "/api/admin/finance",
): Promise<NextResponse> {
  const base = baseUrl();
  if (!base) {
    return NextResponse.json(
      { error: { code: "backend_unavailable", message: "The finance service is not configured." } },
      { status: 503 },
    );
  }

  const path = segments.map(encodeURIComponent).join("/");
  const url = `${base}${prefix}/${path}${req.nextUrl.search}`;

  const cookie = req.cookies.get("cw_session")?.value;
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = `cw_session=${cookie}`;

  const isBodyless = req.method === "GET" || req.method === "HEAD";
  const body = isBodyless ? undefined : await req.text().catch(() => "");
  if (body) headers["content-type"] = "application/json";

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers,
      body: body || undefined,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: { code: "backend_unavailable", message: "The finance service is unreachable." } },
      { status: 503 },
    );
  }

  const data = await upstream.json().catch(() => null);
  return NextResponse.json(data, { status: upstream.status });
}
