import { cookies } from "next/headers";
import { requireCustomer } from "@/server/auth/current";
import { CART_COUPON_COOKIE } from "@/server/cart/service";
import { listOrders, placeOrder } from "@/server/orders/service";
import { idempotencyKeySchema, placeOrderSchema } from "@/server/orders/validation";
import { handleApi, parseJson } from "@/server/http";

export async function GET(req: Request) {
  return handleApi(req, async () => {
    const user = await requireCustomer();
    return Response.json({ orders: await listOrders(user.id) });
  });
}

export async function POST(req: Request) {
  return handleApi(req, async () => {
    const user = await requireCustomer();
    const input = await parseJson(req, placeOrderSchema);
    const key = idempotencyKeySchema.parse(req.headers.get("idempotency-key") ?? "");
    const coupon = (await cookies()).get(CART_COUPON_COOKIE)?.value ?? null;
    const order = await placeOrder(user.id, input.addressId, coupon, key);
    (await cookies()).delete(CART_COUPON_COOKIE);
    return Response.json({ order }, { status: 201 });
  });
}
