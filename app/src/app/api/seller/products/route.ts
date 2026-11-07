import { requireSeller } from "@/server/auth/current";
import {
  createSellerProduct,
  listSellerProducts,
} from "@/server/seller/inventory";
import { createSellerProductSchema } from "@/server/seller/validation";
import { handleApi, parseJson } from "@/server/http";

export async function GET(req: Request) {
  return handleApi(req, async () => {
    const { seller } = await requireSeller();
    return Response.json({ products: await listSellerProducts(seller.id) });
  });
}

export async function POST(req: Request) {
  return handleApi(req, async () => {
    const { seller } = await requireSeller();
    const input = await parseJson(req, createSellerProductSchema);
    const product = await createSellerProduct(seller, input);
    return Response.json({ product }, { status: 201 });
  });
}
