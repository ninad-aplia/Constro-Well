import { requireSeller } from "@/server/auth/current";
import { packShipment } from "@/server/orders/sellerService";
import { shipmentIdSchema } from "@/server/orders/sellerValidation";
import { handleApi } from "@/server/http";

export async function POST(
  req: Request,
  context: { params: Promise<{ shipmentId: string }> },
) {
  return handleApi(req, async () => {
    const { seller } = await requireSeller();
    const { shipmentId } = await context.params;
    return Response.json({
      order: await packShipment(seller.id, shipmentIdSchema.parse(shipmentId)),
    });
  });
}
