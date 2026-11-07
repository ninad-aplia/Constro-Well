// Product details table — port of buildgrid-shop.html's `.spec` table
// (CSS line 120, markup line 494, `specRows` line 483).
import Card from "@/components/ui/Card";

export default function ProductSpecsTable({ rows }: { rows: [string, string][] }) {
  return (
    <Card className="mt-4 p-[18px]">
      <h2 className="mb-3 font-display text-xl font-bold">Product details</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th className="w-[34%] border-b border-line bg-tint px-2.5 py-2 text-left font-semibold text-ink2">
                  {label}
                </th>
                <td className="border-b border-line px-2.5 py-2">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
