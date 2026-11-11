// Cross-seller shipment monitoring table. Complements `/admin/orders/[id]`
// (one order's shipments) by letting an admin find, for example, every
// `failed`/`disputed`/`missed` shipment across all sellers without opening
// each order individually.
import Link from "next/link";
import Pill from "@/components/ui/Pill";
import { formatDateOnly } from "@/lib/admin/sellers";
import { shipmentStatusTone } from "@/lib/admin/orders";
import type { AdminShipment } from "@/lib/api/adminApi";

export default function AdminShipmentsTable({
  shipments,
  total,
  filtered,
}: {
  shipments: AdminShipment[];
  total: number;
  filtered: boolean;
}) {
  if (shipments.length === 0) {
    const empty = total === 0;
    return (
      <section className="grid justify-items-center gap-2 rounded-xl border border-line bg-panel px-5 py-12 text-center">
        <h2 className="font-display text-lg font-bold">
          {empty ? (filtered ? "No shipments match this status" : "No shipments yet") : "No shipments on this page"}
        </h2>
        <p className="text-sm text-muted">
          {empty
            ? filtered
              ? "Try a different status or clear the filter."
              : "Shipments appear here once an order is placed."
            : "The requested page is beyond the end of the list."}
        </p>
        <Link
          href="/admin/shipments"
          className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
        >
          Back to first page
        </Link>
      </section>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <caption className="sr-only">Shipment monitoring list</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="px-4 py-2.5 font-semibold">Shipment</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Order</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Seller</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Driver</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Delivered</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Review ends</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Placed</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              <span className="sr-only">Order details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {shipments.map((shipment) => (
            <tr key={shipment.id} className="border-b border-line/70 align-top last:border-0 hover:bg-tint/60">
              <td className="px-4 py-3">
                <span className="block font-semibold">{shipment.code}</span>
                <span className="block font-mono text-[11px] text-muted">{shipment.id}</span>
              </td>
              <td className="px-4 py-3 font-mono text-[12px]">{shipment.orderCode}</td>
              <td className="px-4 py-3">{shipment.sellerName}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  <Pill tone={shipmentStatusTone(shipment.status)}>{shipment.status}</Pill>
                  {shipment.late && <Pill tone="bad">Late</Pill>}
                </div>
              </td>
              <td className="px-4 py-3 text-muted">{shipment.driverName ?? "—"}</td>
              <td className="px-4 py-3 whitespace-nowrap text-muted">
                {shipment.deliveredAt ? formatDateOnly(shipment.deliveredAt) : "—"}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-muted">
                {shipment.reviewEnds ? formatDateOnly(shipment.reviewEnds) : "—"}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDateOnly(shipment.createdAt)}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/orders/${shipment.orderId}`}
                  className="inline-flex min-h-8 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
                >
                  View order
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
