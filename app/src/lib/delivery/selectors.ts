// Delivery Portal state-level aggregates. Pure functions of `DeliveryState` —
// no React, no mock-data import (the state is passed in), same separation as
// `lib/seller/selectors.ts`.
import type { DeliveryJob, DeliveryState, DeliveryStatus } from "./types";

export const ACTIVE_STATUSES: DeliveryStatus[] = ["dispatched", "picked_up", "failed"];
export const HISTORY_STATUSES: DeliveryStatus[] = ["review", "disputed", "settled"];

export const ASSIGNED_FILTERS: { key: string; label: string; statuses: DeliveryStatus[] | null }[] = [
  { key: "all", label: "All", statuses: null },
  { key: "road", label: "On the road", statuses: ["dispatched", "picked_up"] },
  { key: "failed", label: "Failed attempts", statuses: ["failed"] },
];

export const HISTORY_FILTERS: { key: string; label: string; statuses: DeliveryStatus[] | null }[] = [
  { key: "all", label: "All", statuses: null },
  { key: "review", label: "In review", statuses: ["review"] },
  { key: "disputed", label: "Disputed", statuses: ["disputed"] },
  { key: "settled", label: "Paid", statuses: ["settled"] },
];

export function getActiveDeliveries(state: DeliveryState): DeliveryJob[] {
  return state.jobs.filter((j) => ACTIVE_STATUSES.includes(j.status));
}

/** Only a dispatched job can be declined; after that it is back with the seller. */
export function canDeclineJob(job: DeliveryJob): boolean {
  return job.status === "dispatched";
}

export function getDeliveryHistory(state: DeliveryState): DeliveryJob[] {
  return state.jobs.filter((j) => HISTORY_STATUSES.includes(j.status));
}

export function vehicleFor(state: DeliveryState, job: DeliveryJob) {
  return state.vehicles.find((v) => v.id === job.vehicleId);
}

export function driverFor(state: DeliveryState, job: DeliveryJob) {
  const vehicle = vehicleFor(state, job);
  return vehicle ? state.drivers.find((d) => d.id === vehicle.driverId) : undefined;
}

export function getOverviewStats(state: DeliveryState) {
  return {
    onRoad: state.jobs.filter((j) => j.status === "dispatched" || j.status === "picked_up").length,
    failed: state.jobs.filter((j) => j.status === "failed").length,
    review: state.jobs.filter((j) => j.status === "review").length,
    disputed: state.jobs.filter((j) => j.status === "disputed").length,
    settled: state.jobs.filter((j) => j.status === "settled").length,
  };
}
