// Pure helpers for the admin users route: query-string parsing and pagination
// windowing. Kept free of React/Next so they are unit-testable.

export const ADMIN_PAGE_SIZE = 20;

/** Unknown, malformed or out-of-range page input falls back to page 1. */
export function parseAdminPage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10_000) return 1;
  return parsed;
}

export function adminUsersHref(page: number): string {
  return page <= 1 ? "/admin/users" : `/admin/users?page=${page}`;
}

export function auditEventsHref(page: number): string {
  return page <= 1 ? "/admin/activity" : `/admin/activity?page=${page}`;
}

export function sellersHref(page: number): string {
  return page <= 1 ? "/admin/sellers" : `/admin/sellers?page=${page}`;
}

export function ordersHref(page: number): string {
  return page <= 1 ? "/admin/orders" : `/admin/orders?page=${page}`;
}

export function shipmentsHref(status: string, page: number): string {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return search ? `/admin/shipments?${search}` : "/admin/shipments";
}

export type ListPageState =
  | { kind: "empty" }
  | { kind: "out-of-range"; requestedPage: number; totalPages: number }
  | { kind: "page"; page: number; totalPages: number };

/**
 * Presentation state for the activity page. Keeps out-of-range and zero-record
 * requests from rendering contradictory text like "page 2 of 1"; the backend
 * contract (empty page, true total) is unchanged.
 */
export function listPageState(
  page: number,
  total: number,
  totalPages: number,
): ListPageState {
  if (total <= 0 || totalPages <= 0) return { kind: "empty" };
  if (page > totalPages) return { kind: "out-of-range", requestedPage: page, totalPages };
  return { kind: "page", page, totalPages };
}

/** At most five page numbers centred on the current page. */
export function pageWindow(page: number, totalPages: number): number[] {
  if (totalPages <= 0) return [];
  const size = Math.min(5, totalPages);
  let start = Math.max(1, page - Math.floor(size / 2));
  start = Math.min(start, Math.max(1, totalPages - size + 1));
  return Array.from({ length: size }, (_, index) => start + index);
}
