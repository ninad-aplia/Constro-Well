import { requireSeller } from "@/server/auth/current";
import { updateSellerStock } from "@/server/seller/inventory";
import { sellerOfferIdSchema, updateSellerStockSchema } from "@/server/seller/validation";
import { handleApi, parseJson } from "@/server/http";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ offerId: string }> },
) {
  return handleApi(req, async () => {
    const { seller } = await requireSeller();
    const { offerId } = await context.params;
    const id = sellerOfferIdSchema.parse(offerId);
    const input = await parseJson(req, updateSellerStockSchema);
    return Response.json({
      product: await updateSellerStock(seller.id, id, input.stock),
    });
  });
}
