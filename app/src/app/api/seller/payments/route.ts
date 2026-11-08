import { requireSeller } from "@/server/auth/current";
import { sellerPaymentsSummary } from "@/server/orders/sellerService";
import { handleApi } from "@/server/http";

export async function GET(req: Request) {
  return handleApi(req, async () => {
    const { seller } = await requireSeller();
    return Response.json(await sellerPaymentsSummary(seller.id));
  });
}
