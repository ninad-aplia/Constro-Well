// Seller comparison — port of buildgrid-shop.html's "Other sellers" table
// (markup line 492, `.seller`/`.tw`/`table` CSS lines 117, 119). Server
// component, static: no selection radios (Stage 2 — see BuyBox header
// comment) and no "Verified"/delivery columns, since this seller list is
// entirely synthetic (PROJECT_CONTEXT.md §7) — showing those would claim
// real, verified sellers and delivery estimates that don't exist.
import Card from "@/components/ui/Card";
import { inr } from "@/lib/shop/format";
import type { SellerOffer } from "@/lib/shop/types";

export default function SellerTable({ offers }: { offers: SellerOffer[] }) {
  if (offers.length === 0) return null;

  return (
    <Card className="mt-4 p-[18px]">
      <h2 className="mb-1 font-display text-xl font-bold">Other sellers on Constro Well</h2>
      <p className="mb-3 text-xs text-muted">
        Sample seller listings for preview — not real, verified sellers.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border-b border-line px-2.5 py-2 text-left text-[13px] font-semibold whitespace-nowrap text-muted">
                Seller
              </th>
              <th className="border-b border-line px-2.5 py-2 text-right text-[13px] font-semibold whitespace-nowrap text-muted">
                Price
              </th>
              <th className="border-b border-line px-2.5 py-2 text-left text-[13px] font-semibold whitespace-nowrap text-muted">
                Rating
              </th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer, i) => (
              <tr key={i}>
                <td className="border-b border-line px-2.5 py-2.5">{offer.name}</td>
                <td className="border-b border-line px-2.5 py-2.5 text-right font-bold">{inr(offer.price)}</td>
                <td className="border-b border-line px-2.5 py-2.5">{offer.rating.toFixed(1)} ★</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
