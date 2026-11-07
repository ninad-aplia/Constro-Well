import { cookies } from "next/headers";
import { setSessionCookie } from "@/server/auth/current";
import { registerCustomer } from "@/server/auth/session";
import { CART_COUPON_COOKIE } from "@/server/cart/service";
import { registerSchema } from "@/server/auth/validation";
import { handleApi, parseJson } from "@/server/http";

export async function POST(req: Request) {
  return handleApi(req, async () => {
    const input = await parseJson(req, registerSchema);
    const { user, token } = await registerCustomer(input);
    await setSessionCookie(token);
    (await cookies()).delete(CART_COUPON_COOKIE);
    return Response.json({ user }, { status: 201 });
  });
}
