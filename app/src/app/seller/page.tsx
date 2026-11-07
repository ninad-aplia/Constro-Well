// Seller Hub Overview — port of buildgrid-seller-dashboard.html's
// viewOverview() (line 318). Client Component: reads/mutates the shared
// preview state (vacation toggle, navigation shortcuts) and holds the
// date-range selector locally.
"use client";

import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Pill from "@/components/ui/Pill";
import { useSellerStore } from "@/components/seller/SellerStoreProvider";
import PreviewDisclosure from "@/components/seller/PreviewDisclosure";
import SalesChart from "@/components/seller/SalesChart";
import SellerIcon from "@/components/seller/SellerIcon";
import { computeScore, scoreTier, netPayout } from "@/lib/seller/rules";
import {
  getBalance,
  getDisputedOrders,
  getLateOrders,
  getLowStockProducts,
  getNeedsAttention,
  getNewOrders,
  getReadyToDispatch,
  getTopProducts,
  rangeSum,
} from "@/lib/seller/selectors";
import { ORDER_STATUS } from "@/lib/seller/status";

const RANGES = [7, 30, 90] as const;
const AVG_ORDER_VALUE = 14200;

function formatInr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const pct = previous ? Math.round((current / previous - 1) * 100) : 0;
  const up = pct >= 0;
  return (
    <span className={`rounded-[10px] px-[7px] text-xs font-bold ${up ? "bg-ok/10 text-ok" : "bg-bad/10 text-bad"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

export default function SellerOverviewPage() {
  const { state, toggleVacation } = useSellerStore();
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);

  const score = computeScore(state.stats);
  const tier = scoreTier(score);
  const balance = getBalance(state);
  const lowStock = getLowStockProducts(state);
  const newOrders = getNewOrders(state);
  const readyToDispatch = getReadyToDispatch(state);
  const lateOrders = getLateOrders(state);
  const disputed = getDisputedOrders(state);
  const attention = getNeedsAttention(state);
  const topProducts = getTopProducts(state);
  const maxSold = topProducts[0]?.sold || 1;

  const current = rangeSum(state, range);
  const previous = rangeSum(state, range, range);
  const currentOrders = Math.round(current / AVG_ORDER_VALUE);
  const previousOrders = Math.round(previous / AVG_ORDER_VALUE);
  const chartData = state.dailySales.slice(-range);
  const dayLabels = chartData.map((_, i) => `Day ${i + 1}`);

  const tips: string[] = [];
  if (state.stats.accepted / state.stats.offered < 0.95) tips.push("Accept orders within the 4-hour window to lift your acceptance rate.");
  if (state.stats.ontime / Math.max(1, state.stats.dispatched) < 0.95) tips.push("Dispatch before the 24-hour deadline to avoid the 2% penalty.");
  if (lowStock.length) tips.push(`Restock ${lowStock.length} low-stock product${lowStock.length > 1 ? "s" : ""} so buyers do not see them as unavailable.`);
  if (!tips.length) tips.push("You are doing great. Keep accepting and dispatching on time.");

  const firstName = state.store.owner.split(" ")[0];

  return (
    <div className="grid gap-4">
      <PreviewDisclosure />

      {state.vacationMode && (
        <div className="flex items-center gap-3 rounded-xl border border-warn/45 bg-warn/10 p-3.5">
          <SellerIcon name="alert" size={20} />
          <div>
            <b>Vacation mode is on.</b> New orders are paused and your listings are hidden from search.
          </div>
          <Button variant="line" size="sm" className="ml-auto" onClick={toggleVacation}>
            Resume selling
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="font-display text-[clamp(25px,3vw,34px)] font-bold">
            Good day, {firstName}
          </h1>
          <p className="mt-1 text-muted">
            {state.store.name} · {state.store.city} · Here is what needs you today.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/seller/products?action=add">
            <Button variant="line" icon={<SellerIcon name="plus" size={16} />}>Add product</Button>
          </Link>
          <Link href="/seller/orders?filter=new">
            <Button variant="yellow">Review new orders</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/seller/orders?filter=new"
          className={`rounded-2xl border p-3.5 ${newOrders.length ? "border-bad/55 bg-bad/[0.06]" : "border-line bg-panel"}`}
        >
          <span className={`block font-display text-[28px] font-bold ${newOrders.length ? "text-bad" : "text-muted"}`}>{newOrders.length}</span>
          <b>New orders to accept</b>
          <small className="block text-muted">{newOrders.length ? `Oldest ${newOrders[0].acceptByLabel}` : "All caught up"}</small>
        </Link>
        <Link
          href="/seller/orders?filter=todo"
          className={`rounded-2xl border p-3.5 ${lateOrders.length ? "border-bad/55 bg-bad/[0.06]" : "border-line bg-panel"}`}
        >
          <span className={`block font-display text-[28px] font-bold ${lateOrders.length ? "text-bad" : ""}`}>{readyToDispatch.length}</span>
          <b>Ready to dispatch</b>
          <small className="block text-muted">{lateOrders.length ? `${lateOrders.length} overdue` : "All within deadline"}</small>
        </Link>
        <Link
          href="/seller/orders?filter=issue"
          className={`rounded-2xl border p-3.5 ${disputed.length ? "border-bad/55 bg-bad/[0.06]" : "border-line bg-panel"}`}
        >
          <span className={`block font-display text-[28px] font-bold ${disputed.length ? "text-bad" : "text-muted"}`}>{disputed.length}</span>
          <b>Open disputes</b>
          <small className="block text-muted">
            {disputed.length ? formatInr(disputed.reduce((a, o) => a + netPayout(o, state.rules.freeAbove, state.rules.fee), 0)) + " frozen" : "None"}
          </small>
        </Link>
        <Link
          href="/seller/products?filter=low"
          className={`rounded-2xl border p-3.5 ${lowStock.length ? "border-bad/55 bg-bad/[0.06]" : "border-line bg-panel"}`}
        >
          <span className={`block font-display text-[28px] font-bold ${lowStock.length ? "text-bad" : "text-muted"}`}>{lowStock.length}</span>
          <b>Low-stock products</b>
          <small className="block text-muted">{lowStock.length ? lowStock[0].name.split(",")[0] + (lowStock.length > 1 ? ` and ${lowStock.length - 1} more` : "") : "Stock is healthy"}</small>
        </Link>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2.5">
        <h2 className="font-display text-lg font-bold">Business at a glance</h2>
        <div className="inline-flex gap-[3px] rounded-[10px] border border-line bg-tint p-[3px]">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={`rounded-[7px] px-3 py-1 text-[13px] font-semibold ${range === r ? "bg-panel shadow" : ""}`}
            >
              {r} days
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Card rounded="lg" className="grid gap-1.5 p-4">
          <span className="text-[13px] font-semibold text-muted">Sales</span>
          <b className="font-display text-[28px] leading-tight font-bold">{formatCompact(current)}</b>
          <Delta current={current} previous={previous} />
        </Card>
        <Card rounded="lg" className="grid gap-1.5 p-4">
          <span className="text-[13px] font-semibold text-muted">Orders</span>
          <b className="font-display text-[28px] leading-tight font-bold">{currentOrders.toLocaleString("en-IN")}</b>
          <Delta current={currentOrders} previous={previousOrders} />
        </Card>
        <Card rounded="lg" className="grid gap-1.5 p-4">
          <span className="text-[13px] font-semibold text-muted">Average order value</span>
          <b className="font-display text-[28px] leading-tight font-bold">{formatInr(AVG_ORDER_VALUE)}</b>
          <span className="text-[13px] text-muted">Bulk discounts apply from 10 units</span>
        </Card>
        <Link href="/seller/performance">
          <Card rounded="lg" className="grid gap-1.5 p-4 hover:border-ink2">
            <span className="text-[13px] font-semibold text-muted">Delivery score</span>
            <b className="font-display text-[28px] leading-tight font-bold">
              {score}
              <small className="text-base font-normal text-muted">/100</small>
            </b>
            <Pill tone={tier.tone}>{tier.label}</Pill>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[2fr_1fr]">
        <Card rounded="lg" className="p-[18px]">
          <div className="mb-2 flex items-center justify-between gap-3.5">
            <h2 className="font-display text-lg font-bold">Sales</h2>
            <span className="text-[13px] text-muted">Daily, last {range} days</span>
          </div>
          <SalesChart data={chartData} dayLabels={dayLabels} />
        </Card>
        <Card rounded="lg" className="p-[18px]">
          <div className="mb-2 flex items-center justify-between gap-3.5">
            <h2 className="font-display text-lg font-bold">Payouts</h2>
            <Link href="/seller/payments" className="text-[13px] font-semibold text-link hover:underline">
              Details
            </Link>
          </div>
          <div className="grid gap-2.5">
            <div className="flex items-center justify-between gap-2.5 border-b border-line pb-2.5">
              <span>
                Available to withdraw
                <small className="block text-muted">Orders completed and cleared</small>
              </span>
              <b className="font-display text-[22px] font-bold">{formatInr(balance.available)}</b>
            </div>
            <div className="flex items-center justify-between gap-2.5 border-b border-line pb-2.5">
              <span>
                Pending release
                <small className="block text-muted">On the road or in review window</small>
              </span>
              <b>{formatInr(balance.pending)}</b>
            </div>
            <div className="flex items-center justify-between gap-2.5">
              <span>
                Frozen by disputes
                <small className="block text-muted">Until admin decides</small>
              </span>
              <b className={balance.frozen ? "text-bad" : ""}>{formatInr(balance.frozen)}</b>
            </div>
          </div>
          <Link href="/seller/payments">
            <Button variant="yellow" wide className="mt-3">
              Withdraw {formatInr(balance.available)}
            </Button>
          </Link>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <Card rounded="lg" className="p-[18px]">
          <h2 className="mb-2 font-display text-lg font-bold">Needs your attention</h2>
          {attention.length ? (
            <div className="grid gap-2.5">
              {attention.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2.5 border-b border-line pb-2.5 last:border-0">
                  <span>
                    <b>{o.id}</b> · {o.productName.split(",")[0]}
                    <small className="block text-muted">
                      {o.qty} {o.unit} · {o.city}
                    </small>
                  </span>
                  <span className="grid justify-items-end gap-1">
                    <Pill tone={ORDER_STATUS[o.status].tone}>{o.acceptByLabel || o.dispatchByLabel || ORDER_STATUS[o.status].label}</Pill>
                    <Link href={`/seller/orders?open=${o.id}`} className="text-[13px] font-semibold text-link hover:underline">
                      Open
                    </Link>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">Nothing urgent. Nice work.</p>
          )}
        </Card>
        <Card rounded="lg" className="p-[18px]">
          <div className="mb-2 flex items-center justify-between gap-3.5">
            <h2 className="font-display text-lg font-bold">Top products</h2>
            <span className="text-[13px] text-muted">units sold, 30 days</span>
          </div>
          <div className="grid gap-2.5">
            {topProducts.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5">
                <span className="min-w-0 flex-1">
                  <b className="font-semibold">{p.name.split(",")[0]}</b>
                  <div className="mt-1 h-2 overflow-hidden rounded bg-line">
                    <span className="block h-full bg-link" style={{ width: `${(p.sold / maxSold) * 100}%` }} />
                  </div>
                </span>
                <b>{p.sold.toLocaleString("en-IN")}</b>
              </div>
            ))}
          </div>
        </Card>
        <Card rounded="lg" className="p-[18px]">
          <h2 className="mb-2 font-display text-lg font-bold">How to improve</h2>
          <div className="grid gap-2.5">
            {tips.map((t) => (
              <div key={t} className="flex items-start gap-2">
                <SellerIcon name="check" size={16} />
                <span>{t}</span>
              </div>
            ))}
            <div className="border-t border-line pt-2.5">
              Recent review
              <small className="block text-muted">
                {state.reviews[0].name} · {"★".repeat(state.reviews[0].stars)}
                <br />
                {state.reviews[0].title}
              </small>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return formatInr(n);
}
