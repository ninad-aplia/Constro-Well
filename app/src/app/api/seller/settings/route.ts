import { requireSeller } from "@/server/auth/current";
import { getSellerProfile, updateSellerProfile, updateSellerProfileSchema } from "@/server/seller/profile";
import { handleApi, parseJson } from "@/server/http";

export async function GET(req: Request) {
  return handleApi(req, async () => {
    const { seller } = await requireSeller();
    return Response.json({ profile: await getSellerProfile(seller.id) });
  });
}

export async function PATCH(req: Request) {
  return handleApi(req, async () => {
    const { seller } = await requireSeller();
    const input = await parseJson(req, updateSellerProfileSchema);
    return Response.json({ profile: await updateSellerProfile(seller.id, input) });
  });
}
