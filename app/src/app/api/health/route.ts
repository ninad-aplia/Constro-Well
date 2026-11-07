// Deployment health check. Intentionally independent of the database: the app
// runtime does not query Postgres yet (D14), so a DB failure must not make a
// page-serving instance look unhealthy.
export function GET() {
  return Response.json({ status: "ok", service: "constro-well" });
}
