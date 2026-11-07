// "Today's deals" home tile — port of buildgrid-shop.html's `.tile`/`.mini4`/`.mi`
// section (lines 402, 406, 409): top 4 discounted products by category/off%,
// linking to the product page. Server component: data comes from the catalog
// API facade. Discounts shown are prototype mock-catalogue sample data, not
// live offers.
import Link from "next/link";
import Card from "@/components/ui/Card";
import { getDealTiles } from "@/lib/api/catalogDb";

export default async function DealTiles() {
  const tiles = await getDealTiles();

  return (
    <Card className="flex flex-col gap-2.5 p-[18px]">
      <h2 className="font-display text-xl font-bold">Today’s deals</h2>
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map(({ id, category, off, hue, art }) => (
          <Link
            key={id}
            href={`/product/${id}`}
            className="grid gap-1 text-[13px] font-semibold text-ink hover:text-link hover:no-underline"
          >
            <span
              className="grid aspect-[4/3] place-items-center rounded-lg"
              style={{
                backgroundImage: `linear-gradient(160deg, var(--tint), color-mix(in srgb, ${hue} 24%, var(--tint)))`,
              }}
            >
              <svg
                viewBox="0 0 120 80"
                aria-hidden="true"
                className="w-[70%]"
                dangerouslySetInnerHTML={{ __html: art }}
              />
            </span>
            <span>{`-${off}% ${category}`}</span>
          </Link>
        ))}
      </div>
      <Link href="/search?deal=1" className="mt-auto font-semibold text-link">
        See all deals
      </Link>
    </Card>
  );
}
