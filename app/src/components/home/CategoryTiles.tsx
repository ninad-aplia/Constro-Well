// "Shop by category" home tile — port of buildgrid-shop.html's `.tile`/`.mini4`/`.mi`
// section (lines 402, 405, 408): featured categories with tinted SVG art, linking
// to search-by-category. Server component: data comes from the catalog API facade.
import Link from "next/link";
import Card from "@/components/ui/Card";
import { getFeaturedCategoryTiles } from "@/lib/api/catalog";

export default async function CategoryTiles() {
  const tiles = await getFeaturedCategoryTiles();

  return (
    <Card className="flex flex-col gap-2.5 p-[18px]">
      <h2 className="font-display text-xl font-bold">Shop by category</h2>
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map(({ category, hue, art }) => (
          <Link
            key={category}
            href={`/search?cat=${encodeURIComponent(category)}`}
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
            <span>{category}</span>
          </Link>
        ))}
      </div>
      <Link href="/search" className="mt-auto font-semibold text-link">
        Shop all categories
      </Link>
    </Card>
  );
}
