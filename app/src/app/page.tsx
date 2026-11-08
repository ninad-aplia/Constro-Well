// Storefront home route. The full `VIEWS_home` prototype section order is
// ported: hero, `.tiles` discovery row, the three product rows, recently
// viewed, trust strip.
import Hero from "@/components/home/Hero";
import CategoryTiles from "@/components/home/CategoryTiles";
import DealTiles from "@/components/home/DealTiles";
import BulkSaverTile from "@/components/home/BulkSaverTile";
import SignInTile from "@/components/home/SignInTile";
import TodaysDealsRow from "@/components/home/TodaysDealsRow";
import BestSellersRow from "@/components/home/BestSellersRow";
import FinishingTouchesRow from "@/components/home/FinishingTouchesRow";
import RecentlyViewedRow from "@/components/home/RecentlyViewedRow";
import TrustStrip from "@/components/home/TrustStrip";

export default function Home() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6">
      <Hero />

      {/*
        Prototype `.tiles` row (buildgrid-shop.html:76, 156, 158), now complete
        with all 4 tiles: 4 columns desktop (>1100px), 2 columns at
        intermediate widths (640-1100px), 1 column mobile (<640px). `1100px` is
        an arbitrary breakpoint matching the prototype's own cutoff, which
        doesn't align with Tailwind's default `lg` (1024px). The intermediate
        tier is bounded on both ends (`sm:max-[1099px]:`) rather than left
        open-ended — Tailwind emits the `min-[1100px]` media block before the
        standard `sm` block in the stylesheet, so an unbounded `sm:grid-cols-2`
        would win the cascade at >=1100px too (verified in the browser).
      */}
      <section
        aria-label="Shop by category, today's deals, bulk saver and your account"
        className="mt-6 grid grid-cols-1 gap-4 sm:max-[1099px]:grid-cols-2 min-[1100px]:grid-cols-4"
      >
        <CategoryTiles />
        <DealTiles />
        <BulkSaverTile />
        <SignInTile />
      </section>

      <div className="mt-6">
        <TodaysDealsRow />
        <BestSellersRow />
        <FinishingTouchesRow />
        <RecentlyViewedRow />
      </div>

      <TrustStrip />
    </div>
  );
}
