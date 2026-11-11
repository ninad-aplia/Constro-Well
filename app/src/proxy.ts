// Real HTTP 404s for unknown admin seller/order IDs. Next.js fixes the status
// once the root loading boundary starts streaming, so a streamed notFound()
// would return 200. Proxy checks existence first via fast, non-auditing
// `/exists` endpoints and returns a self-contained 404 document. The pages
// themselves still perform the single audited read.
import { NextResponse, type NextRequest } from "next/server";

const SELLER_PATH = /^\/admin\/sellers\/([^/]+)$/;
const ORDER_PATH = /^\/admin\/orders\/([^/]+)$/;

function notFoundPage(
  title: string,
  message: string,
  backHref: string,
  backLabel: string,
): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${title} — Admin — Constro Well</title>
  </head>
  <body style="margin:0;background:#f2f4f7;color:#0b1f3a;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
    <main style="max-width:720px;margin:0 auto;padding:48px 20px">
      <a href="${backHref}" style="display:inline-block;padding:8px 12px;border:1px solid #d8dde6;border-radius:10px;background:#fff;color:#0b1f3a;text-decoration:none;font-size:13px;font-weight:600">← ${backLabel}</a>
      <section style="margin-top:16px;background:#fff;border:1px solid #d8dde6;border-radius:14px;padding:24px">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#5b6b82">Admin console</p>
        <h1 style="margin:0 0 8px;font-size:24px">${title}</h1>
        <p style="margin:0 0 16px;color:#5b6b82;font-size:14px">${message}</p>
        <a href="${backHref}" style="display:inline-block;padding:8px 14px;border-radius:10px;background:#ffc72c;color:#0b1f3a;text-decoration:none;font-size:13px;font-weight:700">${backLabel === "Back to sellers" ? "View all sellers" : "View all orders"}</a>
      </section>
    </main>
  </body>
</html>`;
}

async function exists(base: string, token: string, path: string): Promise<boolean | null> {
  try {
    const response = await fetch(`${base}${path}`, {
      headers: { cookie: `cw_session=${token}` },
      cache: "no-store",
    });
    if (response.status === 404) return false;
    if (response.ok) return true;
    return null; // 401/403/5xx: let the page/layout render the correct state
  } catch {
    return null; // backend unreachable: let the page render its honest error
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const sellerMatch = pathname.match(SELLER_PATH);
  const orderMatch = pathname.match(ORDER_PATH);
  if ((!sellerMatch && !orderMatch) || pathname.endsWith("/not-found")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("cw_session")?.value;
  const base = (process.env.FASTAPI_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!token || !base) return NextResponse.next();

  if (sellerMatch) {
    const found = await exists(base, token, `/api/admin/sellers/${encodeURIComponent(sellerMatch[1])}/exists`);
    if (found === false) {
      return new NextResponse(
        notFoundPage("Seller not found", "No seller exists with this ID. It may have been removed, or the link is wrong.", "/admin/sellers", "Back to sellers"),
        { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }
    return NextResponse.next();
  }

  const found = await exists(base, token, `/api/admin/orders/${encodeURIComponent(orderMatch![1])}/exists`);
  if (found === false) {
    return new NextResponse(
      notFoundPage("Order not found", "No order exists with this ID. It may have been removed, or the link is wrong.", "/admin/orders", "Back to orders"),
      { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/sellers/:path*", "/admin/orders/:path*"],
};
