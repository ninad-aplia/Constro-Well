// Order monitoring table. Shows the stored customer stage and each seller
// shipment's own status — it never invents a unified order status.
import Link from "next/link";
import Pill from "@/components/ui/Pill";
import { formatDateOnly } from "@/lib/admin/sellers";
import { formatInrAmount, orderStageTone, shipmentStatusTone } from "@/lib/admin/orders";
import type { AdminOrder } from "@/lib/api/adminApi";

export default function AdminOrdersTable({ orders, total }: { orders: AdminOrder[]; total: number }) {
  if (orders.length === 0) {
    const empty = total === 0;
    return (
      <section className="grid justify-items-center gap-2 rounded-xl border border-line bg-panel px-5 py-12 text-center">
        <h2 className="font-display text-lg font-bold">
          {empty ? "No orders yet" : "No orders on this page"}
        </h2>
        <p className="text-sm text-muted">
          {empty
            ? "Orders will appear here after checkout."
            : "The requested page is beyond the end of the list."}
        </p>
        {!empty && (
          <Link
            href="/admin/orders"
            className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
          >
            Back to first page
          </Link>
        )}
      </section>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <table className="w-full min-w-[1080px] border-collapse text-sm">
        <caption className="sr-only">Order monitoring list</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="px-4 py-2.5 font-semibold">Order</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Customer</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Stage</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Total</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Items</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Seller shipments</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Placed</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-line/70 align-top last:border-0 hover:bg-tint/60">
              <td className="px-4 py-3">
                <span className="block font-semibold">{order.code}</span>
                <span className="block font-mono text-[11px] text-muted">{order.id}</span>
              </td>
              <td className="px-4 py-3">{order.customer.name}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  <Pill tone={orderStageTone(order.stage)}>{order.stage}</Pill>
                  {order.cancelled && <Pill tone="bad">Cancelled</Pill>}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap font-semibold">{formatInrAmount(order.grossTotal)}</td>
              <td className="px-4 py-3 text-muted">
                {order.lineCount} {order.lineCount === 1 ? "line" : "lines"}
              </td>
              <td className="px-4 py-3">
                {order.shipments.length === 0 ? (
                  <span className="text-muted">—</span>
                ) : (
                  <ul className="grid gap-1">
                    {order.shipments.map((shipment) => (
                      <li key={shipment.code} className="flex flex-wrap items-center gap-1.5 text-[12px]">
                        <span className="font-mono text-[11px] text-muted">{shipment.code}</span>
                        <span>{shipment.sellerName}</span>
                        <Pill tone={shipmentStatusTone(shipment.status)}>{shipment.status}</Pill>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDateOnly(order.createdAt)}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="inline-flex min-h-8 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
                >
                  View details
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
