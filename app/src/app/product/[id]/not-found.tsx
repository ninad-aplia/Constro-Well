// Not-found state for /product/[id] — port of buildgrid-shop.html's `nf()`
// ("We couldn't find that page" / "The item may have been removed.",
// line 388), with a route back to the catalogue instead of a fallback
// product. Never renders an arbitrary product for an unknown id.
import Link from "next/link";
import Card from "@/components/ui/Card";

export default function ProductNotFound() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6">
      <Card className="grid justify-items-center gap-2.5 px-5 py-10 text-center">
        <h1 className="font-display text-xl font-bold">We couldn’t find that product</h1>
        <p className="text-muted">The item may have been removed, or the link may be incorrect.</p>
        <Link
          href="/search"
          className="inline-flex min-h-10 items-center justify-center rounded-full bg-hi px-[18px] font-semibold text-hiink hover:bg-hi2"
        >
          Browse all products
        </Link>
      </Card>
    </div>
  );
}
