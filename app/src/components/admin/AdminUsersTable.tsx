// User overview table. Server-rendered, horizontal scroll on small screens,
// no client state. Shows only the fields the admin API returns.
import Link from "next/link";
import Pill from "@/components/ui/Pill";
import type { AdminUser } from "@/lib/api/adminApi";

const ROLE_TONE: Record<string, "neutral" | "ok" | "warn" | "info"> = {
  customer: "neutral",
  seller: "warn",
  driver: "ok",
  admin: "info",
};

function joined(iso: string): string {
  // FastAPI serializes Prisma's timestamp-without-timezone values (UTC) without
  // an offset; treat them as UTC so the displayed day matches the database.
  const normalized = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminUsersTable({ users }: { users: AdminUser[] }) {
  if (users.length === 0) {
    return (
      <section className="grid justify-items-center gap-2 rounded-xl border border-line bg-panel px-5 py-12 text-center">
        <h2 className="font-display text-lg font-bold">No users on this page</h2>
        <p className="text-sm text-muted">The page is beyond the end of the list.</p>
        <Link
          href="/admin/users"
          className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
        >
          Back to first page
        </Link>
      </section>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <caption className="sr-only">Registered user accounts</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="px-4 py-2.5 font-semibold">Name</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">User ID</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Email</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Phone</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Role</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-line/70 last:border-0 hover:bg-tint/60">
              <td className="px-4 py-3 font-semibold">{user.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted">{user.id}</td>
              <td className="px-4 py-3">{user.email}</td>
              <td className="px-4 py-3 text-muted">{user.phone ?? "—"}</td>
              <td className="px-4 py-3">
                <Pill tone={ROLE_TONE[user.role] ?? "neutral"} className="capitalize">
                  {user.role}
                </Pill>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-muted">{joined(user.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
