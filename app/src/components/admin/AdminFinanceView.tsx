// Admin finance oversight — collections, commission, remittances, allocations
// and adjustments. Every action here is audited by the FastAPI backend. COD is
// the seller's cash; remittances are platform cash only after receipt
// verification (never simulated).
"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Pill from "@/components/ui/Pill";
import AdminIcon from "@/components/admin/AdminIcon";
import { ApiClientError } from "@/lib/api/client";
import {
  allocateRemittance,
  applyAdjustment,
  createPolicy,
  disputeCollection,
  failRemittance,
  fetchAdminAdjustments,
  fetchAdminAssessments,
  fetchAdminCollections,
  fetchAdminDiscrepancies,
  fetchAdminRemittances,
  fetchRemittanceAllocations,
  reverseAdjustment,
  reverseAllocation,
  returnRemittance,
  runCommissionAssessments,
  verifyRemittance,
  waiveAssessment,
} from "@/lib/api/adminFinanceApi";
import type {
  AssessmentRunResultDto,
  CodCollectionDto,
  CommissionAssessmentDto,
  RemittanceAllocationDto,
  RemittanceDto,
  SellerAdjustmentDto,
} from "@/lib/api/financeDto";

function inr(value: string): string {
  const negative = value.startsWith("-");
  const raw = negative ? value.slice(1) : value;
  const [whole, frac] = raw.split(".");
  return `${negative ? "-" : ""}₹${Number(whole).toLocaleString("en-IN")}${frac ? `.${frac}` : ""}`;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return "Sign in as an admin.";
    if (error.status === 403) return "You do not have permission.";
    return error.message;
  }
  return "Could not reach the finance service. Try again.";
}

const REMITTANCE_LABEL: Record<string, string> = {
  initiated: "Initiated",
  received: "Received",
  allocated: "Allocated",
  failed: "Failed",
  returned: "Returned",
};

const REMITTANCE_TONE: Record<string, "neutral" | "ok" | "bad"> = {
  initiated: "neutral",
  received: "ok",
  allocated: "ok",
  failed: "bad",
  returned: "bad",
};

type Tab = "remittances" | "collections" | "assessments" | "adjustments";
const TABS: { key: Tab; label: string }[] = [
  { key: "remittances", label: "Remittances" },
  { key: "collections", label: "Collections" },
  { key: "assessments", label: "Commission" },
  { key: "adjustments", label: "Adjustments" },
];

type LoadState = "loading" | "ready" | "error";

export default function AdminFinanceView() {
  const [tab, setTab] = useState<Tab>("remittances");
  const [remittances, setRemittances] = useState<RemittanceDto[]>([]);
  const [collections, setCollections] = useState<CodCollectionDto[]>([]);
  const [discrepancies, setDiscrepancies] = useState<CodCollectionDto[]>([]);
  const [assessments, setAssessments] = useState<CommissionAssessmentDto[]>([]);
  const [adjustments, setAdjustments] = useState<SellerAdjustmentDto[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionOk, setActionOk] = useState("");

  const refresh = useCallback(async () => {
    const [r, c, d, a, adj] = await Promise.all([
      fetchAdminRemittances(),
      fetchAdminCollections(),
      fetchAdminDiscrepancies(),
      fetchAdminAssessments(),
      fetchAdminAdjustments(),
    ]);
    setRemittances(r);
    setCollections(c);
    setDiscrepancies(d);
    setAssessments(a);
    setAdjustments(adj);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchAdminRemittances(),
      fetchAdminCollections(),
      fetchAdminDiscrepancies(),
      fetchAdminAssessments(),
      fetchAdminAdjustments(),
    ])
      .then(([r, c, d, a, adj]) => {
        if (cancelled) return;
        setRemittances(r);
        setCollections(c);
        setDiscrepancies(d);
        setAssessments(a);
        setAdjustments(adj);
        setLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(messageOf(err));
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(
    async (
      key: string,
      ok: string | ((result: unknown) => string),
      fn: () => Promise<unknown>,
    ) => {
      setBusy(key);
      setActionError("");
      setActionOk("");
      try {
        const result = await fn();
        setActionOk(typeof ok === "function" ? ok(result) : ok);
        await refresh();
      } catch (err) {
        setActionError(messageOf(err));
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  if (loadState === "loading") return <p className="text-muted">Loading finance…</p>;
  if (loadState === "error") return <p className="text-bad">{error}</p>;

  return (
    // minmax(0,1fr): see SellerFinanceView — an implicit auto track would size
    // to the widest table and overflow the viewport on mobile.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div>
        <h1 className="font-display text-[clamp(25px,3vw,34px)] font-bold">Finance</h1>
        <p className="mt-1 text-muted">Seller-collected COD oversight — commission receivables, remittance verification and reconciliation.</p>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 rounded-lg border border-bad/40 bg-bad/10 p-2.5 text-sm text-bad">
          <AdminIcon name="alert" size={18} /> {actionError}
        </div>
      )}
      {actionOk && <div className="rounded-lg border border-ok/40 bg-ok/10 p-2.5 text-sm">{actionOk}</div>}

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${tab === t.key ? "bg-hi text-hiink" : "text-muted hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "remittances" && <RemittancesTab remittances={remittances} assessments={assessments} busy={busy} onAction={run} />}
      {tab === "collections" && <CollectionsTab collections={collections} discrepancies={discrepancies} busy={busy} onAction={run} />}
      {tab === "assessments" && <AssessmentsTab assessments={assessments} busy={busy} onAction={run} />}
      {tab === "adjustments" && <AdjustmentsTab adjustments={adjustments} busy={busy} onAction={run} />}
    </div>
  );
}

function RemittancesTab({
  remittances,
  assessments,
  busy,
  onAction,
}: {
  remittances: RemittanceDto[];
  assessments: CommissionAssessmentDto[];
  busy: string | null;
  onAction: (key: string, ok: string | ((result: unknown) => string), fn: () => Promise<unknown>) => void;
}) {
  const openAssessments = assessments.filter((a) => a.status === "assessed" || a.status === "partially_remitted");
  return (
    <Card rounded="lg" className="p-[18px]">
      <h2 className="mb-2 font-display text-lg font-bold">Remittances</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse">
          <thead>
            <tr>
              {["Seller", "Reference", "Method", "Status", "Amount", "Actions"].map((h, i) => (
                <th key={h} className={`border-b border-line px-3 py-2.5 text-[13px] font-semibold text-muted ${i === 4 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {remittances.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted">No remittances yet.</td></tr>
            ) : (
              remittances.map((r) => (
                <RemittanceRow key={r.id} remittance={r} assessments={openAssessments} busy={busy} onAction={onAction} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RemittanceRow({
  remittance,
  assessments,
  busy,
  onAction,
}: {
  remittance: RemittanceDto;
  assessments: CommissionAssessmentDto[];
  busy: string | null;
  onAction: (key: string, ok: string | ((result: unknown) => string), fn: () => Promise<unknown>) => void;
}) {
  const [showAlloc, setShowAlloc] = useState(false);
  const [allocations, setAllocations] = useState<RemittanceAllocationDto[]>([]);
  const [assessmentId, setAssessmentId] = useState(assessments[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [allocError, setAllocError] = useState("");

  const toggleAllocations = async () => {
    if (showAlloc) {
      setShowAlloc(false);
      return;
    }
    try {
      setAllocations(await fetchRemittanceAllocations(remittance.id));
      setShowAlloc(true);
    } catch (err) {
      setAllocError(messageOf(err));
    }
  };

  return (
    <>
      <tr>
        <td className="border-b border-line px-3 py-2.5 text-[13px]">{remittance.storeName ?? remittance.sellerId}</td>
        <td className="border-b border-line px-3 py-2.5">{remittance.reference}</td>
        <td className="border-b border-line px-3 py-2.5 text-[13px]">{remittance.method}</td>
        <td className="border-b border-line px-3 py-2.5"><Pill tone={REMITTANCE_TONE[remittance.status]}>{REMITTANCE_LABEL[remittance.status] ?? remittance.status}</Pill></td>
        <td className="border-b border-line px-3 py-2.5 text-right"><b>{inr(remittance.amount)}</b></td>
        <td className="border-b border-line px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {remittance.status === "initiated" && (
              <>
                <Button variant="yellow" disabled={busy === `verify-${remittance.id}`} onClick={() => onAction(`verify-${remittance.id}`, "Remittance verified.", () => verifyRemittance(remittance.id))}>
                  {busy === `verify-${remittance.id}` ? "…" : "Verify"}
                </Button>
                <Button variant="line" disabled={busy === `fail-${remittance.id}`} onClick={() => onAction(`fail-${remittance.id}`, "Remittance failed.", () => failRemittance(remittance.id))}>
                  {busy === `fail-${remittance.id}` ? "…" : "Fail"}
                </Button>
              </>
            )}
            {remittance.status === "received" && (
              <Button variant="line" disabled={busy === `return-${remittance.id}`} onClick={() => onAction(`return-${remittance.id}`, "Remittance returned.", () => returnRemittance(remittance.id))}>
                {busy === `return-${remittance.id}` ? "…" : "Return"}
              </Button>
            )}
            {(remittance.status === "received" || remittance.status === "allocated") && (
              <Button variant="line" onClick={toggleAllocations}>Allocations</Button>
            )}
          </div>
        </td>
      </tr>

      {showAlloc && (
        <tr>
          <td colSpan={6} className="border-b border-line px-3 py-3">
            <div className="grid gap-2">
              {allocations.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-[13px]">
                  <Pill tone={a.kind === "allocation" ? "ok" : "bad"}>{a.kind}</Pill>
                  <span className="text-muted">assessment {a.assessmentId}</span>
                  <b className="ml-auto">{inr(a.amount)}</b>
                  {a.kind === "allocation" && (
                    <Button variant="line" disabled={busy === `rev-${a.id}`} onClick={() => onAction(`rev-${a.id}`, "Allocation reversed.", () => reverseAllocation(a.id))}>
                      {busy === `rev-${a.id}` ? "…" : "Reverse"}
                    </Button>
                  )}
                </div>
              ))}
              {allocError && <p className="text-[13px] text-bad">{allocError}</p>}

              <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
                <select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} className="rounded-md border border-line bg-bg px-2 py-1.5 text-sm">
                  <option value="">Select assessment…</option>
                  {assessments.map((a) => (
                    <option key={a.id} value={a.id}>assessment {a.id.slice(0, 8)} ({inr(a.commissionAmount)})</option>
                  ))}
                </select>
                <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="w-24 rounded-md border border-line bg-bg px-2 py-1.5 text-sm" />
                <Button variant="yellow" disabled={busy === `alloc-${remittance.id}` || !assessmentId || !amount} onClick={() => onAction(`alloc-${remittance.id}`, "Allocated.", () => allocateRemittance(remittance.id, assessmentId, amount))}>
                  {busy === `alloc-${remittance.id}` ? "…" : "Allocate"}
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function CollectionsTab({
  collections,
  discrepancies,
  busy,
  onAction,
}: {
  collections: CodCollectionDto[];
  discrepancies: CodCollectionDto[];
  busy: string | null;
  onAction: (key: string, ok: string | ((result: unknown) => string), fn: () => Promise<unknown>) => void;
}) {
  const discrepancyIds = new Set(discrepancies.map((d) => d.id));
  return (
    <Card rounded="lg" className="p-[18px]">
      <h2 className="mb-2 font-display text-lg font-bold">COD collections</h2>
      <p className="mb-2 text-[13px] text-muted">{discrepancies.length} discrepancy · flagged rows have a confirmed amount differing from expected.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr>
              {["Seller", "Shipment", "Status", "Expected", "Collected", "Actions"].map((h, i) => (
                <th key={h} className={`border-b border-line px-3 py-2.5 text-[13px] font-semibold text-muted ${i >= 3 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {collections.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted">No collections yet.</td></tr>
            ) : (
              collections.map((c) => (
                <tr key={c.id}>
                  <td className="border-b border-line px-3 py-2.5 text-[13px]">{c.storeName ?? c.sellerId}</td>
                  <td className="border-b border-line px-3 py-2.5">{c.shipmentId}</td>
                  <td className="border-b border-line px-3 py-2.5"><Pill tone={c.status === "disputed" ? "bad" : c.status === "confirmed" ? "ok" : "neutral"}>{c.status}</Pill></td>
                  <td className="border-b border-line px-3 py-2.5 text-right">{inr(c.expectedAmount)}</td>
                  <td className="border-b border-line px-3 py-2.5 text-right">{c.collectedAmount ? <b className={discrepancyIds.has(c.id) ? "text-bad" : ""}>{inr(c.collectedAmount)}</b> : "—"}</td>
                  <td className="border-b border-line px-3 py-2.5 text-right">
                    {(c.status === "pending" || c.status === "confirmed") && (
                      <Button variant="line" disabled={busy === `dispute-${c.id}`} onClick={() => onAction(`dispute-${c.id}`, "Collection disputed.", () => disputeCollection(c.id))}>
                        {busy === `dispute-${c.id}` ? "…" : "Dispute"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AssessmentsTab({
  assessments,
  busy,
  onAction,
}: {
  assessments: CommissionAssessmentDto[];
  busy: string | null;
  onAction: (key: string, ok: string | ((result: unknown) => string), fn: () => Promise<unknown>) => void;
}) {
  const [basis, setBasis] = useState("order_value");
  const [rate, setRate] = useState("");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5">
      <Card rounded="lg" className="p-[18px]">
        <h2 className="mb-2 font-display text-lg font-bold">Commission policy</h2>
        <p className="mb-2 text-[13px] text-muted">Configure the commission basis and rate. An assessment fails closed when no active policy exists — no rate is assumed.</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <select value={basis} onChange={(e) => setBasis(e.target.value)} className="rounded-md border border-line bg-bg px-2 py-1.5 text-sm">
            <option value="order_value">Basis: order value</option>
            <option value="collected_cod">Basis: collected COD</option>
          </select>
          <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Rate (e.g. 0.05)" className="w-40 rounded-md border border-line bg-bg px-2 py-1.5 text-sm" />
          <Button variant="yellow" disabled={busy === "policy" || !rate} onClick={() => onAction("policy", "Policy created.", () => createPolicy(basis, rate))}>
            {busy === "policy" ? "…" : "Create policy"}
          </Button>
        </div>
      </Card>

      <Card rounded="lg" className="p-[18px]">
        <h2 className="mb-2 font-display text-lg font-bold">Assessments</h2>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button
            variant="yellow"
            disabled={busy === "commission-run"}
            onClick={() =>
              onAction(
                "commission-run",
                (result) => {
                  const run = result as AssessmentRunResultDto;
                  const failed = run.failed.length ? ` · ${run.failed.length} failed` : "";
                  return `Assessed ${run.created} · already assessed ${run.skipped}${failed} at ${run.rate}.`;
                },
                () => runCommissionAssessments(),
              )
            }
          >
            {busy === "commission-run" ? "Assessing…" : "Run assessments"}
          </Button>
          <span className="text-[13px] text-muted">
            Assesses every confirmed collection that has none. Safe to re-run; nothing is assessed without an active policy.
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                {["Seller", "Shipment", "Basis", "Rate", "Commission", "Status", "Actions"].map((h, i) => (
                  <th key={h} className={`border-b border-line px-3 py-2.5 text-[13px] font-semibold text-muted ${i >= 4 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assessments.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-muted">No assessments yet.</td></tr>
              ) : (
                assessments.map((a) => (
                  <tr key={a.id}>
                    <td className="border-b border-line px-3 py-2.5 text-[13px]">{a.storeName ?? a.sellerId}</td>
                    <td className="border-b border-line px-3 py-2.5">{a.shipmentId}</td>
                    <td className="border-b border-line px-3 py-2.5 text-[13px]">{a.basis}</td>
                    <td className="border-b border-line px-3 py-2.5 text-[13px]">{a.rate}</td>
                    <td className="border-b border-line px-3 py-2.5 text-right"><b>{inr(a.commissionAmount)}</b></td>
                    <td className="border-b border-line px-3 py-2.5"><Pill tone={a.status === "waived" ? "neutral" : a.status === "remitted" ? "ok" : "neutral"}>{a.status}</Pill></td>
                    <td className="border-b border-line px-3 py-2.5 text-right">
                      {a.status === "assessed" && (
                        <Button variant="line" disabled={busy === `waive-${a.id}`} onClick={() => onAction(`waive-${a.id}`, "Assessment waived.", () => waiveAssessment(a.id))}>
                          {busy === `waive-${a.id}` ? "…" : "Waive"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AdjustmentsTab({
  adjustments,
  busy,
  onAction,
}: {
  adjustments: SellerAdjustmentDto[];
  busy: string | null;
  onAction: (key: string, ok: string | ((result: unknown) => string), fn: () => Promise<unknown>) => void;
}) {
  return (
    <Card rounded="lg" className="p-[18px]">
      <h2 className="mb-2 font-display text-lg font-bold">Seller adjustments &amp; refunds</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr>
              {["Seller", "Type", "Reason", "Status", "Amount", "Actions"].map((h, i) => (
                <th key={h} className={`border-b border-line px-3 py-2.5 text-[13px] font-semibold text-muted ${i === 4 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {adjustments.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted">No adjustments yet.</td></tr>
            ) : (
              adjustments.map((a) => (
                <tr key={a.id}>
                  <td className="border-b border-line px-3 py-2.5 text-[13px]">{a.storeName ?? a.sellerId}</td>
                  <td className="border-b border-line px-3 py-2.5 text-[13px]">{a.type === "customer_refund" ? "Customer refund" : a.type === "reversal" ? "Reversal" : "Adjustment"}</td>
                  <td className="border-b border-line px-3 py-2.5 text-[13px] text-muted">{a.reason}</td>
                  <td className="border-b border-line px-3 py-2.5"><Pill tone={a.status === "applied" ? "ok" : "neutral"}>{a.status}</Pill></td>
                  <td className="border-b border-line px-3 py-2.5 text-right"><b>{inr(a.amount)}</b></td>
                  <td className="border-b border-line px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {a.status === "open" && (
                        <Button variant="yellow" disabled={busy === `apply-${a.id}`} onClick={() => onAction(`apply-${a.id}`, "Adjustment applied.", () => applyAdjustment(a.id))}>
                          {busy === `apply-${a.id}` ? "…" : "Apply"}
                        </Button>
                      )}
                      {a.status === "applied" && a.type !== "reversal" && (
                        <Button variant="line" disabled={busy === `rev-${a.id}`} onClick={() => onAction(`rev-${a.id}`, "Adjustment reversed.", () => reverseAdjustment(a.id, "Reversed by admin"))}>
                          {busy === `rev-${a.id}` ? "…" : "Reverse"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
