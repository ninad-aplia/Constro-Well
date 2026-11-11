import { requireCustomer } from "@/server/auth/current";
import { reportShipmentIssue } from "@/server/orders/service";
import { addressIdSchema, reportShipmentIssueSchema } from "@/server/orders/validation";
import { handleApi, parseJson } from "@/server/http";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string; shipmentId: string }> },
) {
  return handleApi(req, async () => {
    const user = await requireCustomer();
    const { id, shipmentId } = await context.params;
    const input = await parseJson(req, reportShipmentIssueSchema);
    return Response.json({
      order: await reportShipmentIssue(
        user.id,
        addressIdSchema.parse(id),
        addressIdSchema.parse(shipmentId),
        input,
      ),
    });
  });
}
