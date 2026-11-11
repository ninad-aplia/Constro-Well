// Delivery Portal store — initial state comes from the authenticated driver's
// shipments (server layout), every mutation goes through /api/driver/jobs.
// There is no local-only delivery state.
"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/Toast";
import { toDeliveryJob } from "./driverAdapter";
import type { DeliveryJob, DeliveryState } from "@/lib/delivery/types";
import {
  acceptDriverJob,
  confirmDriverPickup,
  declineDriverJob,
  deliverDriverJob,
  fetchDriverJob,
  reportDriverJobIssue,
  type DriverIssueType,
} from "@/lib/api/driverApi";

export interface ConfirmDeliveryInput {
  otp: string;
  photoConfirmed: boolean;
  deliveredQty: number;
}

export interface ReportIssueInput {
  type: DriverIssueType;
  note: string;
  deliveredQty?: number;
}

interface DeliveryStoreValue {
  state: DeliveryState;
  busyId: string | null;
  acceptJob: (job: DeliveryJob) => Promise<void>;
  confirmPickup: (job: DeliveryJob) => Promise<void>;
  declineJob: (job: DeliveryJob, reason: string) => Promise<void>;
  confirmDelivery: (job: DeliveryJob, input: ConfirmDeliveryInput) => Promise<void>;
  reportIssue: (job: DeliveryJob, input: ReportIssueInput) => Promise<void>;
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();

  const replace = useCallback((job: Parameters<typeof toDeliveryJob>[0]) => {
    setState((current) => ({
      ...current,
      jobs: current.jobs.map((item) => (item.shipmentId === job.id ? toDeliveryJob(job) : item)),
    }));
  }, []);

  const refresh = useCallback(async (shipmentId: string) => {
    try {
      replace(await fetchDriverJob(shipmentId));
    } catch {
      // Keep the last known state if the refresh itself fails.
    }
  }, [replace]);

  const acceptJob = useCallback(
    async (job: DeliveryJob) => {
      setBusyId(job.shipmentId);
      try {
        replace(await acceptDriverJob(job.shipmentId));
        toast.show("Job accepted. Head to the pickup address.");
      } finally {
        setBusyId(null);
      }
    },
    [replace, toast],
  );

  const confirmPickup = useCallback(
    async (job: DeliveryJob) => {
      setBusyId(job.shipmentId);
      try {
        replace(await confirmDriverPickup(job.shipmentId));
        toast.show("Pickup confirmed. Head to the drop-off.");
      } finally {
        setBusyId(null);
      }
    },
    [replace, toast],
  );

  const declineJob = useCallback(
    async (job: DeliveryJob, reason: string) => {
      setBusyId(job.shipmentId);
      try {
        replace(await declineDriverJob(job.shipmentId, reason));
        toast.show("Job declined. The seller can assign another vehicle.");
      } finally {
        setBusyId(null);
      }
    },
    [replace, toast],
  );

  const confirmDelivery = useCallback(
    async (job: DeliveryJob, input: ConfirmDeliveryInput) => {
      setBusyId(job.shipmentId);
      try {
        replace(await deliverDriverJob(job.shipmentId, { otp: input.otp, deliveredQty: input.deliveredQty }));
        toast.show("Delivery recorded.");
      } catch (error) {
        await refresh(job.shipmentId);
        throw error;
      } finally {
        setBusyId(null);
      }
    },
    [refresh, replace, toast],
  );

  const reportIssue = useCallback(
    async (job: DeliveryJob, input: ReportIssueInput) => {
      setBusyId(job.shipmentId);
      try {
        replace(await reportDriverJobIssue(job.shipmentId, input));
        toast.show("Issue recorded. The seller and customer can see it.");
      } finally {
        setBusyId(null);
      }
    },
    [replace, toast],
  );

  return (
    <Ctx.Provider value={{ state, busyId, acceptJob, confirmPickup, declineJob, confirmDelivery, reportIssue }}>
      {children}
    </Ctx.Provider>
  );
}
