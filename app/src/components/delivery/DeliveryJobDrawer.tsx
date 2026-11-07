// Delivery job detail + completion workflow — port of buildgrid-delivery-workflow.html's
// driver screen body (`viewDriver()` line 315): pickup/drop-off info,
// documents, OTP entry (4 boxes), photo-proof toggle, delivered-quantity
// input, and the "Customer not available" failed-attempt action. For
// historical jobs (already delivered/disputed/settled) this renders a
// read-only summary instead of the completion form, same as the prototype's
// own status-gated body.
"use client";

import { useState } from "react";
import Pill from "@/components/ui/Pill";
import Button from "@/components/ui/Button";
import SellerIcon from "@/components/seller/SellerIcon";
import { useDeliveryStore } from "./DeliveryStoreProvider";
import { vehicleFor, driverFor } from "@/lib/delivery/selectors";
import { DELIVERY_STATUS } from "@/lib/delivery/status";
import type { DeliveryJob } from "@/lib/delivery/types";

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function DeliveryJobDrawer({ job, onClose }: { job: DeliveryJob | null; onClose: () => void }) {
  const { state, confirmDelivery, markFailedAttempt } = useDeliveryStore();
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [photoConfirmed, setPhotoConfirmed] = useState(false);
  const [qty, setQty] = useState<number | "">("");

  if (!job) return null;

  const vehicle = vehicleFor(state, job);
  const driver = driverFor(state, job);
  const status = DELIVERY_STATUS[job.status];
  const canComplete = job.status === "dispatched";

  const resetForm = () => {
    setOtp(["", "", "", ""]);
    setPhotoConfirmed(false);
    setQty("");
  };

  const close = () => {
    resetForm();
    onClose();
  };

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, "").slice(-1);
    setOtp((prev) => prev.map((p, idx) => (idx === i ? d : p)));
  };

  const submit = () => {
    const code = otp.join("");
    if (code.length < 4) return;
    confirmDelivery(job.id, { otp: code, photoConfirmed, deliveredQty: qty === "" ? -1 : qty });
    setOtp(["", "", "", ""]);
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
                {job.qty} {job.unit} · {Math.round(job.qty * job.weightKg).toLocaleString("en-IN")} kg · {inr(job.price)} each
              </span>
            </div>

            <dl className="grid grid-cols-[110px_1fr] gap-x-2.5 gap-y-1.5 text-sm">
              <dt className="text-muted">Pickup</dt>
              <dd>{state.storeName}</dd>
              <dt className="text-muted">Drop-off</dt>
              <dd>
                {job.buyer}, {job.city} {job.pin}
              </dd>
              {vehicle && (
                <>
                  <dt className="text-muted">Vehicle</dt>
                  <dd>
                    {vehicle.regNumber}, {vehicle.type}
                  </dd>
                  <dt className="text-muted">Driver</dt>
                  <dd>
                    {driver?.name} <span className="text-muted">{driver?.phone}</span>
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

            {canComplete && (
              <div className="grid gap-3 rounded-xl border border-line p-3.5">
                <div>
                  <b className="text-sm">1. Ask the customer for their delivery OTP</b>
                  <p className="mt-0.5 text-[13px] text-muted">
                    Demo OTP for this preview: <b>{job.otp}</b> (normally shown only to the customer — shown here since
                    order tracking isn&apos;t built yet).
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
                  {job.otpTries > 0 && <p className="mt-1 text-center text-[13px] font-medium text-bad">{3 - job.otpTries} tries left</p>}
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
                    <span className="text-[13px] text-muted">{photoConfirmed ? "Photo attached (demo)" : "Tap to attach a photo (demo)"}</span>
                  </span>
                </button>

                <label className="grid gap-1 text-sm font-semibold">
                  3. Quantity delivered ({job.unit})
                  <input
                    type="number"
                    min={0}
                    max={job.qty}
                    value={qty}
                    onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))}
                    className="h-10 rounded-lg border border-line bg-panel px-2.5"
                  />
                </label>

                <Button variant="yellow" wide onClick={submit}>
                  Confirm delivery
                </Button>
                <Button
                  variant="line"
                  wide
                  onClick={() => {
                    markFailedAttempt(job.id);
                    close();
                  }}
                >
                  Customer not available
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
