import { requireSeller } from "@/server/auth/current";
import { sellerSummary } from "@/server/orders/sellerService";
import { handleApi } from "@/server/http";

export async function GET(req: Request) {
  return handleApi(req, async () => {
    const { seller } = await requireSeller();
    return Response.json({ summary: await sellerSummary(seller.id) });
  });
}
