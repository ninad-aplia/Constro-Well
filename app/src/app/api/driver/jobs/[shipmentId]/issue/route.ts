import { requireDriver } from "@/server/auth/current";
import { reportDriverIssue } from "@/server/orders/driverService";
import { issueSchema, shipmentIdSchema } from "@/server/orders/driverValidation";
import { handleApi, parseJson } from "@/server/http";

export async function POST(
  req: Request,
  context: { params: Promise<{ shipmentId: string }> },
) {
  return handleApi(req, async () => {
    const { driver } = await requireDriver();
    const { shipmentId } = await context.params;
    const input = await parseJson(req, issueSchema);
    return Response.json({
      job: await reportDriverIssue(driver.id, shipmentIdSchema.parse(shipmentId), input),
    });
  });
}
