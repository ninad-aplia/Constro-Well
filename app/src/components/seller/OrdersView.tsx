// Seller Hub Orders — same prototype layout, now backed by the authenticated
// seller shipment API. Every action is ownership-scoped server-side.
"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Pill from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { useSellerLive } from "./SellerLiveProvider";
import CategoryThumb from "./CategoryThumb";
import PreviewDisclosure from "./PreviewDisclosure";
import OrderDrawer from "./OrderDrawer";
import DispatchDialog from "./DispatchDialog";
import RejectDialog from "./RejectDialog";
import ReassignDialog from "./ReassignDialog";
import MissedDialog from "./MissedDialog";
import { toSellerOrder } from "./orderAdapter";
import { ACCEPT_WINDOW_HOURS, DISPATCH_WINDOW_HOURS } from "@/lib/seller/rules";
import { ORDER_FILTERS } from "@/lib/seller/selectors";
import { ORDER_STATUS } from "@/lib/seller/status";
import type { SellerOrder, Vehicle, Driver } from "@/lib/seller/types";
import type { SellerOrdersResponse, SellerShipmentDto } from "@/lib/api/sellerOrderDto";
import { ApiClientError } from "@/lib/api/client";
import {
  acceptSellerShipment,
  dispatchSellerShipment,
  fetchSellerOrders,
  markSellerShipmentMissed,
  packSellerShipment,
  redispatchSellerShipment,
  rejectSellerShipment,
  type SellerDispatchInput,
} from "@/lib/api/sellerOrderApi";

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function messageOf(error: unknown): string {
  return error instanceof ApiClientError ? error.message : "Could not reach the order service.";
}

export default function OrdersView({
  initialFilter,
  initialQuery,
  initialOpen,
}: {
  initialFilter: string;
  initialQuery: string;
  initialOpen: string | null;
}) {
  const toast = useToast();
  const { refresh: refreshLive } = useSellerLive();
  const [data, setData] = useState<SellerOrdersResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [filter, setFilter] = useState(initialFilter);
  const [query, setQuery] = useState(initialQuery);
  const [drawerId, setDrawerId] = useState<string | null>(initialOpen);
  const [dispatchTarget, setDispatchTarget] = useState<SellerOrder | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SellerOrder | null>(null);
  const [reassignTarget, setReassignTarget] = useState<SellerOrder | null>(null);
  const [missedTarget, setMissedTarget] = useState<SellerOrder | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSellerOrders()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(messageOf(err));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = () => {
    setStatus("loading");
    setError("");
    setReloadToken((value) => value + 1);
  };

  const replace = (shipment: SellerShipmentDto) => {
    setData((current) =>
      current
        ? { ...current, orders: current.orders.map((order) => (order.id === shipment.id ? shipment : order)) }
        : current,
    );
  };

  const run = async (order: SellerOrder, action: () => Promise<SellerShipmentDto>) => {
    if (!order.shipmentId) return;
    setBusy(order.shipmentId);
    try {
      const updated = await action();
      replace(updated);
      void refreshLive();
      toast.show("Shipment updated");
    } catch (error) {
      toast.show(messageOf(error));
      throw error;
    } finally {
      setBusy(null);
    }
  };

  const orders = (data?.orders ?? []).map(toSellerOrder);
  const activeFilter = ORDER_FILTERS.find((item) => item.key === filter) ?? ORDER_FILTERS[0];
  const q = query.trim().toLowerCase();
  let visible = activeFilter.statuses ? orders.filter((order) => activeFilter.statuses!.includes(order.status)) : orders;
  if (q) visible = visible.filter((order) => `${order.orderCode ?? order.id} ${order.productName} ${order.city} ${order.buyer}`.toLowerCase().includes(q));
  visible = [...visible].sort((a, b) => (a.status === "new" ? 0 : 1) - (b.status === "new" ? 0 : 1));

  const drawerOrder = orders.find((order) => order.shipmentId === drawerId || order.orderCode === drawerId || order.id === drawerId) ?? null;
  const count = (statuses: string[] | null) => (statuses ? orders.filter((order) => statuses.includes(order.status)).length : orders.length);

  if (status === "loading") {
    return (
      <div className="grid gap-4">
        <PreviewDisclosure />
        <h1 className="font-display text-[clamp(25px,3vw,34px)] font-bold">Orders</h1>
        {[0, 1, 2].map((index) => <div key={index} className="h-24 animate-pulse rounded-2xl border border-line bg-panel" />)}
        <p className="sr-only">Loading seller orders…</p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="grid gap-4">
        <PreviewDisclosure />
        <h1 className="font-display text-[clamp(25px,3vw,34px)] font-bold">Orders</h1>
        <section role="alert" className="grid justify-items-center gap-2 rounded-2xl border border-line bg-panel p-8 text-center">
          <h2 className="font-display text-lg font-bold">Orders couldn’t load</h2>
          <p className="text-muted">{error}</p>
          <Button variant="line" onClick={reload}>Try again</Button>
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <PreviewDisclosure message="Orders and shipment states are saved to the marketplace database. Other Seller Hub screens still use preview data." />
      <div>
        <h1 className="font-display text-[clamp(25px,3vw,34px)] font-bold">Orders</h1>
        <p className="mt-1 text-muted">Accept within {ACCEPT_WINDOW_HOURS} hours, dispatch within {DISPATCH_WINDOW_HOURS} hours, and get paid after the customer&rsquo;s review window.</p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {ORDER_FILTERS.map((item) => (
          <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)} className={`flex flex-none items-center gap-1.5 rounded-[10px] border px-3.5 py-2 text-sm font-semibold whitespace-nowrap ${filter === item.key ? "border-nav bg-nav text-white" : "border-line bg-panel"}`}>
            {item.label}
            <span className={`rounded-[9px] px-1.5 text-xs ${filter === item.key ? "bg-white/20" : "bg-tint"}`}>{count(item.statuses)}</span>
          </button>
        ))}
      </div>

      {q && (
        <div className="flex items-center gap-2 rounded-lg border border-link/35 bg-link/10 p-2.5 text-sm">
          Showing results for &ldquo;{query}&rdquo;.
          <button type="button" onClick={() => setQuery("")} className="font-semibold text-link hover:underline">Clear</button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-line bg-panel">
        <div className="hidden grid-cols-[100px_minmax(180px,1.6fr)_110px_1fr_140px_auto] gap-3 rounded-t-2xl bg-tint px-4 py-2.5 text-[13px] font-semibold text-muted md:grid">
          <span>Order</span><span>Product</span><span>Value</span><span>Buyer</span><span>Status</span><span />
        </div>
        {visible.length === 0 ? (
          <p className="p-6 text-muted">No orders in this view.</p>
        ) : (
          visible.map((order) => {
            const statusInfo = ORDER_STATUS[order.status];
            const value = order.itemValue ?? order.price * order.qty;
            const delivery = data ? (value > 0 && value < Number(data.rules.freeAbove) ? Number(data.rules.fee) : 0) : 0;
            return (
              <div key={order.shipmentId ?? order.id} className="grid grid-cols-1 gap-2 border-b border-line p-3.5 last:border-0 md:grid-cols-[100px_minmax(180px,1.6fr)_110px_1fr_140px_auto] md:items-center md:gap-3">
                <div><b>{order.orderCode ?? order.id}</b><small className="block font-normal text-muted">{order.createdLabel}</small></div>
                <div className="flex items-center gap-2.5">
                  <CategoryThumb category={order.productCategory} />
                  <div><b>{order.productName}</b><span className="block text-[13px] text-muted">{order.qty} {order.unit} · {Math.round(order.qty * order.weightKg).toLocaleString("en-IN")} kg{order.lines && order.lines.length > 1 ? ` · ${order.lines.length} lines` : ""}</span></div>
                </div>
                <div><b>{inr(value + delivery)}</b><small className="block font-normal text-muted">{delivery ? "+ delivery" : "free delivery"}</small></div>
                <div className="text-[13px]">{order.buyer}<br /><span className="text-muted">{order.city} {order.pin}</span></div>
                <div><Pill tone={statusInfo.tone}>{statusInfo.label}</Pill><div className="mt-1 text-[13px]">{order.acceptByLabel || order.dispatchByLabel || order.slot || order.reviewEndsLabel || order.paidAtLabel}</div></div>
                <div className="flex flex-wrap justify-start gap-1.5 md:justify-end">
                  {order.status === "new" && <Button size="sm" variant="yellow" disabled={busy === order.shipmentId} onClick={() => void run(order, () => acceptSellerShipment(order.shipmentId!)).catch(() => {})}>Accept</Button>}
                  {["accepted", "packed"].includes(order.status) && <Button size="sm" variant="yellow" disabled={busy === order.shipmentId} onClick={() => setDispatchTarget(order)}>Dispatch</Button>}
                  {order.status === "failed" && <Button size="sm" variant="yellow" disabled={busy === order.shipmentId} onClick={() => setReassignTarget(order)}>Reassign</Button>}
                  {order.status === "failed" && <Button size="sm" variant="line" disabled={busy === order.shipmentId} onClick={() => setMissedTarget(order)}>Mark missed</Button>}
                  <Button size="sm" variant="line" onClick={() => setDrawerId(order.shipmentId ?? order.id)}>Details</Button>
                </div>
              </div>
            );
          })
        )}
      </section>

      <OrderDrawer
        order={drawerOrder}
        vehicles={(data?.vehicles ?? []) as Vehicle[]}
        drivers={(data?.drivers ?? []) as Driver[]}
        rules={data?.rules ?? { freeAbove: "5000.00", fee: "199.00", slotsPerDay: [] }}
        busy={!!busy}
        onClose={() => setDrawerId(null)}
        onAccept={(order) => void run(order, () => acceptSellerShipment(order.shipmentId!)).catch(() => {})}
        onPack={(order) => void run(order, () => packSellerShipment(order.shipmentId!)).catch(() => {})}
        onReject={(order) => setRejectTarget(order)}
        onDispatch={(order) => setDispatchTarget(order)}
        onReassign={(order) => setReassignTarget(order)}
        onMarkMissed={(order) => setMissedTarget(order)}
      />

      <DispatchDialog
        order={dispatchTarget}
        vehicles={(data?.vehicles ?? []).map((vehicle) => ({ id: vehicle.id, regNumber: vehicle.regNumber, type: vehicle.type, driverName: vehicle.driverName }))}
        busy={!!busy}
        onClose={() => setDispatchTarget(null)}
        onDispatch={async (input: SellerDispatchInput) => {
          if (dispatchTarget) await run(dispatchTarget, () => dispatchSellerShipment(dispatchTarget.shipmentId!, input));
          setDispatchTarget(null);
        }}
      />

      <RejectDialog
        order={rejectTarget}
        busy={!!busy}
        onClose={() => setRejectTarget(null)}
        onReject={async (reason) => {
          if (rejectTarget) await run(rejectTarget, () => rejectSellerShipment(rejectTarget.shipmentId!, reason));
          setRejectTarget(null);
        }}
      />

      <ReassignDialog
        order={reassignTarget}
        vehicles={(data?.vehicles ?? []).map((vehicle) => ({ id: vehicle.id, regNumber: vehicle.regNumber, type: vehicle.type, driverName: vehicle.driverName }))}
        busy={!!busy}
        onClose={() => setReassignTarget(null)}
        onReassign={async (input: SellerDispatchInput) => {
          if (reassignTarget) await run(reassignTarget, () => redispatchSellerShipment(reassignTarget.shipmentId!, input));
          setReassignTarget(null);
        }}
      />

      <MissedDialog
        order={missedTarget}
        busy={!!busy}
        onClose={() => setMissedTarget(null)}
        onMarkMissed={async (reason) => {
          if (missedTarget) await run(missedTarget, () => markSellerShipmentMissed(missedTarget.shipmentId!, reason));
          setMissedTarget(null);
        }}
      />
    </div>
  );
}
