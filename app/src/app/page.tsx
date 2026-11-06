// Placeholder storefront route (TASK 1.1). The full `VIEWS_home` prototype
// section order is now ported (TASK 4.1): hero, `.tiles` discovery row, the
// three product rows, recently viewed, trust strip.
import PrimitiveShowcase from "@/components/ui/PrimitiveShowcase";
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

      <section
        aria-label="Build status"
        className="mt-6 rounded-xl border border-line bg-panel p-6"
      >
        <h2 className="font-display text-lg font-bold">Build status</h2>
        <ul className="mt-2 grid gap-1 text-sm text-ink2 sm:grid-cols-2">
          <li>✔ Project foundation + approved decisions (Phase&nbsp;0)</li>
          <li>✔ App scaffold, design tokens, app shell (Phase&nbsp;1 — TASK&nbsp;1.1)</li>
          <li>Database + API foundation (Phase&nbsp;2 — next)</li>
          <li>Auth, catalogue, cart, checkout, seller &amp; delivery (Phases&nbsp;3–7)</li>
        </ul>
        <p className="mt-3 text-xs text-muted">
          Progress lives in the repository: see <code>TASKS.md</code> and{" "}
          <code>HANDOFF.md</code>.
        </p>
      </section>

      <PrimitiveShowcase />
    </div>
  );
}
