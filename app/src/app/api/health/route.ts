// Deployment health check. Confirms the runtime can reach PostgreSQL too.
import { db } from "@/server/db";

/** Keep the connection string out of logs even if a driver error echoes it. */
function redactConnectionString(message: string): string {
  const url = process.env.DATABASE_URL;
  return url ? message.split(url).join("[redacted]") : message;
}

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", service: "constro-well", database: "ok" });
  } catch (error) {
    const record = (typeof error === "object" && error !== null ? error : {}) as {
      name?: unknown;
      message?: unknown;
      code?: unknown;
    };
    console.error("[health] database check failed", {
      timestamp: new Date().toISOString(),
      name: typeof record.name === "string" ? record.name : "UnknownError",
      message: redactConnectionString(
        typeof record.message === "string" ? record.message : String(error),
      ),
      ...(typeof record.code === "string" ? { code: record.code } : {}),
    });
    return Response.json(
      { status: "degraded", service: "constro-well", database: "unavailable" },
      { status: 503 },
    );
  }
}
