import { requireCustomer } from "@/server/auth/current";
import { cancelOrder } from "@/server/orders/service";
import { addressIdSchema, cancelOrderSchema } from "@/server/orders/validation";
import { handleApi, parseJson } from "@/server/http";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(req, async () => {
    const user = await requireCustomer();
    const { id } = await context.params;
    const input = await parseJson(req, cancelOrderSchema);
    return Response.json({
      order: await cancelOrder(user.id, addressIdSchema.parse(id), input.reason),
    });
  });
}
