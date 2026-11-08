// Seller Hub Performance — port of buildgrid-seller-dashboard.html's
// viewPerformance() (line 380): score ring + weighted metric bars, review
// histogram + list. The score and metric bars are now computed from real
// Shipment data (server/orders/sellerService.ts:sellerPerformanceStats),
// reusing the exact scoring math in lib/seller/rules.ts. Customer reviews
// stay preview data: the catalogue's Review model is per-product, not
// attributed to a specific seller, so there is no real "this seller's
// reviews" query to run yet.
"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Pill from "@/components/ui/Pill";
import PreviewDisclosure from "@/components/seller/PreviewDisclosure";
import ScoreRing from "@/components/seller/ScoreRing";
import SellerIcon from "@/components/seller/SellerIcon";
import { useSellerStore } from "@/components/seller/SellerStoreProvider";
import { ApiClientError } from "@/lib/api/client";
import { fetchSellerPerformance } from "@/lib/api/sellerApi";
import type { SellerPerformanceDto } from "@/lib/api/sellerOrderDto";
import { acceptanceRate, issueFreeRate, onTimeRate, scoreTier } from "@/lib/seller/rules";

function messageOf(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return "Sign in as a seller to view performance.";
    if (error.status === 403) return "This account does not have a seller profile.";
    return error.message;
  }
  return "Could not reach the performance service. Try again.";
}

function MetricBar({ label, value, note }: { label: string; value: number; note: string }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.95 ? "bg-ok" : value >= 0.85 ? "bg-link" : "bg-bad";
  return (
    <div>
      <div className="flex justify-between text-sm font-semibold">
        <b>{label}</b>
        <b>{pct}%</b>
      </div>
      <div className="my-1.5 h-2 overflow-hidden rounded bg-line">
        <span className={`block h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[13px] text-muted">{note}</span>
    </div>
  );
}

type LoadState = "loading" | "ready" | "error";

export default function SellerPerformancePage() {
  const { state } = useSellerStore();
  const { reviews } = state;
  const [data, setData] = useState<SellerPerformanceDto | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchSellerPerformance()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoadState("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(messageOf(err));
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadState === "loading") return <p className="text-muted">Loading performance…</p>;
  if (loadState === "error" || !data) return <p className="text-bad">{loadError}</p>;

  const { stats, score } = data;
  const tier = scoreTier(score);
  const ringColor = score >= 90 ? "var(--ok)" : score >= 80 ? "var(--link)" : "var(--bad)";

  const avgRating = reviews.length ? (reviews.reduce((a, r) => a + r.stars, 0) / reviews.length).toFixed(1) : "0.0";
  const histogram = [5, 4, 3, 2, 1].map((n) => reviews.filter((r) => r.stars === n).length);

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-[clamp(25px,3vw,34px)] font-bold">Performance</h1>
        <p className="mt-1 text-muted">Your score decides how high you rank in search. It is calculated from your order and shipment history.</p>
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Card rounded="lg" className="p-[18px]">
          <div className="flex flex-wrap items-center gap-5">
            <ScoreRing score={score} color={ringColor} />
            <div className="min-w-[200px] flex-1">
              <h2 className="font-display text-lg font-bold">Delivery score</h2>
              <Pill tone={tier.tone} className="my-1.5">
                {tier.label}
              </Pill>
              <p className="text-[13px] text-muted">90 and above: boosted in search. 80 to 89: normal. Below 80: reduced visibility.</p>
            </div>
          </div>
          {stats.offered === 0 ? (
            <p className="mt-4 text-[13px] text-muted">No completed orders yet — your score starts at a perfect baseline and updates as orders come in.</p>
          ) : (
            <div className="mt-4 grid gap-3.5">
              <MetricBar label="Acceptance rate" value={acceptanceRate(stats)} note={`Weight 30%. ${stats.accepted} of ${stats.offered} offered orders accepted.`} />
              <MetricBar label="On-time dispatch" value={onTimeRate(stats)} note={`Weight 40%. ${stats.ontime} of ${stats.dispatched} dispatched orders were on time.`} />
              <MetricBar label="Issue-free deliveries" value={issueFreeRate(stats)} note={`Weight 30%. ${stats.delivered - stats.issues} of ${stats.delivered} delivered orders had no reported issue.`} />
            </div>
          )}
        </Card>

        <Card rounded="lg" className="p-[18px]">
          <div className="mb-3 flex items-center justify-between gap-3.5">
            <h2 className="font-display text-lg font-bold">Customer reviews</h2>
            <Pill tone="ok">
              <SellerIcon name="star" size={12} /> {avgRating} average
            </Pill>
          </div>
          <PreviewDisclosure
            className="mb-2.5"
            message="Reviews shown here are preview data — the catalogue does not yet attribute product reviews to a specific seller."
          />
          <div className="mb-3 grid gap-1">
            {histogram.map((count, i) => (
              <div key={i} className="grid grid-cols-[48px_1fr_24px] items-center gap-2 text-[13px]">
                <span>{5 - i} star</span>
                <div className="h-2 overflow-hidden rounded bg-line">
                  <span className="block h-full bg-hi2" style={{ width: `${reviews.length ? (count / reviews.length) * 100 : 0}%` }} />
                </div>
                <span>{count}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-2.5">
            {reviews.map((r, i) => (
              <div key={i} className="border-b border-line pb-2.5 last:border-0">
                <b>{r.name}</b>{" "}
                <span className="text-hi2">{"★".repeat(r.stars)}</span>
                <span className="text-muted">{"★".repeat(5 - r.stars)}</span>
                <small className="block text-muted">
                  {r.productName} · {r.daysAgo} days ago
                </small>
                {r.title}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card rounded="lg" className="p-[18px]">
        <h2 className="mb-2 font-display text-lg font-bold">Why the score matters</h2>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <div className="flex items-start gap-2.5 rounded-lg border border-ok/40 bg-ok/10 p-2.5 text-sm">
            <SellerIcon name="star" size={18} />
            <div>
              <b>90+ gets more orders.</b> Boosted sellers appear first when buyers search.
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border border-warn/40 bg-warn/10 p-2.5 text-sm">
            <SellerIcon name="clock" size={18} />
            <div>
              <b>Late dispatch costs money.</b> A 2% penalty is deducted from that order&rsquo;s payout.
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border border-link/35 bg-link/10 p-2.5 text-sm">
            <SellerIcon name="shield" size={18} />
            <div>
              <b>Proof protects you.</b> Photos at loading and the delivery OTP settle most disputes in your favour.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
