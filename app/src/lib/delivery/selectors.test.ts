import { describe, expect, it } from "vitest";
import { canDeclineJob, getActiveDeliveries, getDeliveryHistory, getOverviewStats } from "./selectors";
import type { DeliveryJob, DeliveryState, DeliveryStatus } from "./types";

function job(status: DeliveryStatus): DeliveryJob {
  return {
    id: `BG-${status}`,
    shipmentId: `ship-${status}`,
    orderCode: "BG-1",
    buyer: "Demo buyer",
    city: "Bengaluru",
    pin: "560001",
    productName: "Cement",
    productCategory: "Cement",
    unit: "bag",
    price: 390,
    qty: 1,
    weightKg: 50,
    bulk: false,
    status,
    vehicleId: "v1",
    accepted: true,
    otpTries: 0,
    photoConfirmed: false,
    createdLabel: "today",
    events: [],
  };
}

function state(statuses: DeliveryStatus[]): DeliveryState {
  return {
    jobs: statuses.map(job),
    vehicles: [],
    drivers: [],
    storeName: "Demo store",
    driverName: "Demo driver",
  };
}

describe("delivery selectors", () => {
  it("keeps dispatched and picked-up jobs in the active list", () => {
    const active = getActiveDeliveries(state(["dispatched", "picked_up", "failed", "review"]));
    expect(active.map((j) => j.status)).toEqual(["dispatched", "picked_up", "failed"]);
  });

  it("counts picked-up jobs as on the road", () => {
    expect(getOverviewStats(state(["dispatched", "picked_up", "review"])).onRoad).toBe(2);
  });

  it("only allows declining a dispatched job", () => {
    expect(canDeclineJob(job("dispatched"))).toBe(true);
    expect(canDeclineJob(job("picked_up"))).toBe(false);
    expect(canDeclineJob(job("failed"))).toBe(false);
    expect(canDeclineJob(job("review"))).toBe(false);
  });

  it("keeps delivered states in history, not active", () => {
    expect(getDeliveryHistory(state(["review", "settled", "dispatched"])).map((j) => j.status)).toEqual([
      "review",
      "settled",
    ]);
  });
});
