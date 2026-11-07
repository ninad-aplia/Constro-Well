import { cookies } from "next/headers";
import { destroyCurrentSession } from "@/server/auth/current";
import { CART_COUPON_COOKIE } from "@/server/cart/service";
import { handleApi } from "@/server/http";

export async function POST(req: Request) {
  return handleApi(req, async () => {
    await destroyCurrentSession();
    (await cookies()).delete(CART_COUPON_COOKIE);
    return Response.json({ ok: true });
  });
}
