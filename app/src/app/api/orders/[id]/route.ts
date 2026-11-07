import { requireCustomer } from "@/server/auth/current";
import { getOrder } from "@/server/orders/service";
import { addressIdSchema } from "@/server/orders/validation";
import { handleApi } from "@/server/http";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(req, async () => {
    const user = await requireCustomer();
    const { id } = await context.params;
    return Response.json({ order: await getOrder(user.id, addressIdSchema.parse(id)) });
  });
}
