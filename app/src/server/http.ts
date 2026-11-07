// Shared API errors, body parsing, origin checks and error shaping.
// Every route handler uses `handleApi` so internal failures never leak
// database details or stack traces to the client.
import { z, ZodError } from "zod";
import { unstable_rethrow } from "next/navigation";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field?: string;

  constructor(status: number, code: string, message: string, field?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.field ? { field: error.field } : {}),
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = issue?.path.join(".");
    return Response.json(
      {
        error: {
          code: "validation_error",
          message: issue?.message ?? "Invalid request",
          ...(field ? { field } : {}),
        },
      },
      { status: 400 },
    );
  }

  // Server-side diagnostic only; no error detail is sent to the caller.
  console.error("[api] unhandled error:", error instanceof Error ? error.name : "unknown");
  return Response.json(
    { error: { code: "internal_error", message: "Something went wrong" } },
    { status: 500 },
  );
}

/**
 * CSRF defence for state-changing requests. SameSite=Lax already blocks most
 * cross-site form posts; this additionally rejects explicit cross-site
 * requests and origins that do not match this deployment.
 */
export function assertSameOrigin(req: Request): void {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;

  if (req.headers.get("sec-fetch-site") === "cross-site") {
    throw new ApiError(403, "forbidden_origin", "Cross-site request rejected");
  }

  const origin = req.headers.get("origin");
  // Non-browser clients (curl, integrations) often omit Origin; they are not
  // CSRF-capable because they do not automatically carry browser cookies.
  if (!origin) return;

  const allowed = new Set<string>();
  try {
    allowed.add(new URL(req.url).origin);
  } catch {
    // A malformed request URL cannot be trusted as an allowed origin.
  }

  const configured = process.env.APP_ORIGIN?.trim().replace(/\/$/, "");
  if (configured) allowed.add(configured);

  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    allowed.add(`${req.headers.get("x-forwarded-proto") ?? "https"}://${forwardedHost}`);
  }

  if (origin === "null" || !allowed.has(origin)) {
    throw new ApiError(403, "forbidden_origin", "Origin is not allowed");
  }
}

export async function parseJson<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON");
  }
  return schema.parse(body);
}

export async function handleApi(
  req: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    assertSameOrigin(req);
    return await handler();
  } catch (error) {
    // Let Next.js control-flow errors (dynamic rendering, redirects, notFound)
    // propagate instead of turning them into a generic 500.
    unstable_rethrow(error);
    return errorResponse(error);
  }
}
