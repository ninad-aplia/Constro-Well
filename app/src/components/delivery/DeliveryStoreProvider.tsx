// Delivery Portal preview-state store — ported from buildgrid-delivery-workflow.html's
// driver actions (`doDeliver()` line 227, the `failatt` handler line 407).
// Client-side React state only: there is no delivery backend to persist to
// in this phase, so every mutation here is explicitly a local preview
// change (lost on reload), never a claim of real/remote persistence or
// real GPS/SMS. This is intentionally a separate store from
// `SellerStoreProvider` — driver actions (confirm delivery, mark failed
// attempt) are not seller actions, even though the initial job list is
// derived from the same seller mock orders via `lib/api/delivery.ts`.
"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/Toast";
import { REVIEW_WINDOW_HOURS } from "@/lib/seller/rules";
import { MAX_OTP_TRIES } from "@/lib/delivery/rules";
import type { DeliveryState } from "@/lib/delivery/types";

export interface ConfirmDeliveryInput {
  otp: string;
  photoConfirmed: boolean;
  deliveredQty: number;
}

interface DeliveryStoreValue {
  state: DeliveryState;
  confirmDelivery: (jobId: string, input: ConfirmDeliveryInput) => void;
  markFailedAttempt: (jobId: string) => void;
}

const Ctx = createContext<DeliveryStoreValue | null>(null);

export function useDeliveryStore(): DeliveryStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDeliveryStore must be used within DeliveryStoreProvider");
  return ctx;
}

export default function DeliveryStoreProvider({
  initialState,
  children,
}: {
  initialState: DeliveryState;
  children: ReactNode;
}) {
  const [state, setState] = useState(initialState);
  const toast = useToast();

  const confirmDelivery = useCallback(
    (jobId: string, input: ConfirmDeliveryInput) => {
      const job = state.jobs.find((j) => j.id === jobId);
      if (!job) return;

      if (input.otp !== job.otp) {
        const tries = job.otpTries + 1;
        if (tries >= MAX_OTP_TRIES) {
          setState({
            ...state,
            jobs: state.jobs.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    status: "failed" as const,
                    otpTries: tries,
                    issue: { type: "Failed attempt", note: "OTP entered incorrectly three times." },
                    events: [...j.events, { at: "Just now", message: "OTP failed 3 times, marked as failed attempt" }],
                  }
                : j
            ),
          });
          toast.show("3 wrong OTPs. Marked as a failed attempt.");
        } else {
          setState({ ...state, jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, otpTries: tries } : j)) });
          toast.show(`OTP does not match. ${MAX_OTP_TRIES - tries} tries left.`);
        }
        return;
      }

      if (!input.photoConfirmed) {
        toast.show("Take a photo of the unloaded goods first");
        return;
      }
      if (!(input.deliveredQty >= 0 && input.deliveredQty <= job.qty)) {
        toast.show(`Enter a quantity between 0 and ${job.qty}`);
        return;
      }

      const shortfall = job.qty - input.deliveredQty;
      if (shortfall > 0) {
        const claim = shortfall * job.price;
        setState({
          ...state,
          jobs: state.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: "disputed" as const,
                  photoConfirmed: true,
                  otpTries: 0,
                  deliveredQty: input.deliveredQty,
                  deliveredAtLabel: "Just now",
                  issue: {
                    type: "Short quantity",
                    note: `Driver recorded ${input.deliveredQty} of ${job.qty} ${job.unit} at drop-off.`,
                    claim,
                  },
                  events: [
                    ...j.events,
                    { at: "Just now", message: `Delivered ${input.deliveredQty} of ${job.qty} ${job.unit}, shortfall recorded` },
                    { at: "Just now", message: `Shortfall opened a dispute of ₹${claim.toLocaleString("en-IN")}, payout frozen` },
                  ],
                }
              : j
          ),
        });
        toast.show("Delivered short. A dispute opened automatically.");
      } else {
        setState({
          ...state,
          jobs: state.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: "review" as const,
                  photoConfirmed: true,
                  otpTries: 0,
                  deliveredQty: input.deliveredQty,
                  deliveredAtLabel: "Just now",
                  reviewEndsLabel: `${REVIEW_WINDOW_HOURS}h left`,
                  events: [
                    ...j.events,
                    { at: "Just now", message: `Delivered ${input.deliveredQty} ${job.unit} with OTP and photo proof` },
                    { at: "Just now", message: "24-hour review window opened" },
                  ],
                }
              : j
          ),
        });
        toast.show("Delivered. Review window started.");
      }
    },
    [state, toast]
  );

  const markFailedAttempt = useCallback(
    (jobId: string) => {
      setState({
        ...state,
        jobs: state.jobs.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: "failed" as const,
                issue: { type: "Failed attempt", note: "Customer not available at drop-off." },
                events: [...j.events, { at: "Just now", message: "Failed attempt: customer not available" }],
              }
            : j
        ),
      });
      toast.show("Marked as a failed attempt. The seller will need to reschedule.");
    },
    [state, toast]
  );

  return <Ctx.Provider value={{ state, confirmDelivery, markFailedAttempt }}>{children}</Ctx.Provider>;
}
