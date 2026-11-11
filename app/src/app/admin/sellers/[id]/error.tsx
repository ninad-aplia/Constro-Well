"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";

export default function AdminSellerDetailError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid gap-4">
      <Link
        href="/admin/sellers"
        className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
      >
        ← Back to sellers
      </Link>
      <section
        role="alert"
        className="grid justify-items-start gap-2 rounded-xl border border-line bg-panel p-6"
      >
        <h2 className="font-display text-lg font-bold">Seller couldn&rsquo;t load</h2>
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
