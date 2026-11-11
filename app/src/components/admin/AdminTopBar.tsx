// Admin top bar — minimal, honest shell: no fabricated metrics or notifications.
import Link from "next/link";
import LogoutButton from "@/components/auth/LogoutButton";

export default function AdminTopBar({
  user,
}: {
  user: { name: string; email: string };
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-bg/90 px-3.5 py-2.5 backdrop-blur-sm md:px-6">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Admin console</p>
        <p className="truncate text-sm font-semibold">Operations &amp; marketplace oversight</p>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="hidden text-right text-xs text-muted sm:block">
          <b className="block text-ink">{user.name}</b>
          {user.email}
        </span>
        <Link
          href="/"
          className="inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
        >
          Storefront
        </Link>
        <LogoutButton className="inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint disabled:opacity-60" />
      </div>
    </header>
  );
}
