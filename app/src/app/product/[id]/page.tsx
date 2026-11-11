// /product/[id] — Product Detail page (Stage 1: UI + data only), port of
// buildgrid-shop.html's VIEWS_product (lines 456-497): `.pgrid3`/`.gal`/
// `.info`/`.buy`/`.bulk`/`.about` CSS (lines 108-116), the seller table, FBT,
// product-details table, customer reviews and "Customers also viewed" row.
// Server Component: all data comes from the catalog API facade. The only
// client pieces are the gallery (thumbnail swap) and buy box (quantity →
// live bulk price) — both purely presentational, no cart/order state.
//
// Deployment-readiness pass (owner-instructed): the prototype's
// `specRows`/"About this item" (buildgrid-shop.html:483, 490) hardcode
// "Country of origin: India" and "GST invoice available for business
// purchases" for every product. Neither is backed by real sourcing or
// billing capability in this app, so both are removed rather than ported —
// an unsupported claim, even one copied verbatim from the prototype, is
// still an unsupported claim.
import { notFound } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Stars from "@/components/ui/Stars";
import ProductRow from "@/components/home/ProductRow";
import ProductGallery from "@/components/product/ProductGallery";
import BuyBox from "@/components/product/BuyBox";
import SellerTable from "@/components/product/SellerTable";
import FrequentlyBoughtTogether from "@/components/product/FrequentlyBoughtTogether";
import ProductSpecsTable from "@/components/product/ProductSpecsTable";
import ProductReviews from "@/components/product/ProductReviews";
import RecordView from "@/components/product/RecordView";
import { fmt, inr } from "@/lib/shop/format";
import { effectiveBulkTiers } from "@/lib/shop/pricing";
import {
  getFrequentlyBoughtTogether,
  getProductById,
  getProductReviews,
  getRatingBreakdown,
  getSellerOffers,
  getSimilarProducts,
} from "@/lib/api/catalogDb";

// Every part of this page's content depends on `params.id` (the product being
// displayed is the entire page), so there's no meaningful static shell to
// stream behind a <Suspense> boundary — same situation and same fix as
// /search (see that page's comment): blocking rendering is correct here.
export const instant = false;

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();

  const [offers, fbt, similar, reviews, histogram] = await Promise.all([
    getSellerOffers(product.id),
    getFrequentlyBoughtTogether(product.id),
    getSimilarProducts(product.id),
    getProductReviews(product.id),
    getRatingBreakdown(product.id),
  ]);
  const bulkTiers = effectiveBulkTiers(offers[0]?.bulkTiers);

  const specRows: [string, string][] = [
    ...product.specs.map((s) => s.split(": ") as [string, string]),
    ["Brand", product.brand],
    ["Pack", product.unit],
    ["Category", product.category],
  ];

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6">
      <RecordView id={product.id} />

      <nav aria-label="Breadcrumb" className="mb-2.5 text-[13px] text-muted">
        <Link href="/search" className="text-link hover:underline">
          All products
        </Link>{" "}
        ›{" "}
        <Link href={`/search?cat=${encodeURIComponent(product.category)}`} className="text-link hover:underline">
          {product.category}
        </Link>
      </nav>

      <div className="grid items-start gap-5 max-[1100px]:grid-cols-2 min-[1101px]:grid-cols-[minmax(0,5fr)_minmax(0,5fr)_300px]">
        <ProductGallery
          art={product.art}
          hue={product.hue}
          specs={product.specs}
          brand={product.brand}
          unit={product.unit}
          category={product.category}
        />

        <section aria-label="Product information">
          <Link href={`/search?q=${encodeURIComponent(product.brand)}`} className="text-sm text-link hover:underline">
            Visit the {product.brand} store
          </Link>
          <h1 className="my-1 font-display text-[26px] font-bold">{product.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <b>{product.rating}</b>
            <Stars value={product.rating} />
            <a href="#reviews" className="text-link hover:underline">
              {fmt(product.reviews)} ratings
            </a>
            {product.best && (
              <span className="rounded bg-hi px-2 py-0.5 text-[11px] font-bold text-hiink">
                Best seller in {product.category}
              </span>
            )}
          </div>
          <hr className="my-3 border-line" />
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold text-deal">-{product.off}%</span>
            <span className="font-display text-[34px] font-bold tracking-[-0.02em]">
              <sup className="relative top-1 mr-0.5 text-base">₹</sup>
              {fmt(product.price)}
            </span>
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            M.R.P.: <s>{inr(product.mrp)}</s> Inclusive of all taxes
          </p>

          <div className="my-3.5 rounded-[10px] border border-dashed border-line bg-tint p-3">
            <b className="text-sm">Buy more, save more</b>
            <div className="mt-1.5 flex gap-4 text-[13px]">
              {bulkTiers.map(([qty, pct]) => (
                <span key={qty} className="flex-1 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-center">
                  <b>{qty}+</b> units
                  <br />
                  {pct}% off
                </span>
              ))}
            </div>
          </div>

          <h3 className="mb-1 font-semibold">About this item</h3>
          <ul className="list-disc pl-5 text-sm">
            {product.specs.map((s) => (
              <li key={s} className="mb-1">
                {s}
              </li>
            ))}
            <li className="mb-1">Sold per {product.unit}.</li>
          </ul>
          <p className="mt-2 text-xs text-muted">
            Prices, stock and seller availability come from the marketplace database.
          </p>
        </section>

        <Card
          aria-label="Buy box"
          className="p-[18px] max-[1100px]:static max-[1100px]:col-span-2 min-[1101px]:sticky min-[1101px]:top-[130px]"
        >
          {offers.length > 0 ? (
            <BuyBox
              id={product.id}
              offerId={offers[0].id}
              price={offers[0].price}
              bulkTiers={offers[0].bulkTiers}
              unit={product.unit}
              sellerName={offers[0].name}
              minOrderQty={offers[0].minOrderQty}
              stock={offers[0].stock}
              leadTimeDays={offers[0].leadTimeDays}
            />
          ) : (
            <div className="grid gap-2">
              <h2 className="font-display text-lg font-bold">Currently unavailable</h2>
              <p className="text-sm text-muted">
                No seller currently has this product in stock.
              </p>
            </div>
          )}
        </Card>
      </div>

      <SellerTable offers={offers} />
      <FrequentlyBoughtTogether items={fbt} />
      <ProductSpecsTable rows={specRows} />
      <ProductReviews rating={product.rating} reviewCount={product.reviews} histogram={histogram} reviews={reviews} />
      <div className="mt-4">
        <ProductRow title="Customers also viewed" items={similar} />
      </div>
    </div>
  );
}
