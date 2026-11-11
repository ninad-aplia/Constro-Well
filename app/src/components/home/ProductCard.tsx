// Product card — port of buildgrid-shop.html's `pcard()` (lines 377-386) and
// its `.pcard`/`.pimg`/`.pinfo`/`.ptitle`/`.rate`/`.price`/`.mrp`/`.offt`/
// `.tagdeal`/`.tagbest`/`.heart` CSS (lines 88-97). Server component: pure
// presentation, props come from the catalog API facade via ProductRow (or
// directly from /search). `layout` matches the prototype's two contexts:
// "scroll" is `.scroller .pcard{flex:0 0 220px}` (homepage rows, default —
// every existing call site is unchanged); "grid" is the bare `.pcard` inside
// `.pgrid{grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}` (search
// results), where the card has no fixed width and stretches to fill its
// track. Card contents/artwork/badges/typography are identical either way.
//
// "Add to cart" reuses the existing cart API through AddToCartButton; the
// offer it adds is the cheapest purchasable seller offer behind the card's
// price (see catalogDb.cardOf). Cards with no purchasable offer keep the
// control disabled and read "Out of stock".
//
// Deliberate deviation from the prototype (mock-data safety, D14):
// - Wishlist ("heart") is rendered disabled. The capability does not exist
//   yet (owner decision pending) — wiring fake success would misrepresent
//   what the app can do. Native `disabled` correctly removes it from the
//   keyboard tab order (verified: calling .focus() does not move
//   document.activeElement) — that is the honest result here, not an
//   oversight. A focusable-but-inert control would mislead keyboard/AT users
//   more than one that's skipped.
// - The prototype's delivery-estimate line (depends on a real pincode/zone)
//   and "Only N left in stock" line are both omitted: the card does not
//   resolve a pincode or print an inventory count; stock is only checked
//   server-side when the CTA is clicked.
import Link from "next/link";
import Stars from "@/components/ui/Stars";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { fmt, inr } from "@/lib/shop/format";
import type { ProductCardData } from "@/lib/api/catalog";

export default function ProductCard({
  id,
  name,
  price,
  mrp,
  off,
  rating,
  reviews,
  best,
  hue,
  art,
  offerId,
  purchasable,
  minOrderQty,
  layout = "scroll",
}: ProductCardData & { layout?: "scroll" | "grid" }) {
  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-xl border border-line bg-panel hover:border-ink2 ${
        layout === "scroll" ? "w-[220px] flex-none snap-start" : "w-full"
      }`}
    >
      <button
        type="button"
        disabled
        aria-label="Wishlist isn't available yet"
        title="Wishlist isn't implemented yet"
        className="absolute top-2 right-2 z-10 grid h-[34px] w-[34px] place-items-center rounded-full bg-panel text-muted shadow-[0_1px_4px_rgba(0,0,0,0.2)] disabled:opacity-60"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21s-7.5-4.6-10-9.3C.5 7.7 2.8 4 6.5 4c2 0 3.6 1 5.5 3 1.9-2 3.5-3 5.5-3 3.7 0 6 3.7 4.5 7.7-2.5 4.7-10 9.3-10 9.3z" />
        </svg>
      </button>

      <Link
        href={`/product/${id}`}
        aria-label={name}
        className="relative grid aspect-[4/3] place-items-center"
        style={{
          backgroundImage: `linear-gradient(160deg, var(--tint), color-mix(in srgb, ${hue} 22%, var(--tint)))`,
        }}
      >
        <svg
          viewBox="0 0 120 80"
          aria-hidden="true"
          className="w-[68%]"
          dangerouslySetInnerHTML={{ __html: art }}
        />
        {off >= 20 && (
          <span className="absolute top-2 left-2 rounded bg-deal px-2 py-0.5 text-xs font-bold text-white">
            -{off}%
          </span>
        )}
        {best && (
          <span className="absolute bottom-2 left-2 rounded bg-hi px-2 py-0.5 text-[11px] font-bold text-hiink">
            Best seller
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-[5px] p-3">
        <Link
          href={`/product/${id}`}
          className="line-clamp-2 leading-[1.3] font-semibold text-ink hover:text-link"
        >
          {name}
        </Link>
        <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-link">
          <Stars value={rating} />
          <span>{fmt(reviews)}</span>
        </div>
        <div>
          <span className="font-display text-[22px] font-bold tracking-[-0.02em]">
            <sup className="relative top-0.5 mr-px text-[13px]">₹</sup>
            {fmt(price)}
          </span>{" "}
          <span className="text-[13px] text-muted">
            <s>{inr(mrp)}</s>
          </span>{" "}
          <span className="text-[13px] font-semibold text-deal">{off}% off</span>
        </div>
        <AddToCartButton offerId={offerId} purchasable={purchasable} minOrderQty={minOrderQty} />
      </div>
    </article>
  );
}
