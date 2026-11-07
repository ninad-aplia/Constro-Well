export default function Loading() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6" aria-busy="true">
      <div className="h-8 w-64 animate-pulse rounded bg-tint" />
      <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-tint" />
      <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3.5">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-72 animate-pulse rounded-xl bg-tint" />
        ))}
      </div>
      <p className="sr-only">Loading catalogue from the marketplace database.</p>
    </div>
  );
}
