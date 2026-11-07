import { cookies } from "next/headers";
import { requireCustomer } from "@/server/auth/current";
import {
  CART_COUPON_COOKIE,
  removeCartItem,
  updateCartItem,
} from "@/server/cart/service";
import { cartItemIdSchema, updateCartItemSchema } from "@/server/cart/validation";
import { handleApi, parseJson } from "@/server/http";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  return handleApi(req, async () => {
    const user = await requireCustomer();
    const { itemId } = await context.params;
    const id = cartItemIdSchema.parse(itemId);
    const input = await parseJson(req, updateCartItemSchema);
    const coupon = (await cookies()).get(CART_COUPON_COOKIE)?.value ?? null;
    return Response.json({ cart: await updateCartItem(user.id, id, input, coupon) });
  });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  return handleApi(req, async () => {
    const user = await requireCustomer();
    const { itemId } = await context.params;
    const id = cartItemIdSchema.parse(itemId);
    const coupon = (await cookies()).get(CART_COUPON_COOKIE)?.value ?? null;
    return Response.json({ cart: await removeCartItem(user.id, id, coupon) });
  });
}
