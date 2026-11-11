import { getCategories } from "@/lib/api/catalogDb";
import { handleApi } from "@/server/http";

export async function GET(req: Request) {
  return handleApi(req, async () => Response.json({ categories: await getCategories() }));
}
