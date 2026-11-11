import { requireCustomer } from "@/server/auth/current";
import { confirmShipmentDelivery } from "@/server/orders/service";
import { addressIdSchema } from "@/server/orders/validation";
import { handleApi } from "@/server/http";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string; shipmentId: string }> },
) {
  return handleApi(req, async () => {
    const user = await requireCustomer();
    const { id, shipmentId } = await context.params;
    return Response.json({
      order: await confirmShipmentDelivery(
        user.id,
        addressIdSchema.parse(id),
        addressIdSchema.parse(shipmentId),
      ),
    });
  });
}
