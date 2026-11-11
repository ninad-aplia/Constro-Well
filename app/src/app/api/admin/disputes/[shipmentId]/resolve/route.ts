// BFF for admin dispute resolution. The browser's cw_session cookie is
// forwarded; FastAPI's require_admin remains the authorization boundary.
import { NextResponse, type NextRequest } from "next/server";

export async function POST(req: NextRequest, context: { params: Promise<{ shipmentId: string }> }) {
  const { shipmentId } = await context.params;
  const base = (process.env.FASTAPI_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) {
    return NextResponse.json(
      { error: { code: "backend_unavailable", message: "The admin service is not configured." } },
      { status: 503 },
    );
  }
  const cookie = req.cookies.get("cw_session")?.value;
  const body = await req.text();
  try {
    const response = await fetch(
      `${base}/api/admin/disputes/${encodeURIComponent(shipmentId)}/resolve`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(cookie ? { cookie: `cw_session=${cookie}` } : {}),
        },
        body,
        cache: "no-store",
      },
    );
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "backend_unreachable", message: "The admin service is unavailable." } },
      { status: 503 },
    );
  }
}
