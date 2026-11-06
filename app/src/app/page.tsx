// Placeholder storefront route (TASK 1.1). No shopping workflow yet beyond
// the hero carousel, category tiles and deals tiles (TASK 4.1, in progress) —
// bulk saver, sign-in tile and best sellers still to come.
import PrimitiveShowcase from "@/components/ui/PrimitiveShowcase";
import Hero from "@/components/home/Hero";
import CategoryTiles from "@/components/home/CategoryTiles";
import DealTiles from "@/components/home/DealTiles";

export default function Home() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6">
      <Hero />

      {/*
        Prototype `.tiles` row (buildgrid-shop.html:76, 156, 158) is 4 columns
        desktop (>1100px), 2 columns at intermediate widths (≤1100px), 1 column
        mobile (≤640px). Only 2 of the eventual 4 tiles exist (category, deals;
        bulk saver + sign-in still to come), so this grid intentionally stays at
        the 2-column tier at all widths ≥640px for now — add an `lg:grid-cols-4`
        tier only once all 4 tiles are implemented, to avoid empty desktop slots.
      */}
      <section
        aria-label="Shop by category and today's deals"
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <CategoryTiles />
        <DealTiles />
      </section>

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
