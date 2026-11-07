// Browser-friendly API client. Pass an absolute `baseUrl` when calling this
// from a Server Component; browser callers can leave it empty.
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field?: string;

  constructor(status: number, code: string, message: string, field?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; field?: string };
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  baseUrl = "",
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as (T & ErrorBody) | null;
  if (!response.ok) {
    const error = body?.error;
    throw new ApiClientError(
      response.status,
      error?.code ?? "request_failed",
      error?.message ?? "Request failed",
      error?.field,
    );
  }
  return body as T;
}

export function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
