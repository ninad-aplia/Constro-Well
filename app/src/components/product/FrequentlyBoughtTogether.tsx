// Frequently bought together — port of buildgrid-shop.html's `.fbt`/`.fbi`
// section (CSS lines 118, 121; markup line 493). Server component: the
// checkboxes are disabled+checked (static preview of the bundle, not a real
// "add selected to cart" action — that button is disabled too).
import Button from "@/components/ui/Button";
import { inr } from "@/lib/shop/format";
import type { ProductCardData } from "@/lib/api/catalog";

export default function FrequentlyBoughtTogether({ items }: { items: ProductCardData[] }) {
  if (items.length < 2) return null;
  const total = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <section className="mt-4 rounded-xl border border-line bg-panel p-[18px]">
      <h2 className="mb-1 font-display text-xl font-bold">Frequently bought together</h2>
      <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
        {items.map((item, i) => (
          <div key={item.id} className="flex items-center gap-2.5">
            {i > 0 && <span className="font-display text-2xl font-semibold text-muted">+</span>}
            <label className="grid w-[170px] gap-1">
              <input type="checkbox" checked disabled aria-label={`${item.name} (included in bundle)`} className="h-[18px] w-[18px] accent-nav" />
              <span
                className="grid aspect-[4/3] place-items-center rounded-lg"
                style={{
                  backgroundImage: `linear-gradient(160deg, var(--tint), color-mix(in srgb, ${item.hue} 22%, var(--tint)))`,
                }}
              >
                <svg viewBox="0 0 120 80" aria-hidden="true" className="w-[70%]" dangerouslySetInnerHTML={{ __html: item.art }} />
              </span>
              <span className="line-clamp-2 text-[13px]">
                {i === 0 ? "This item: " : ""}
                {item.name}
              </span>
              <b>{inr(item.price)}</b>
            </label>
          </div>
        ))}
        <div className="ml-auto grid items-start gap-1.5">
          <span className="text-sm text-muted">Total price</span>
          <b className="font-display text-[26px] font-bold">{inr(total)}</b>
          <Button variant="yellow" pill disabled title="Cart isn't implemented yet">
            Add selected to cart
          </Button>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">Sample catalogue data for preview — not live prices or availability.</p>
    </section>
  );
}
