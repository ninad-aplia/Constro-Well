// Deployment health check. Confirms the runtime can reach PostgreSQL too.
import { db } from "@/server/db";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", service: "constro-well", database: "ok" });
  } catch {
    return Response.json(
      { status: "degraded", service: "constro-well", database: "unavailable" },
      { status: 503 },
    );
  }
}
