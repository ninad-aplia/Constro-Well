import { requireSeller } from "@/server/auth/current";
import { addServiceArea, removeServiceArea, servicePinSchema } from "@/server/seller/delivery";
import { handleApi, parseJson } from "@/server/http";

export async function POST(req: Request) {
  return handleApi(req, async () => {
    const { seller } = await requireSeller();
    const { pin } = await parseJson(req, servicePinSchema);
    return Response.json(await addServiceArea(seller.id, pin), { status: 201 });
  });
}

export async function DELETE(req: Request) {
  return handleApi(req, async () => {
    const { seller } = await requireSeller();
    const { pin } = await parseJson(req, servicePinSchema);
    return Response.json(await removeServiceArea(seller.id, pin));
  });
}
