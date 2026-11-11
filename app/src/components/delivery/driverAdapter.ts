import type { DeliveryJob, DeliveryState, DeliveryStatus } from "@/lib/delivery/types";
import type { DriverJobDto, DriverJobsResponse } from "@/lib/api/driverDto";

const STATUSES = new Set<DeliveryStatus>(["dispatched", "picked_up", "failed", "review", "disputed", "settled"]);

function dateLabel(value: string | null): string | undefined {
  if (!value) return undefined;
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function dueLabel(value: string | null): string | undefined {
  if (!value) return undefined;
  const diff = Date.parse(value) - Date.now();
  if (!Number.isFinite(diff)) return undefined;
  if (diff <= 0) return "expired";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

export function toDeliveryJob(job: DriverJobDto): DeliveryJob {
  const qty = job.lines.reduce((sum, line) => sum + line.qty, 0);
  const itemValue = job.lines.reduce((sum, line) => sum + Number(line.lineValue), 0);
  const first = job.lines[0];
  const status: DeliveryStatus = STATUSES.has(job.status as DeliveryStatus)
    ? (job.status as DeliveryStatus)
    : "dispatched";
  return {
    id: job.code,
    shipmentId: job.id,
    orderCode: job.orderCode,
    buyer: job.buyer,
    city: job.city,
    pin: job.pin,
    productName: first
      ? job.lines.length > 1
        ? `${first.name} +${job.lines.length - 1} more`
        : first.name
      : "Shipment items",
    productCategory: first?.name ?? "Shipment",
    unit: first?.unit ?? "unit",
    price: qty > 0 ? itemValue / qty : 0,
    qty,
    weightKg: 0,
    bulk: job.lines.some((line) => line.bulk),
    status,
    slot: job.slot ?? undefined,
    vehicleId: job.vehicleId ?? "",
    vehicleReg: job.vehicleReg ?? undefined,
    vehicleType: job.vehicleType ?? undefined,
    driverName: job.driverName || undefined,
    driverPhone: job.driverPhone || undefined,
    docs: {
      challan: job.docs.challan,
      invoice: job.docs.invoice,
      eway: job.docs.eway ?? undefined,
      weighbridge: job.docs.weighbridge ?? undefined,
    },
    accepted: job.events.some((event) => event.actor === "driver" && event.message.startsWith("Driver accepted")),
    otpTries: job.otpTries,
    photoConfirmed: ["review", "disputed", "settled"].includes(job.status),
    deliveredQty: job.deliveredQty ?? undefined,
    createdLabel: dateLabel(job.createdAt) ?? "",
    deliveredAtLabel: dateLabel(job.deliveredAt),
    reviewEndsLabel: dueLabel(job.reviewEnds),
    issue: job.issue
      ? {
          type: job.issue.type,
          note: job.issue.note,
          claim: job.issue.claim ? Number(job.issue.claim) : undefined,
        }
      : undefined,
    events: job.events.map((event) => ({ at: dateLabel(event.at) ?? "", message: event.message })),
  };
}

export function toDeliveryState(response: DriverJobsResponse): DeliveryState {
  const jobs = response.jobs.map(toDeliveryJob);
  const vehicles = new Map<string, DeliveryState["vehicles"][number]>();
  for (const job of response.jobs) {
    if (job.vehicleId && job.vehicleReg) {
      vehicles.set(job.vehicleId, {
        id: job.vehicleId,
        regNumber: job.vehicleReg,
        type: job.vehicleType ?? "Vehicle",
        driverId: response.driver.id,
      });
    }
  }
  return {
    jobs,
    vehicles: [...vehicles.values()],
    drivers: [response.driver],
    storeName: response.storeName,
    driverName: response.driver.name,
  };
}
