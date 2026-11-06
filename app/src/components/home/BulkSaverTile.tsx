// "Bulk saver" home tile — port of buildgrid-shop.html's `.tile`/`.bt` section
// (lines 79-80, 410): bulk-pricing tiers table. Server component: tier data
// comes from the catalog API facade (verified business logic, not mock data).
import Link from "next/link";
import Card from "@/components/ui/Card";
import { getBulkTiers } from "@/lib/api/catalog";

export default async function BulkSaverTile() {
  const tiers = await getBulkTiers();

  return (
    <Card className="flex flex-col gap-2.5 p-[18px]">
      <h2 className="font-display text-xl font-bold">Bulk saver</h2>
      <p className="text-muted">
        Order more of the same item and the price drops automatically.
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-line px-1 py-1.5 text-left">Quantity</th>
            <th className="border-b border-line px-1 py-1.5 text-right">You save</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map(([qty, pct]) => (
            <tr key={qty}>
              <td className="border-b border-line px-1 py-1.5 text-left">{qty}+ units</td>
              <td className="border-b border-line px-1 py-1.5 text-right">
                <b className="text-ok">{pct}%</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link href="/search" className="mt-auto font-semibold text-link">
        Start saving
      </Link>
    </Card>
  );
}
