import { cookies } from "next/headers";
import { requireCustomer } from "@/server/auth/current";
import { CART_COUPON_COOKIE, addCartItem } from "@/server/cart/service";
import { addCartItemSchema } from "@/server/cart/validation";
import { handleApi, parseJson } from "@/server/http";

export async function POST(req: Request) {
  return handleApi(req, async () => {
    const user = await requireCustomer();
    const input = await parseJson(req, addCartItemSchema);
    const coupon = (await cookies()).get(CART_COUPON_COOKIE)?.value ?? null;
    return Response.json({
      cart: await addCartItem(user.id, input.sellerOfferId, input.qty, coupon),
    });
  });
}
