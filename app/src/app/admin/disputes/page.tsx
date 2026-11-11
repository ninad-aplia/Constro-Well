// Admin > Disputes. Read-only queue of open delivery disputes (ShipmentIssue
// with Shipment.status='disputed'), fed by the audited FastAPI admin endpoint.
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/session";
import AdminNotice from "@/components/admin/AdminNotice";
import Pill from "@/components/ui/Pill";
import { formatDateOnly } from "@/lib/admin/sellers";
import { ADMIN_PAGE_SIZE, disputesHref, listPageState, pageWindow, parseAdminPage } from "@/lib/admin/pagination";
import {
  AdminApiUnavailableError,
  ApiClientError,
  fetchAdminDisputes,
  type AdminDisputesResponse,
} from "@/lib/api/adminApi";

export const metadata: Metadata = { title: "Disputes - Admin - Constro Well" };
export const instant = false;

type Outcome =
  | { kind: "ok"; data: AdminDisputesResponse }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "unconfigured" }
  | { kind: "failed" };

async function loadDisputes(page: number): Promise<Outcome> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { kind: "unauthorized" };
  try {
    return {
      kind: "ok",
      data: await fetchAdminDisputes(page, ADMIN_PAGE_SIZE, `${SESSION_COOKIE}=${token}`),
    };
  } catch (error) {
    if (error instanceof AdminApiUnavailableError) return { kind: "unconfigured" };
    if (error instanceof ApiClientError) {
      if (error.status === 401) return { kind: "unauthorized" };
      if (error.status === 403) return { kind: "forbidden" };
    }
    return { kind: "failed" };
  }
}

const COD_TONES: Record<string, "ok" | "warn" | "bad" | "neutral"> = {
  confirmed: "ok",
  pending: "warn",
  disputed: "bad",
  cancelled: "neutral",
};

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  const page = parseAdminPage(params.page);
  const outcome = await loadDisputes(page);

  if (outcome.kind !== "ok") {
    const copy = {
      unauthorized: { title: "Sign in required", body: "Your admin session has expired. Sign in again to view disputes." },
      forbidden: { title: "Administrator access required", body: "This account is not allowed to view disputes." },
      unconfigured: { title: "Admin service is not configured", body: "Set FASTAPI_BASE_URL on the server to connect the admin console." },
      failed: { title: "Disputes couldn't load", body: "The admin service is unavailable right now. Try again in a moment." },
    }[outcome.kind];
    return (
      <div className="grid gap-4">
        <h1 className="font-display text-2xl font-bold">Disputes</h1>
        <AdminNotice
          title={copy.title}
          body={copy.body}
          action={
            <Link
              href={outcome.kind === "unauthorized" ? "/login?next=/admin/disputes" : "/admin/disputes"}
              className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
            >
              {outcome.kind === "unauthorized" ? "Sign in" : "Try again"}
            </Link>
          }
        />
      </div>
    );
  }

  const { disputes, pagination } = outcome.data;
  const state = listPageState(pagination.page, pagination.total, pagination.totalPages);
  const pages = pageWindow(pagination.page, pagination.totalPages);

  return (
    <div className="grid gap-4">
      <header>
        <h1 className="font-display text-2xl font-bold">Disputes</h1>
        <p className="text-sm text-muted" aria-live="polite">
          {state.kind === "empty"
            ? "No open delivery disputes."
            : state.kind === "out-of-range"
              ? `Requested page ${state.requestedPage} is outside the available range (1-${state.totalPages}); ${pagination.total} disputes in total.`
              : `${pagination.total} open ${pagination.total === 1 ? "dispute" : "disputes"} - full, partial or rejected resolutions are allowed once COD is confirmed.`}
        </p>
      </header>

      {disputes.length === 0 ? (
        <section className="rounded-xl border border-line bg-panel px-5 py-12 text-center">
          <h2 className="font-display text-lg font-bold">No open disputes</h2>
          <p className="mt-1 text-sm text-muted">Short-quantity and customer-reported damaged-goods disputes appear here.</p>
        </section>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                {["Shipment", "Order", "Seller", "Customer", "Issue", "Claim", "COD", "Opened", ""].map((label) => (
                  <th key={label} className="px-3 py-2.5 font-semibold">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {disputes.map((row) => (
                <tr key={row.shipmentId} className="border-b border-line/70 last:border-0 hover:bg-tint/60">
                  <td className="px-3 py-3">
                    <b>{row.shipmentCode}</b>
                    <span className="block font-mono text-[11px] text-muted">{row.shipmentId}</span>
                  </td>
                  <td className="px-3 py-3">{row.orderCode}</td>
                  <td className="px-3 py-3">{row.sellerName}</td>
                  <td className="px-3 py-3">{row.customerName}</td>
                  <td className="px-3 py-3">
                    <span className="block font-semibold capitalize">{row.issueType.replaceAll("_", " ")}</span>
                    <span className="block text-[12px] text-muted">{row.auto ? "System-opened" : "Customer-reported"}</span>
                  </td>
                  <td className="px-3 py-3 text-right">{row.claim ? `₹${row.claim}` : "—"}</td>
                  <td className="px-3 py-3">
                    {row.codStatus ? <Pill tone={COD_TONES[row.codStatus] ?? "neutral"}>{row.codStatus}</Pill> : "—"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-muted">{formatDateOnly(row.createdAt)}</td>
                  <td className="px-3 py-3 text-right">
                    <Link href={`/admin/disputes/${row.shipmentId}`} className="text-[13px] font-semibold text-link hover:underline">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {state.kind === "page" && pagination.totalPages > 1 && (
        <nav aria-label="Dispute pages" className="flex flex-wrap items-center justify-center gap-1.5">
          <Link
            href={disputesHref(Math.max(1, pagination.page - 1))}
            aria-disabled={pagination.page <= 1}
            tabIndex={pagination.page <= 1 ? -1 : undefined}
            className={`inline-flex min-h-8 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold ${pagination.page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-tint"}`}
          >
            Previous
          </Link>
          {pages.map((n) => (
            <Link
              key={n}
              href={disputesHref(n)}
              aria-current={pagination.page === n ? "page" : undefined}
              className={`inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[13px] font-semibold ${pagination.page === n ? "border-nav bg-nav text-white" : "border-line bg-panel hover:bg-tint"}`}
            >
              {n}
            </Link>
          ))}
          <Link
            href={disputesHref(Math.min(pagination.totalPages, pagination.page + 1))}
            aria-disabled={pagination.page >= pagination.totalPages}
            tabIndex={pagination.page >= pagination.totalPages ? -1 : undefined}
            className={`inline-flex min-h-8 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold ${pagination.page >= pagination.totalPages ? "pointer-events-none opacity-50" : "hover:bg-tint"}`}
          >
            Next
          </Link>
        </nav>
      )}
    </div>
  );
}
