import { requireDriver } from "@/server/auth/current";
import { acceptDriverJob } from "@/server/orders/driverService";
import { shipmentIdSchema } from "@/server/orders/driverValidation";
import { handleApi } from "@/server/http";

export async function POST(
  req: Request,
  context: { params: Promise<{ shipmentId: string }> },
) {
  return handleApi(req, async () => {
    const { driver } = await requireDriver();
    const { shipmentId } = await context.params;
    return Response.json({
      job: await acceptDriverJob(driver.id, shipmentIdSchema.parse(shipmentId)),
    });
  });
}
