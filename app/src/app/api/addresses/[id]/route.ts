import { requireCustomer } from "@/server/auth/current";
import { deleteAddress, updateAddress } from "@/server/orders/addresses";
import { addressIdSchema, updateAddressSchema } from "@/server/orders/validation";
import { handleApi, parseJson } from "@/server/http";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(req, async () => {
    const user = await requireCustomer();
    const { id } = await context.params;
    const addressId = addressIdSchema.parse(id);
    const input = await parseJson(req, updateAddressSchema);
    return Response.json({ address: await updateAddress(user.id, addressId, input) });
  });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(req, async () => {
    const user = await requireCustomer();
    const { id } = await context.params;
    await deleteAddress(user.id, addressIdSchema.parse(id));
    return Response.json({ ok: true });
  });
}
