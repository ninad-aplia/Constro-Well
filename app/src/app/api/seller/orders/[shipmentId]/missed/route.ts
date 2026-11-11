import { requireSeller } from "@/server/auth/current";
import { markShipmentMissed } from "@/server/orders/sellerService";
import { missedSchema, shipmentIdSchema } from "@/server/orders/sellerValidation";
import { handleApi, parseJson } from "@/server/http";

export async function POST(
  req: Request,
  context: { params: Promise<{ shipmentId: string }> },
) {
  return handleApi(req, async () => {
    const { seller } = await requireSeller();
    const { shipmentId } = await context.params;
    const input = await parseJson(req, missedSchema);
    return Response.json({
      order: await markShipmentMissed(seller.id, shipmentIdSchema.parse(shipmentId), input.reason),
    });
  });
}
