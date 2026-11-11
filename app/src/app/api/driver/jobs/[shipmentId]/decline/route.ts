import { requireDriver } from "@/server/auth/current";
import { declineDriverJob } from "@/server/orders/driverService";
import { declineJobSchema, shipmentIdSchema } from "@/server/orders/driverValidation";
import { handleApi, parseJson } from "@/server/http";

export async function POST(
  req: Request,
  context: { params: Promise<{ shipmentId: string }> },
) {
  return handleApi(req, async () => {
    const { driver } = await requireDriver();
    const { shipmentId } = await context.params;
    const { reason } = await parseJson(req, declineJobSchema);
    return Response.json({
      job: await declineDriverJob(driver.id, shipmentIdSchema.parse(shipmentId), reason),
    });
  });
}
