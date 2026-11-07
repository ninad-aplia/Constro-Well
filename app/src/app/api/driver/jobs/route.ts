import { requireDriver } from "@/server/auth/current";
import { listDriverJobs } from "@/server/orders/driverService";
import { handleApi } from "@/server/http";

export async function GET(req: Request) {
  return handleApi(req, async () => {
    const { driver } = await requireDriver();
    return Response.json(await listDriverJobs(driver.id));
  });
}
