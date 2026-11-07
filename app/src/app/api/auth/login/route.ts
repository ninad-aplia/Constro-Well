import { cookies } from "next/headers";
import { setSessionCookie } from "@/server/auth/current";
import { authenticateUser, createSession, toPublicUser } from "@/server/auth/session";
import { CART_COUPON_COOKIE } from "@/server/cart/service";
import { loginSchema } from "@/server/auth/validation";
import { ApiError, handleApi, parseJson } from "@/server/http";

export async function POST(req: Request) {
  return handleApi(req, async () => {
    const input = await parseJson(req, loginSchema);
    const user = await authenticateUser(input.email, input.password);
    if (!user) {
      throw new ApiError(401, "invalid_credentials", "Email or password is incorrect");
    }
    const { token } = await createSession(user.id);
    await setSessionCookie(token);
    (await cookies()).delete(CART_COUPON_COOKIE);
    return Response.json({ user: toPublicUser(user) });
  });
}
