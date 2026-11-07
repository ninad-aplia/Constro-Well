// Customer reviews — port of buildgrid-shop.html's `.revs`/`.rvgrid`/`.rv`
// (CSS lines 123-124, markup lines 495-496). Server component.
//
// Mock-data safety (D14): the prototype's synthetic reviews carry no
// "Verified purchase" label for these generated entries (only used for seller
// badges), so none is added here either — each review is explicitly marked
// "Sample review" instead, with a section-level disclosure. "Write a customer
// review" and "Helpful" are disabled (fake review submission/voting excluded,
// per this task's scope).
import Stars from "@/components/ui/Stars";
import Button from "@/components/ui/Button";
import { fmt } from "@/lib/shop/format";
import type { ProductReview } from "@/lib/api/catalog";

export default function ProductReviews({
  rating,
  reviewCount,
  histogram,
  reviews,
}: {
  rating: number;
  reviewCount: number;
  histogram: number[];
  reviews: ProductReview[];
}) {
  return (
    <section
      id="reviews"
      className="mt-4 grid grid-cols-1 gap-8 rounded-xl border border-line bg-panel p-[18px] min-[1101px]:grid-cols-[300px_minmax(0,1fr)]"
    >
      <div>
        <h2 className="mb-2 font-display text-xl font-bold">Customer reviews</h2>
        <div className="mb-1 flex items-center gap-2">
          <b className="text-base">{rating}</b>
          <Stars value={rating} />
          <span className="text-sm">out of 5</span>
        </div>
        <p className="mb-3 text-sm text-muted">{fmt(reviewCount)} global ratings</p>
        {histogram.map((pct, i) => (
          <div key={i} className="my-1 grid grid-cols-[48px_1fr_40px] items-center gap-2 text-[13px]">
            <span>{5 - i} star</span>
            <i className="block h-4 overflow-hidden rounded border border-line bg-tint">
              <b className="block h-full bg-star" style={{ width: `${pct}%` }} />
            </i>
            <span>{pct}%</span>
          </div>
        ))}
        <hr className="my-3 border-line" />
        <h3 className="mb-1 font-semibold">Review this product</h3>
        <p className="mb-2 text-sm text-muted">Share your thoughts with other customers.</p>
        <Button variant="line" disabled title="Review submission isn't implemented yet">
          Write a customer review
        </Button>
      </div>

      <div>
        <p className="mb-3 text-xs text-muted">
          Sample reviews shown for preview — not from verified purchases.
        </p>
        <div className="grid gap-4">
          {reviews.map((r, i) => (
            <article key={i} className="grid gap-1.5 border-b border-line pb-4 last:border-0">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-nav text-xs font-bold text-hi">
                  {r.name[0]}
                </span>
                <b className="text-sm">{r.name}</b>
              </div>
              <div className="flex items-center gap-2">
                <Stars value={r.stars} />
                <b className="text-sm">{r.title}</b>
              </div>
              <small className="text-xs text-muted">Reviewed on {r.postedOn} · Sample review</small>
              <p className="text-sm">{r.body}</p>
              <Button variant="line" size="sm" disabled title="Review voting isn't implemented yet" className="w-fit">
                Helpful
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
