import { requireUser } from "@/server/auth/current";
import { toPublicUser } from "@/server/auth/session";
import { handleApi } from "@/server/http";

export async function GET(req: Request) {
  return handleApi(req, async () => {
    const user = await requireUser();
    return Response.json({ user: toPublicUser(user) });
  });
}
