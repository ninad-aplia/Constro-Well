import { listCategories } from "@/server/catalog/service";
import { handleApi } from "@/server/http";

export async function GET(req: Request) {
  return handleApi(req, async () => Response.json({ categories: await listCategories() }));
}
