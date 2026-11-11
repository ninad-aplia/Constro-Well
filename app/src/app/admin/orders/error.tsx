"use client";

import Button from "@/components/ui/Button";

export default function AdminOrdersError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid gap-4">
      <header>
        <h1 className="font-display text-2xl font-bold">Orders</h1>
      </header>
      <section
        role="alert"
        className="grid justify-items-start gap-2 rounded-xl border border-line bg-panel p-6"
      >
        <h2 className="font-display text-lg font-bold">Orders couldn&rsquo;t load</h2>
        <p className="text-sm text-muted">
          The admin service could not be reached. No fallback data is shown.
        </p>
        <Button variant="line" onClick={reset}>
          Try again
        </Button>
      </section>
    </div>
  );
}
