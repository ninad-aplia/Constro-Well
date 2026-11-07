import { cookies } from "next/headers";
import { requireCustomer } from "@/server/auth/current";
import { CART_COUPON_COOKIE } from "@/server/cart/service";
import { checkoutPreviewSchema } from "@/server/orders/validation";
import { previewCheckout } from "@/server/orders/service";
import { handleApi, parseJson } from "@/server/http";

export async function POST(req: Request) {
  return handleApi(req, async () => {
    const user = await requireCustomer();
    const input = await parseJson(req, checkoutPreviewSchema);
    const coupon = (await cookies()).get(CART_COUPON_COOKIE)?.value ?? null;
    return Response.json({ preview: await previewCheckout(user.id, input.addressId, coupon) });
  });
}
