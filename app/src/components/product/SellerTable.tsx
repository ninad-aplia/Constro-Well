// Seller comparison — port of buildgrid-shop.html's "Other sellers" table
// (markup line 492, `.seller`/`.tw`/`table` CSS lines 117, 119). Server
// component. Data now comes from PostgreSQL SellerOffer rows; the columns show
// the real listing price, availability, minimum quantity and lead time.
// Seller selection is still not wired to the cart (out of scope).
import Card from "@/components/ui/Card";
import { inr } from "@/lib/shop/format";
import type { ProductOffer } from "@/lib/api/catalogDb";

export default function SellerTable({ offers }: { offers: ProductOffer[] }) {
  if (offers.length === 0) return null;

  return (
    <Card className="mt-4 p-[18px]">
      <h2 className="mb-1 font-display text-xl font-bold">Other sellers on Constro Well</h2>
      <p className="mb-3 text-xs text-muted">
        Seller listings from the marketplace. Prices and stock are live database values.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Seller", "Price", "Availability", "Min order", "Delivery", "Rating"].map((label, i) => (
                <th
                  key={label}
                  className={`border-b border-line px-2.5 py-2 text-[13px] font-semibold whitespace-nowrap text-muted ${
                    i === 0 || i === 2 || i === 4 ? "text-left" : "text-right"
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => (
              <tr key={offer.id}>
                <td className="border-b border-line px-2.5 py-2.5">
                  <b>{offer.name}</b>
                  <span className="block text-[13px] text-muted">
                    {offer.city}
                    {offer.verified ? " · Verified" : ""}
                    {offer.serviceablePincodes.length
                      ? ` · Serves ${offer.serviceablePincodes.length} pincodes`
                      : ""}
                  </span>
                  <span className="block text-[12px] text-muted">
                    {offer.bulkTiers.length
                      ? `Bulk: ${offer.bulkTiers.map(([qty, pct]) => `${qty}+ ${pct}% off`).join(", ")}`
                      : "Standard bulk tiers"}
                  </span>
                </td>
                <td className="border-b border-line px-2.5 py-2.5 text-right font-bold">
                  {inr(offer.price)}
                </td>
                <td className="border-b border-line px-2.5 py-2.5">
                  {offer.stock >= offer.minOrderQty
                    ? `${offer.stock} in stock`
                    : offer.stock > 0
                      ? `Only ${offer.stock} (min ${offer.minOrderQty})`
                      : "Out of stock"}
                </td>
                <td className="border-b border-line px-2.5 py-2.5 text-right">
                  {offer.minOrderQty}
                </td>
                <td className="border-b border-line px-2.5 py-2.5">
                  {offer.leadTimeDays === 0
                    ? "Same day"
                    : `${offer.leadTimeDays} day${offer.leadTimeDays === 1 ? "" : "s"}`}
                </td>
                <td className="border-b border-line px-2.5 py-2.5 text-right">
                  {offer.rating === null ? "—" : `${offer.rating.toFixed(1)} ★`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
