// Admin > Activity log. Server-rendered from FastAPI `/api/admin/audit-events`
// with the existing `cw_session` cookie forwarded server-side. Filters are
// applied in SQL by the API and kept in the URL; no client-side filtering.
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/session";
import AdminAuditTable from "@/components/admin/AdminAuditTable";
import AdminNotice from "@/components/admin/AdminNotice";
import {
  activityHref,
  filterIso,
  hasActiveFilters,
  parseActivityFilters,
  type ActivityFilters,
} from "@/lib/admin/activityFilters";
import { ADMIN_PAGE_SIZE, listPageState, parseAdminPage, pageWindow } from "@/lib/admin/pagination";
import {
  AdminApiUnavailableError,
  ApiClientError,
  fetchAuditEvents,
  fetchAuditFilterOptions,
  type AuditEventsResponse,
  type AuditFilterOptions,
} from "@/lib/api/adminApi";

export const metadata: Metadata = {
  title: "Activity log — Admin — Constro Well",
};

export const instant = false;

type LoadOutcome =
  | { kind: "ok"; data: AuditEventsResponse }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "unconfigured" }
  | { kind: "failed" };

async function loadEvents(page: number, filters: ActivityFilters): Promise<LoadOutcome> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { kind: "unauthorized" };
  try {
    const data = await fetchAuditEvents(
      page,
      ADMIN_PAGE_SIZE,
      `${SESSION_COOKIE}=${token}`,
      filterIso(filters),
    );
    return { kind: "ok", data };
  } catch (error) {
    if (error instanceof AdminApiUnavailableError) return { kind: "unconfigured" };
    if (error instanceof ApiClientError) {
      if (error.status === 401) return { kind: "unauthorized" };
      if (error.status === 403) return { kind: "forbidden" };
    }
    return { kind: "failed" };
  }
}

/** Filter choices are helpful, not required: failure leaves empty selects. */
async function loadOptions(): Promise<AuditFilterOptions> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { actions: [], actors: [] };
  try {
    return await fetchAuditFilterOptions(`${SESSION_COOKIE}=${token}`);
  } catch {
    return { actions: [], actors: [] };
  }
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    action?: string | string[];
    actorId?: string | string[];
    from?: string | string[];
    to?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const page = parseAdminPage(params.page);
  const filters = parseActivityFilters(params);
  const filtered = hasActiveFilters(filters);
  const [outcome, options] = await Promise.all([loadEvents(page, filters), loadOptions()]);

  if (outcome.kind !== "ok") {
    const copy = {
      unauthorized: {
        title: "Sign in required",
        body: "Your admin session has expired. Sign in again to view the activity log.",
      },
      forbidden: {
        title: "Administrator access required",
        body: "This account is not allowed to view the activity log.",
      },
      unconfigured: {
        title: "Admin service is not configured",
        body: "Set FASTAPI_BASE_URL on the server to connect the admin console. No fallback data is shown.",
      },
      failed: {
        title: "Activity couldn't load",
        body: "The admin service is unavailable right now. Try again in a moment.",
      },
    }[outcome.kind];

    return (
      <div className="grid gap-4">
        <header>
          <h1 className="font-display text-2xl font-bold">Activity log</h1>
        </header>
        <AdminNotice
          title={copy.title}
          body={copy.body}
          action={
            <Link
              href={
                outcome.kind === "unauthorized"
                  ? "/login?next=/admin/activity"
                  : activityHref(filters, page)
              }
              className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
            >
              {outcome.kind === "unauthorized" ? "Sign in" : "Try again"}
            </Link>
          }
        />
      </div>
    );
  }

  const { events, pagination } = outcome.data;
  const state = listPageState(pagination.page, pagination.total, pagination.totalPages);
  const pages = pageWindow(pagination.page, pagination.totalPages);

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Activity log</h1>
          <p className="text-sm text-muted" aria-live="polite">
            {state.kind === "empty"
              ? filtered
                ? "No audit entries match the selected filters."
                : "No activity recorded yet. Entries are append-only once written."
              : state.kind === "out-of-range"
                ? `Requested page ${state.requestedPage} is outside the available range (1–${state.totalPages}); ${pagination.total} ${pagination.total === 1 ? "entry" : "entries"} in total. Use the link below to return to the latest page.`
                : `${pagination.total} ${pagination.total === 1 ? "entry" : "entries"} · page ${state.page} of ${state.totalPages} · ${filtered ? "filtered view" : "entries cannot be changed or deleted"}`}
          </p>
        </div>
      </header>

      <form
        method="get"
        action="/admin/activity"
        className="grid gap-2.5 rounded-xl border border-line bg-panel p-[18px] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_150px_150px_auto]"
        aria-label="Filter activity"
      >
        <label className="grid gap-1 text-xs font-semibold text-muted">
          Action
          <select
            name="action"
            defaultValue={filters.action}
            className="h-9 rounded-lg border border-line bg-bg px-2 text-[13px] font-normal text-ink"
          >
            <option value="">All actions</option>
            {options.actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs font-semibold text-muted">
          Administrator
          <select
            name="actorId"
            defaultValue={filters.actorId}
            className="h-9 rounded-lg border border-line bg-bg px-2 text-[13px] font-normal text-ink"
          >
            <option value="">All administrators</option>
            {options.actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs font-semibold text-muted">
          From
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className="h-9 rounded-lg border border-line bg-bg px-2 text-[13px] font-normal text-ink"
          />
        </label>

        <label className="grid gap-1 text-xs font-semibold text-muted">
          To
          <input
            type="date"
            name="to"
            defaultValue={filters.to}
            className="h-9 rounded-lg border border-line bg-bg px-2 text-[13px] font-normal text-ink"
          />
        </label>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-lg bg-hi px-3 text-[13px] font-semibold text-hiink hover:bg-hi2"
          >
            Apply
          </button>
          <Link
            href="/admin/activity"
            className="inline-flex h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
          >
            Clear
          </Link>
        </div>
      </form>

      {filtered && (
        <p className="text-xs text-muted" aria-live="polite">
          Filters: {filters.action ? `action ${filters.action}` : "any action"} ·{" "}
          {filters.actorId ? "selected administrator" : "any administrator"}
          {filters.from || filters.to
            ? ` · ${filters.from || "start"} → ${filters.to || "today"} (UTC)`
            : ""}
          . Date “To” is inclusive; the API receives the next day 00:00 UTC.
        </p>
      )}

      <AdminAuditTable events={events} total={pagination.total} filtered={filtered} />

      {state.kind === "page" && pagination.totalPages > 1 && (
        <nav aria-label="Activity pages" className="flex flex-wrap items-center justify-center gap-1.5">
          <Link
            href={activityHref(filters, Math.max(1, pagination.page - 1))}
            aria-disabled={pagination.page <= 1}
            tabIndex={pagination.page <= 1 ? -1 : undefined}
            className={`inline-flex min-h-8 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold ${
              pagination.page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-tint"
            }`}
          >
            Previous
          </Link>
          {pages.map((n) => (
            <Link
              key={n}
              href={activityHref(filters, n)}
              aria-current={pagination.page === n ? "page" : undefined}
              className={`inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[13px] font-semibold ${
                pagination.page === n
                  ? "border-nav bg-nav text-white"
                  : "border-line bg-panel hover:bg-tint"
              }`}
            >
              {n}
            </Link>
          ))}
          <Link
            href={activityHref(
              filters,
              Math.min(pagination.totalPages, pagination.page + 1),
            )}
            aria-disabled={pagination.page >= pagination.totalPages}
            tabIndex={pagination.page >= pagination.totalPages ? -1 : undefined}
            className={`inline-flex min-h-8 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold ${
              pagination.page >= pagination.totalPages
                ? "pointer-events-none opacity-50"
                : "hover:bg-tint"
            }`}
          >
            Next
          </Link>
        </nav>
      )}
    </div>
  );
}
