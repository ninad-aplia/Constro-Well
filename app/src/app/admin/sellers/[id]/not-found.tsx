// Route-level 404 for /admin/sellers/[id]. Keeps the admin shell (rendered by
// the layout) and offers a way back to the seller list.
import Link from "next/link";

export default function SellerDetailNotFound() {
  return (
    <div className="grid gap-4">
      <Link
        href="/admin/sellers"
        className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
      >
        ← Back to sellers
      </Link>
      <section className="grid justify-items-start gap-2 rounded-xl border border-line bg-panel p-6">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Admin console</p>
        <h1 className="font-display text-2xl font-bold">Seller not found</h1>
        <p className="text-sm text-muted">
          No seller exists with this ID. It may have been removed, or the link is wrong.
        </p>
        <Link
          href="/admin/sellers"
          className="mt-1 inline-flex min-h-9 items-center rounded-lg bg-hi px-3 text-[13px] font-semibold text-hiink hover:bg-hi2"
        >
          View all sellers
        </Link>
      </section>
    </div>
  );
}
