import { requireSeller } from "@/server/auth/current";
import { listSellerOrders } from "@/server/orders/sellerService";
import { handleApi } from "@/server/http";

export async function GET(req: Request) {
  return handleApi(req, async () => {
    const { seller } = await requireSeller();
    return Response.json(await listSellerOrders(seller.id));
  });
}
