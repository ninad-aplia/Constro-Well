// Admin > Actor drill-down. Read-only investigation of one administrator's
// audit trail: profile, totals, most frequent actions and the latest events.
// The read is audited by FastAPI (`admin.actors.detail`), like every admin read.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/session";
import AdminNotice from "@/components/admin/AdminNotice";
import Card from "@/components/ui/Card";
import Pill from "@/components/ui/Pill";
import { auditActionLabel, formatAuditMetadata, formatAuditTime } from "@/lib/admin/activity";
import { actorActivityHref } from "@/lib/admin/actors";
import {
  AdminApiUnavailableError,
  ApiClientError,
  fetchAdminActor,
  type AdminActorDetail,
} from "@/lib/api/adminApi";

export const instant = false;

type Outcome =
  | { kind: "ok"; data: AdminActorDetail }
  | { kind: "unconfigured" }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "not-found" }
  | { kind: "failed" };

async function loadActor(id: string): Promise<Outcome> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { kind: "unauthorized" };
  try {
    return { kind: "ok", data: await fetchAdminActor(id, `${SESSION_COOKIE}=${token}`) };
  } catch (error) {
    if (error instanceof AdminApiUnavailableError) return { kind: "unconfigured" };
    if (error instanceof ApiClientError) {
      if (error.status === 401) return { kind: "unauthorized" };
      if (error.status === 403) return { kind: "forbidden" };
      if (error.status === 404) return { kind: "not-found" };
    }
    return { kind: "failed" };
  }
}

// One FastAPI read (and one audit row) per page view, shared with metadata.
const loadActorCached = cache(loadActor);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const outcome = await loadActorCached(id);
  if (outcome.kind === "not-found") notFound();
  return {
    title:
      outcome.kind === "ok"
        ? `${outcome.data.actor.name} - Admin - Constro Well`
        : "Administrator activity - Admin - Constro Well",
  };
}

function BackLink() {
  return (
    <Link
      href="/admin/activity"
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
    >
      ← Back to activity log
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card rounded="lg" className="grid gap-1 p-4">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <b className="font-display text-[22px] font-bold">{value}</b>
    </Card>
  );
}

export default async function AdminActorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const outcome = await loadActorCached(id);
  if (outcome.kind === "not-found") notFound();

  if (outcome.kind !== "ok") {
    const copy = {
      unconfigured: {
        title: "Admin service is not configured",
        body: "Set FASTAPI_BASE_URL on the server to connect the admin console. No fallback data is shown.",
      },
      unauthorized: {
        title: "Sign in required",
        body: "Your admin session has expired. Sign in again to view this administrator.",
      },
      forbidden: {
        title: "Administrator access required",
        body: "This account is not allowed to investigate administrators.",
      },
      failed: {
        title: "Administrator couldn't load",
        body: "The admin service is unavailable right now. Try again in a moment.",
      },
    }[outcome.kind];

    return (
      <div className="grid gap-4">
        <header>
          <h1 className="font-display text-2xl font-bold">Administrator activity</h1>
        </header>
        <AdminNotice
          title={copy.title}
          body={copy.body}
          action={
            <Link
              href={
                outcome.kind === "unauthorized"
                  ? "/login?next=/admin/activity"
                  : "/admin/activity"
              }
              className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
            >
              {outcome.kind === "unauthorized" ? "Sign in" : "Back to activity"}
            </Link>
          }
        />
      </div>
    );
  }

  const { actor, summary, actions, events } = outcome.data;

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <BackLink />
          <h1 className="mt-2 font-display text-2xl font-bold">{actor.name}</h1>
          <p className="text-sm text-muted" aria-live="polite">
            Administrator audit drill-down · {summary.totalEvents}{" "}
            {summary.totalEvents === 1 ? "recorded action" : "recorded actions"} across{" "}
            {summary.distinctActions} distinct action
            {summary.distinctActions === 1 ? "" : "s"}.
          </p>
        </div>
        <Link
          href={actorActivityHref(actor.id)}
          className="inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
        >
          Filter activity log
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.1fr_2fr]">
        <Card rounded="lg" className="p-[18px]">
          <h2 className="mb-2 font-display text-lg font-bold">Profile</h2>
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-muted">Name</dt>
              <dd className="font-semibold">{actor.name}</dd>
            </div>
            <div>
              <dt className="text-muted">Email</dt>
              <dd className="break-all font-semibold">{actor.email}</dd>
            </div>
            <div>
              <dt className="text-muted">Role</dt>
              <dd className="mt-0.5">
                <Pill tone="info">{actor.role}</Pill>
              </dd>
            </div>
            <div>
              <dt className="text-muted">Account created</dt>
              <dd className="font-semibold">{formatAuditTime(actor.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted">Actor ID</dt>
              <dd className="font-mono text-[12px] break-all text-muted">{actor.id}</dd>
            </div>
          </dl>
        </Card>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Stat label="Recorded actions" value={String(summary.totalEvents)} />
          <Stat label="Distinct action types" value={String(summary.distinctActions)} />
          <Stat label="First recorded" value={summary.firstSeen ? formatAuditTime(summary.firstSeen) : "-"} />
          <Stat label="Latest recorded" value={summary.lastSeen ? formatAuditTime(summary.lastSeen) : "-"} />
        </div>
      </div>

      <Card rounded="lg" className="p-[18px]">
        <h2 className="mb-2 font-display text-lg font-bold">Most frequent actions</h2>
        {actions.length === 0 ? (
          <p className="text-sm text-muted">No audit events recorded for this administrator yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th scope="col" className="px-3 py-2 font-semibold">Action</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Count</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((row) => (
                  <tr key={row.action} className="border-b border-line/70 last:border-0">
                    <td className="px-3 py-2.5">
                      <span className="block font-semibold">{auditActionLabel(row.action)}</span>
                      <span className="block font-mono text-[11px] text-muted">{row.action}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card rounded="lg" className="p-[18px]">
        <h2 className="mb-2 font-display text-lg font-bold">Latest activity</h2>
        <p className="mb-2 text-[13px] text-muted">
          Newest {events.length === 20 ? "20" : String(events.length)} events recorded by this
          administrator. The append-only log cannot be edited or deleted.
        </p>
        {events.length === 0 ? (
          <p className="text-sm text-muted">No activity has been recorded for this administrator.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th scope="col" className="px-3 py-2 font-semibold">When</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Action</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Target</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b border-line/70 last:border-0">
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted">
                      {formatAuditTime(event.createdAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block font-semibold">{auditActionLabel(event.action)}</span>
                      <span className="block font-mono text-[11px] text-muted">{event.action}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block">{event.targetType}</span>
                      <span className="block font-mono text-[11px] text-muted">
                        {event.targetId ?? "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted">
                      {formatAuditMetadata(event.metadata) || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
