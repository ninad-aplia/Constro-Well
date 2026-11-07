// Order card — port of buildgrid-shop.html's `orderCard()` (line ~581):
// ORDER PLACED / TOTAL / SHIP TO / ORDER # header band, status body, item rows
// with Buy it again. Pure markup; both the orders list and the thank-you page
// render it (brief = no inner "view details/track" links).
"use client";
import Link from "next/link";
import Button from "@/components/ui/Button";
import CartThumb from "./CartThumb";
import { inr } from "@/lib/shop/format";
import type { OrderPreview } from "@/lib/shop/types";

const dShort = (t: number): string => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

export default function OrderCard({
  order,
  brief = false,
  onReorder,
}: {
  order: OrderPreview;
  brief?: boolean;
  /** "Buy it again": adds the item to the cart (prototype `reorder` puts it there with the preview qty). */
  onReorder?: (id: number, q: number) => void;
}) {
  const status = order.cancelled
    ? { text: "Cancelled", tone: "text-bad" as const }
    : order.stage >= 4
      ? { text: "Delivered", tone: "text-ok" as const }
      : { text: `Arriving ${dShort(order.eta)}`, tone: "" };
  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex flex-wrap justify-between gap-x-6 gap-y-2 border-b border-line bg-tint px-4 py-3 text-[13px]">
        <span>
          <small className="text-muted">ORDER PLACED</small>
          <br />
          {dShort(order.created)}
        </span>
        <span>
          <small className="text-muted">TOTAL</small>
          <br />
          <b>{inr(order.t.total)}</b>
        </span>
        <span className="min-w-0">
          <small className="text-muted">SHIP TO</small>
          <br />
          {order.addr.name}
        </span>
        <span className="ms-auto text-right">
          <small className="text-muted">ORDER # {order.id}</small>
          <br />
          {!brief && (
            <Link href={`/orders/${order.id}`} className="font-semibold text-link hover:underline">
              View order details
            </Link>
          )}
        </span>
      </div>
      <div className="px-4 py-3">
        <h2 className={`font-display text-lg font-bold ${status.tone}`}>{status.text}</h2>
        {order.items.map((it) => (
          <div key={`${it.id}-${it.seller}`} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
            <CartThumb hue={it.hue} art={it.art} label={it.name} href={`/product/${it.id}`} />
            <div className="min-w-0">
              <Link href={`/product/${it.id}`} className="font-semibold hover:underline">
                {it.name}
              </Link>
              <p className="text-[13px] text-muted">
                Qty {it.q} · Sold by {it.seller}
              </p>
              <div className="mt-1 flex gap-2">
                <Button size="sm" variant="yellow" onClick={() => onReorder?.(it.id, it.q)}>
                  Buy it again
                </Button>
              </div>
            </div>
            <b className="ms-auto">{inr(it.total)}</b>
          </div>
        ))}
        {!brief && (
          <Link
            href={`/orders/${order.id}`}
            className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 font-semibold hover:bg-tint"
          >
            Track package
          </Link>
        )}
      </div>
    </section>
  );
}
