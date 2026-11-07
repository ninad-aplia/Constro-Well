import { listProducts } from "@/server/catalog/service";
import { productListQuerySchema } from "@/server/catalog/validation";
import { handleApi } from "@/server/http";

export async function GET(req: Request) {
  return handleApi(req, async () => {
    const url = new URL(req.url);
    const query = productListQuerySchema.parse(Object.fromEntries(url.searchParams));
    return Response.json(await listProducts(query));
  });
}
