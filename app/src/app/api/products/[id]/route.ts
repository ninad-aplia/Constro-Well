import { getProductById } from "@/server/catalog/service";
import { productIdParamSchema } from "@/server/catalog/validation";
import { handleApi } from "@/server/http";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(req, async () => {
    const { id } = await context.params;
    const productId = productIdParamSchema.parse(id);
    return Response.json({ product: await getProductById(productId) });
  });
}
