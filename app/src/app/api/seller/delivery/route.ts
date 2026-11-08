import { requireSeller } from "@/server/auth/current";
import { getSellerDeliverySettings, updateDeliveryRules, updateDeliveryRulesSchema } from "@/server/seller/delivery";
import { handleApi, parseJson } from "@/server/http";

export async function GET(req: Request) {
  return handleApi(req, async () => {
    const { seller } = await requireSeller();
    return Response.json(await getSellerDeliverySettings(seller.id));
  });
}

export async function PATCH(req: Request) {
  return handleApi(req, async () => {
    const { seller } = await requireSeller();
    const input = await parseJson(req, updateDeliveryRulesSchema);
    return Response.json(await updateDeliveryRules(seller.id, input));
  });
}
