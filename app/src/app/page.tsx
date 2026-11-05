// Placeholder storefront route (TASK 1.1). No shopping workflow yet beyond the
// category tiles (TASK 4.1, in progress) — hero carousel, deals and best
// sellers still to come.
import PrimitiveShowcase from "@/components/ui/PrimitiveShowcase";
import CategoryTiles from "@/components/home/CategoryTiles";

export default function Home() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6">
      <section className="rounded-xl bg-nav px-6 py-12 text-center text-white sm:px-10 sm:py-16">
        <h1 className="mx-auto max-w-xl font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          Building materials, delivered to your site.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-white/85">
          Multiple verified sellers, bulk pricing, and delivery tracked to the
          last bag. We are laying the foundation now — browse arrives with the
          catalogue.
        </p>
        <span
          aria-hidden="true"
          className="mx-auto mt-6 block h-1 w-24 rounded bg-hi"
        />
      </section>

      <section aria-label="Product categories" className="mt-6 max-w-sm">
        <CategoryTiles />
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
