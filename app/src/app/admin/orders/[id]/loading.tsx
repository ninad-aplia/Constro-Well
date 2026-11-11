export default function AdminOrderDetailLoading() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-live="polite">
      <div className="h-9 w-32 animate-pulse rounded-lg bg-tint" />
      <div className="grid gap-1">
        <h1 className="font-display text-2xl font-bold">Order detail</h1>
        <p className="text-sm text-muted">Loading order…</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="grid gap-2 rounded-xl border border-line bg-panel p-[18px]">
            <span className="h-4 w-40 animate-pulse rounded bg-tint" />
            <span className="h-3 w-full animate-pulse rounded bg-tint" />
            <span className="h-3 w-3/4 animate-pulse rounded bg-tint" />
          </div>
        ))}
      </div>
    </div>
  );
}
