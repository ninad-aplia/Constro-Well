import { requireCustomer } from "@/server/auth/current";
import { createAddress, listAddresses } from "@/server/orders/addresses";
import { createAddressSchema } from "@/server/orders/validation";
import { handleApi, parseJson } from "@/server/http";

export async function GET(req: Request) {
  return handleApi(req, async () => {
    const user = await requireCustomer();
    return Response.json({ addresses: await listAddresses(user.id) });
  });
}

export async function POST(req: Request) {
  return handleApi(req, async () => {
    const user = await requireCustomer();
    const input = await parseJson(req, createAddressSchema);
    return Response.json({ address: await createAddress(user.id, input) }, { status: 201 });
  });
}
