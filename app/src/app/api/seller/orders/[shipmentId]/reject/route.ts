import { requireSeller } from "@/server/auth/current";
import { rejectShipment } from "@/server/orders/sellerService";
import { rejectSchema, shipmentIdSchema } from "@/server/orders/sellerValidation";
import { handleApi, parseJson } from "@/server/http";

export async function POST(
  req: Request,
  context: { params: Promise<{ shipmentId: string }> },
) {
  return handleApi(req, async () => {
    const { seller } = await requireSeller();
    const { shipmentId } = await context.params;
    const input = await parseJson(req, rejectSchema);
    return Response.json({
      order: await rejectShipment(seller.id, shipmentIdSchema.parse(shipmentId), input.reason),
    });
  });
}
