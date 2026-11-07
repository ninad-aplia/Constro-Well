import { requireDriver } from "@/server/auth/current";
import { deliverDriverShipment } from "@/server/orders/driverService";
import { deliverSchema, shipmentIdSchema } from "@/server/orders/driverValidation";
import { handleApi, parseJson } from "@/server/http";

export async function POST(
  req: Request,
  context: { params: Promise<{ shipmentId: string }> },
) {
  return handleApi(req, async () => {
    const { driver } = await requireDriver();
    const { shipmentId } = await context.params;
    const input = await parseJson(req, deliverSchema);
    return Response.json({
      job: await deliverDriverShipment(driver.id, shipmentIdSchema.parse(shipmentId), input),
    });
  });
}
