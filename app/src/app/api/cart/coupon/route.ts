import { cookies } from "next/headers";
import { requireCustomer } from "@/server/auth/current";
import {
  CART_COUPON_COOKIE,
  applyCoupon,
  getCart,
} from "@/server/cart/service";
import { couponSchema } from "@/server/cart/validation";
import { handleApi, parseJson } from "@/server/http";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60,
};

export async function POST(req: Request) {
  return handleApi(req, async () => {
    const user = await requireCustomer();
    const input = await parseJson(req, couponSchema);
    const cart = await applyCoupon(user.id, input.code);
    (await cookies()).set(CART_COUPON_COOKIE, input.code.trim().toUpperCase(), cookieOptions);
    return Response.json({ cart });
  });
}

export async function DELETE(req: Request) {
  return handleApi(req, async () => {
    const user = await requireCustomer();
    (await cookies()).delete(CART_COUPON_COOKIE);
    return Response.json({ cart: await getCart(user.id) });
  });
}
