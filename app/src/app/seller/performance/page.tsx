// Seller Hub Performance — port of buildgrid-seller-dashboard.html's
// viewPerformance() (line 380): score ring + weighted metric bars, review
// histogram + list.
"use client";

import Card from "@/components/ui/Card";
import Pill from "@/components/ui/Pill";
import PreviewDisclosure from "@/components/seller/PreviewDisclosure";
import ScoreRing from "@/components/seller/ScoreRing";
import SellerIcon from "@/components/seller/SellerIcon";
import { useSellerStore } from "@/components/seller/SellerStoreProvider";
import { acceptanceRate, computeScore, issueFreeRate, onTimeRate, scoreTier } from "@/lib/seller/rules";

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

export default function SellerPerformancePage() {
  const { state } = useSellerStore();
  const { stats, reviews } = state;
  const score = computeScore(stats);
  const tier = scoreTier(score);
  const ringColor = score >= 90 ? "var(--ok)" : score >= 80 ? "var(--link)" : "var(--bad)";

  const avgRating = (reviews.reduce((a, r) => a + r.stars, 0) / reviews.length).toFixed(1);
  const histogram = [5, 4, 3, 2, 1].map((n) => reviews.filter((r) => r.stars === n).length);

  return (
    <div className="grid gap-4">
      <PreviewDisclosure />

      <div>
        <h1 className="font-display text-[clamp(25px,3vw,34px)] font-bold">Performance</h1>
        <p className="mt-1 text-muted">Your score decides how high you rank in search. It is calculated from your last orders.</p>
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
          <div className="mt-4 grid gap-3.5">
            <MetricBar label="Acceptance rate" value={acceptanceRate(stats)} note="Weight 30%. Accept every order you can fulfil within 4 hours." />
            <MetricBar label="On-time dispatch" value={onTimeRate(stats)} note="Weight 40%. Dispatch within 24 hours of accepting." />
            <MetricBar label="Issue-free deliveries" value={issueFreeRate(stats)} note="Weight 30%. Count, condition and item must match the order." />
          </div>
        </Card>

        <Card rounded="lg" className="p-[18px]">
          <div className="mb-3 flex items-center justify-between gap-3.5">
            <h2 className="font-display text-lg font-bold">Customer reviews</h2>
            <Pill tone="ok">
              <SellerIcon name="star" size={12} /> {avgRating} average
            </Pill>
          </div>
          <div className="mb-3 grid gap-1">
            {histogram.map((count, i) => (
              <div key={i} className="grid grid-cols-[48px_1fr_24px] items-center gap-2 text-[13px]">
                <span>{5 - i} star</span>
                <div className="h-2 overflow-hidden rounded bg-line">
                  <span className="block h-full bg-hi2" style={{ width: `${(count / reviews.length) * 100}%` }} />
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
