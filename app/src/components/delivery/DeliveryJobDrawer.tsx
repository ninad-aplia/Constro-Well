// Delivery job detail + completion workflow — port of buildgrid-delivery-workflow.html's
// driver screen body (`viewDriver()` line 315): pickup/drop-off info,
// documents, OTP entry (4 boxes), proof checkbox, delivered-quantity input,
// and issue reporting. Delivery and OTP verification are persisted by
// /api/driver/jobs; the driver never sees the customer's OTP.
"use client";

import { useState } from "react";
import Pill from "@/components/ui/Pill";
import Button from "@/components/ui/Button";
import SellerIcon from "@/components/seller/SellerIcon";
import { useDeliveryStore } from "./DeliveryStoreProvider";
import { DELIVERY_STATUS } from "@/lib/delivery/status";
import { MAX_OTP_TRIES } from "@/lib/delivery/rules";
import type { DeliveryJob } from "@/lib/delivery/types";
import { ApiClientError } from "@/lib/api/client";
import type { DriverIssueType } from "@/lib/api/driverApi";

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function messageOf(error: unknown): string {
  return error instanceof ApiClientError ? error.message : "Could not reach the delivery service.";
}

const ISSUE_OPTIONS: { value: DriverIssueType; label: string }[] = [
  { value: "failed_attempt", label: "Customer unavailable" },
  { value: "failed_attempt", label: "Address or serviceability issue" },
  { value: "damaged_goods", label: "Damaged goods" },
  { value: "short_quantity", label: "Short quantity" },
];

export default function DeliveryJobDrawer({ job, onClose }: { job: DeliveryJob | null; onClose: () => void }) {
  const { state, busyId, acceptJob, confirmPickup, confirmDelivery, reportIssue } = useDeliveryStore();
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [photoConfirmed, setPhotoConfirmed] = useState(false);
  const [qty, setQty] = useState<number | "">("");
  const [issueOption, setIssueOption] = useState(0);
  const [issueNote, setIssueNote] = useState("");  const [issueQty, setIssueQty] = useState<number | "">("");
  const [error, setError] = useState("");
  const [issueError, setIssueError] = useState("");

  if (!job) return null;

  const status = DELIVERY_STATUS[job.status];
  const canComplete = job.status === "dispatched" || job.status === "picked_up";
  const busy = busyId === job.shipmentId;
  const issueType = ISSUE_OPTIONS[issueOption]?.value ?? "failed_attempt";

  const resetForm = () => {
    setOtp(["", "", "", ""]);
    setPhotoConfirmed(false);
    setQty("");
    setIssueNote("");
    setIssueQty("");
    setError("");
    setIssueError("");
  };

  const close = () => {
    resetForm();
    onClose();
  };

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, "").slice(-1);
    setOtp((prev) => prev.map((p, idx) => (idx === i ? d : p)));
  };

  const accept = async () => {
    setError("");
    try {
      await acceptJob(job);
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const pickup = async () => {
    setError("");
    try {
      await confirmPickup(job);
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const submit = async () => {
    const code = otp.join("");
    setError("");
    if (code.length < 4) {
      setError("Enter the 4-digit OTP from the customer.");
      return;
    }
    if (!photoConfirmed) {
      setError("Confirm the goods were photographed before completing the delivery.");
      return;
    }
    try {
      await confirmDelivery(job, { otp: code, photoConfirmed, deliveredQty: qty === "" ? job.qty : qty });
      setOtp(["", "", "", ""]);
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const submitIssue = async () => {
    setIssueError("");
    if (issueNote.trim().length < 3) {
      setIssueError("Describe what happened.");
      return;
    }
    if (issueType === "short_quantity" && issueQty === "") {
      setIssueError("Enter the quantity actually delivered.");
      return;
    }
    try {
      await reportIssue(job, {
        type: issueType,
        note: issueNote,
        ...(issueType === "short_quantity" ? { deliveredQty: Number(issueQty) } : {}),
      });
      setIssueNote("");
      setIssueQty("");
    } catch (err) {
      setIssueError(messageOf(err));
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-80 bg-[rgba(5,12,24,0.5)]" onClick={close} />
      <aside className="fixed top-0 right-0 bottom-0 z-90 flex w-[min(480px,100%)] flex-col bg-panel shadow-card">
        <div className="flex items-start justify-between gap-2.5 border-b border-line p-4">
          <div>
            <h2 className="font-display text-lg font-bold">{job.id}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Pill tone={status.tone}>{status.label}</Pill>
              {job.accepted && <Pill tone="ok">Accepted</Pill>}
              {job.slot && <Pill tone="info">{job.slot}</Pill>}
            </div>
          </div>
          <button type="button" onClick={close} aria-label="Close" className="grid h-[42px] w-[42px] flex-none place-items-center rounded-xl border border-line">
            <SellerIcon name="x" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="grid gap-3.5">
            <div>
              <b>{job.productName}</b>
              <span className="block text-[13px] text-muted">
                {job.qty} {job.unit} · {inr(job.price)} each
              </span>
            </div>

            <dl className="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5 text-sm">
              <dt className="text-muted">Pickup</dt>
              <dd>{state.storeName}</dd>
              <dt className="text-muted">Drop-off</dt>
              <dd>
                {job.buyer}, {job.city} {job.pin}
              </dd>
              {job.vehicleReg && (
                <>
                  <dt className="text-muted">Vehicle</dt>
                  <dd>
                    {job.vehicleReg}, {job.vehicleType}
                  </dd>
                  <dt className="text-muted">Driver</dt>
                  <dd>
                    {job.driverName} <span className="text-muted">{job.driverPhone}</span>
                  </dd>
                </>
              )}
              {job.docs && (
                <>
                  <dt className="text-muted">Documents</dt>
                  <dd>
                    {[
                      job.docs.challan && "Challan",
                      job.docs.invoice && "GST invoice",
                      job.docs.eway && `E-way ${job.docs.eway}`,
                      job.docs.weighbridge && `Weighbridge ${job.docs.weighbridge}`,
                    ]
                      .filter(Boolean)
                      .join(", ") || "Not uploaded yet"}
                  </dd>
                </>
              )}
            </dl>

            {job.status === "failed" && job.issue && (
              <div className="flex items-start gap-2.5 rounded-lg border border-bad/40 bg-bad/10 p-2.5 text-sm">
                <SellerIcon name="alert" size={18} />
                <div>
                  <b>{job.issue.type}.</b> {job.issue.note} The seller will need to reschedule this delivery.
                </div>
              </div>
            )}
            {job.status === "disputed" && job.issue && (
              <div className="flex items-start gap-2.5 rounded-lg border border-bad/40 bg-bad/10 p-2.5 text-sm">
                <SellerIcon name="alert" size={18} />
                <div>
                  <b>{job.issue.type}.</b> {job.issue.note} {job.issue.claim ? `Claim ${inr(job.issue.claim)}, ` : ""}payout frozen
                  until an admin review.
                </div>
              </div>
            )}
            {job.status === "review" && (
              <div className="flex items-start gap-2.5 rounded-lg border border-ok/40 bg-ok/10 p-2.5 text-sm">
                <SellerIcon name="check" size={18} />
                <div>
                  Delivered. Customer review window: <b>{job.reviewEndsLabel}</b>.
                </div>
              </div>
            )}
            {job.status === "settled" && (
              <div className="flex items-start gap-2.5 rounded-lg border border-ok/40 bg-ok/10 p-2.5 text-sm">
                <SellerIcon name="shield" size={18} />
                <div>Review window closed with no issues. Paid {job.paidAtLabel}.</div>
              </div>
            )}
            {job.deliveredQty != null && (job.status === "review" || job.status === "disputed" || job.status === "settled") && (
              <p className="text-[13px] text-muted">
                Recorded {job.deliveredQty} of {job.qty} {job.unit} delivered{job.deliveredAtLabel ? `, ${job.deliveredAtLabel}` : ""}.
              </p>
            )}

            {canComplete && !job.accepted && (
              <div className="flex items-start gap-2.5 rounded-lg border border-link/35 bg-link/10 p-2.5 text-sm">
                <SellerIcon name="truck" size={18} />
                <div className="grid gap-2">
                  <span>Accept this job before you start the delivery.</span>
                  <Button variant="yellow" disabled={busy} onClick={() => void accept()}>
                    {busy ? "Accepting…" : "Accept job"}
                  </Button>
                </div>
              </div>
            )}

            {job.status === "dispatched" && job.accepted && (
              <div className="flex items-start gap-2.5 rounded-lg border border-link/35 bg-link/10 p-2.5 text-sm">
                <SellerIcon name="truck" size={18} />
                <div className="grid gap-2">
                  <span>
                    <b>Confirm pickup.</b> Confirm you collected the goods from the seller. The delivery OTP stays visible to the
                    customer and is required at drop-off.
                  </span>
                  <Button variant="yellow" disabled={busy} onClick={() => void pickup()}>
                    {busy ? "Confirming." : "Confirm pickup"}
                  </Button>
                </div>
              </div>
            )}

            {job.status === "picked_up" && (
              <div className="flex items-start gap-2.5 rounded-lg border border-ok/40 bg-ok/10 p-2.5 text-sm">
                <SellerIcon name="check" size={18} />
                <div>
                  <b>Picked up.</b> Goods collected from the seller. Collect the delivery OTP at drop-off to complete the delivery.
                </div>
              </div>
            )}

            {canComplete && (
              <div className="grid gap-3 rounded-xl border border-line p-3.5">
                <div>
                  <b className="text-sm">1. Ask the customer for their delivery OTP</b>
                  <p className="mt-0.5 text-[13px] text-muted">
                    The OTP is shown in the customer&rsquo;s order page. It is never shown in this portal.
                  </p>
                  <div className="mt-1.5 flex justify-center gap-2">
                    {otp.map((d, i) => (
                      <input
                        key={i}
                        inputMode="numeric"
                        maxLength={1}
                        aria-label={`OTP digit ${i + 1}`}
                        value={d}
                        onChange={(e) => setDigit(i, e.target.value)}
                        className="h-[54px] w-11 rounded-lg border-2 border-line text-center font-display text-2xl font-bold"
                      />
                    ))}
                  </div>
                  {job.otpTries > 0 && <p className="mt-1 text-center text-[13px] font-medium text-bad">{MAX_OTP_TRIES - job.otpTries} tries left</p>}
                </div>

                <button
                  type="button"
                  onClick={() => setPhotoConfirmed((v) => !v)}
                  className={`flex items-center gap-2.5 rounded-lg border border-dashed p-2.5 text-left ${photoConfirmed ? "border-ok bg-ok/10" : "border-line"}`}
                >
                  <SellerIcon name={photoConfirmed ? "check" : "doc"} size={18} />
                  <span>
                    <b>2. Photo of the unloaded goods</b>
                    <br />
                    <span className="text-[13px] text-muted">
                      {photoConfirmed ? "Photo taken and kept on your phone" : "Take a photo on your phone, then tap here"}
                    </span>
                  </span>
                </button>

                <label className="grid gap-1 text-sm font-semibold">
                  3. Quantity delivered ({job.unit})
                  <input
                    type="number"
                    min={0}
                    max={job.qty}
                    placeholder={String(job.qty)}
                    value={qty}
                    onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))}
                    className="h-10 rounded-lg border border-line bg-panel px-2.5"
                  />
                  {(qty === "" ? job.qty : qty) < job.qty && (
                    <span className="text-[13px] font-medium text-warn">Less than ordered opens a short-quantity dispute.</span>
                  )}
                </label>

                {error && <p role="alert" className="rounded-lg border border-bad bg-panel p-2.5 text-[13px] font-medium text-bad">{error}</p>}
                <Button variant="yellow" wide disabled={busy} onClick={() => void submit()}>
                  {busy ? "Verifying…" : "Confirm delivery"}
                </Button>
              </div>
            )}

            {canComplete && (
              <div className="grid gap-2 rounded-xl border border-line p-3.5">
                <b className="text-sm">Report a delivery issue</b>
                <p className="text-[13px] text-muted">Reporting an issue does not mark the shipment delivered.</p>
                <label className="grid gap-1 text-sm font-semibold">
                  Issue
                  <select
                    className="h-10 rounded-lg border border-line bg-panel px-2.5"
                    value={issueOption}
                    onChange={(e) => setIssueOption(Number(e.target.value))}
                    aria-label="Issue type"
                  >
                    {ISSUE_OPTIONS.map((option, index) => (
                      <option key={`${option.value}-${index}`} value={index}>{option.label}</option>
                    ))}
                  </select>
                </label>
                {issueType === "short_quantity" && (
                  <label className="grid gap-1 text-sm font-semibold">
                    Quantity actually delivered ({job.unit})
                    <input
                      type="number"
                      min={0}
                      max={job.qty - 1}
                      value={issueQty}
                      onChange={(e) => setIssueQty(e.target.value === "" ? "" : Number(e.target.value))}
                      className="h-10 rounded-lg border border-line bg-panel px-2.5"
                    />
                  </label>
                )}
                <label className="grid gap-1 text-sm font-semibold">
                  What happened
                  <textarea
                    rows={2}
                    maxLength={300}
                    value={issueNote}
                    onChange={(e) => setIssueNote(e.target.value)}
                    className="rounded-lg border border-line bg-panel p-2.5 text-sm font-normal"
                    placeholder="Customer not reachable, gate locked, damaged bag…"
                  />
                </label>
                {issueError && <p role="alert" className="rounded-lg border border-bad bg-panel p-2.5 text-[13px] font-medium text-bad">{issueError}</p>}
                <Button variant="line" wide disabled={busy} onClick={() => void submitIssue()}>
                  {busy ? "Saving…" : "Report issue"}
                </Button>
              </div>
            )}

            <div>
              <h3 className="mb-1.5 font-semibold">Activity</h3>
              <ol className="grid gap-1.5">
                {[...job.events].reverse().map((e, i) => (
                  <li key={i} className="grid grid-cols-[100px_1fr] gap-2 border-b border-dashed border-line py-1.5 text-[13px] last:border-0">
                    <small className="text-muted">{e.at}</small>
                    <span>{e.message}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
