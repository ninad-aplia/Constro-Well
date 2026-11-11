export default function AdminLoading() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-live="polite">
      <header className="grid gap-1">
        <h1 className="font-display text-2xl font-bold">Admin console</h1>
        <p className="text-sm text-muted">Loading from the marketplace database…</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="grid gap-2 rounded-xl border border-line bg-panel p-4">
            <span className="h-3 w-24 animate-pulse rounded bg-tint" />
            <span className="h-7 w-16 animate-pulse rounded bg-tint" />
            <span className="h-3 w-36 animate-pulse rounded bg-tint" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="grid gap-2 rounded-xl border border-line bg-panel p-[18px]">
            <span className="h-4 w-36 animate-pulse rounded bg-tint" />
            <span className="h-3 w-full animate-pulse rounded bg-tint" />
            <span className="h-3 w-5/6 animate-pulse rounded bg-tint" />
          </div>
        ))}
      </div>
    </div>
  );
}
