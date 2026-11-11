// Activity log table: append-only audit rows, server-rendered.
import Link from "next/link";
import { auditActionLabel, formatAuditMetadata, formatAuditTime } from "@/lib/admin/activity";
import { actorHref } from "@/lib/admin/actors";
import type { AuditEventRecord } from "@/lib/api/adminApi";

export default function AdminAuditTable({
  events,
  total,
  filtered = false,
}: {
  events: AuditEventRecord[];
  total: number;
  filtered?: boolean;
}) {
  if (events.length === 0) {
    const emptyLog = total === 0 && !filtered;
    const noMatch = filtered;
    return (
      <section className="grid justify-items-center gap-2 rounded-xl border border-line bg-panel px-5 py-12 text-center">
        <h2 className="font-display text-lg font-bold">
          {noMatch ? "No events match these filters" : emptyLog ? "No activity recorded yet" : "No activity on this page"}
        </h2>
        <p className="text-sm text-muted">
          {noMatch
            ? "Adjust the action, administrator or date range, or clear the filters."
            : emptyLog
              ? "Administrative actions will appear here once they are performed."
              : "The requested page is beyond the end of the log."}
        </p>
        <Link
          href="/admin/activity"
          className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
        >
          {noMatch ? "Clear filters" : "Back to latest activity"}
        </Link>
      </section>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <caption className="sr-only">Administrative activity log, newest first</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="px-4 py-2.5 font-semibold">When</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Administrator</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Action</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Target</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Details</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const details = formatAuditMetadata(event.metadata);
            return (
              <tr key={event.id} className="border-b border-line/70 last:border-0 hover:bg-tint/60">
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {formatAuditTime(event.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <Link href={actorHref(event.actor.id)} className="block font-semibold hover:underline">
                    {event.actor.name}
                  </Link>
                  <span className="block font-mono text-[11px] text-muted">{event.actor.id}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="block font-semibold">{auditActionLabel(event.action)}</span>
                  <span className="block font-mono text-[11px] text-muted">{event.action}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="block">{event.targetType}</span>
                  <span className="block font-mono text-[11px] text-muted">
                    {event.targetId ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{details || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
