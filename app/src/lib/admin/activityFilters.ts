// URL/date handling for the admin activity filters. URL params stay
// human-readable (YYYY-MM-DD); the FastAPI call converts them to UTC ISO
// boundaries (from inclusive, to exclusive = next day 00:00Z).

export interface ActivityFilters {
  action: string;
  actorId: string;
  from: string;
  to: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string | undefined): string {
  if (!value || !DATE.test(value)) return "";
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10) === value ? value : "";
}

export function parseActivityFilters(raw: {
  action?: string | string[];
  actorId?: string | string[];
  from?: string | string[];
  to?: string | string[];
}): ActivityFilters {
  const first = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] : value) ?? "";
  let from = validDate(first(raw.from));
  let to = validDate(first(raw.to));
  // A reversed or equal range is ignored rather than sent to the API.
  if (from && to && from >= to) {
    from = "";
    to = "";
  }
  return {
    action: first(raw.action).trim().slice(0, 100),
    actorId: first(raw.actorId).trim().slice(0, 100),
    from,
    to,
  };
}

export function hasActiveFilters(filters: ActivityFilters): boolean {
  return Boolean(filters.action || filters.actorId || filters.from || filters.to);
}

/** FastAPI boundaries: `from` at 00:00Z, `to` at the next day 00:00Z (exclusive). */
export function filterIso(filters: ActivityFilters): { from?: string; to?: string } {
  const result: { from?: string; to?: string } = {};
  if (filters.from) result.from = `${filters.from}T00:00:00Z`;
  if (filters.to) {
    const next = new Date(`${filters.to}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    result.to = next.toISOString();
  }
  return result;
}

export function activityHref(filters: ActivityFilters, page = 1): string {
  const query = new URLSearchParams();
  if (filters.action) query.set("action", filters.action);
  if (filters.actorId) query.set("actorId", filters.actorId);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return suffix ? `/admin/activity?${suffix}` : "/admin/activity";
}
