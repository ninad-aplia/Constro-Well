import { requireSeller } from "@/server/auth/current";
import { getSellerShipment } from "@/server/orders/sellerService";
import { shipmentIdSchema } from "@/server/orders/sellerValidation";
import { handleApi } from "@/server/http";

export async function GET(
  req: Request,
  context: { params: Promise<{ shipmentId: string }> },
) {
  return handleApi(req, async () => {
    const { seller } = await requireSeller();
    const { shipmentId } = await context.params;
    return Response.json({
      order: await getSellerShipment(seller.id, shipmentIdSchema.parse(shipmentId)),
    });
  });
}
