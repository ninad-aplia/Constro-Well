import { cookies } from "next/headers";
import { requireCustomer } from "@/server/auth/current";
import { CART_COUPON_COOKIE, getCart } from "@/server/cart/service";
import { handleApi } from "@/server/http";

export async function GET(req: Request) {
  return handleApi(req, async () => {
    const user = await requireCustomer();
    const coupon = (await cookies()).get(CART_COUPON_COOKIE)?.value ?? null;
    return Response.json({ cart: await getCart(user.id, coupon) });
  });
}
