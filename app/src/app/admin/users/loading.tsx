export default function AdminUsersLoading() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-live="polite">
      <header className="grid gap-1">
        <h1 className="font-display text-2xl font-bold">Users</h1>
        <p className="text-sm text-muted">Loading user accounts…</p>
      </header>
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-line/70 px-4 py-3 last:border-0">
            <span className="h-3 w-32 animate-pulse rounded bg-tint" />
            <span className="h-3 w-24 animate-pulse rounded bg-tint" />
            <span className="h-3 flex-1 animate-pulse rounded bg-tint" />
            <span className="h-3 w-16 animate-pulse rounded bg-tint" />
            <span className="h-3 w-20 animate-pulse rounded bg-tint" />
          </div>
        ))}
      </div>
    </div>
  );
}
