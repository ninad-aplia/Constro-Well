// Formatting helpers for the admin activity log.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** FastAPI serializes Prisma's naive UTC timestamps without an offset. */
function asUtc(iso: string): Date {
  const normalized = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  return new Date(normalized);
}

export function formatAuditTime(iso: string): string {
  const date = asUtc(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const time = date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${time}`;
}

/** Backend whitelists metadata keys; render primitives only. */
export function formatAuditMetadata(metadata: Record<string, string | number>): string {
  const entries = Object.entries(metadata).filter(
    ([key, value]) =>
      key.length <= 40 && (typeof value === "string" || typeof value === "number"),
  );
  return entries.map(([key, value]) => `${key} ${value}`).join(" · ");
}

const ACTION_LABELS: Record<string, string> = {
  "admin.users.list": "User overview viewed",
  "admin.audit_events.list": "Activity log viewed",
};

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}
