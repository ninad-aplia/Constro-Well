import { requireSeller } from "@/server/auth/current";
import { updateSellerProduct } from "@/server/seller/inventory";
import { sellerOfferIdSchema, updateSellerProductSchema } from "@/server/seller/validation";
import { handleApi, parseJson } from "@/server/http";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ offerId: string }> },
) {
  return handleApi(req, async () => {
    const { seller } = await requireSeller();
    const { offerId } = await context.params;
    const id = sellerOfferIdSchema.parse(offerId);
    const input = await parseJson(req, updateSellerProductSchema);
    return Response.json({ product: await updateSellerProduct(seller.id, id, input) });
  });
}
