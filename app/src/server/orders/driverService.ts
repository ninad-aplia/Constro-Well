// Driver-side delivery lifecycle. Every query is scoped through the
// authenticated Driver.id; a shipment assigned to another driver is
// indistinguishable from a missing one.
import { Prisma, type PrismaClient } from "@prisma/client";
import type { DriverJobDto, DriverJobsResponse } from "@/lib/api/driverDto";
import { REVIEW_WINDOW_HOURS } from "@/lib/seller/rules";
import { db } from "@/server/db";
import { ApiError } from "@/server/http";
import { verifyOtp } from "@/server/security/otp";
import { refreshOrderStage } from "./lifecycle";

export const MAX_OTP_TRIES = 3;

const shipmentInclude = {
  order: {
    select: {
      id: true,
      code: true,
      addressSnapshot: true,
    },
  },
  seller: { select: { storeName: true } },
  lines: {
    include: { product: { select: { bulkFlag: true } } },
  },
  events: { orderBy: { at: "asc" as const } },
  vehicle: { select: { id: true, regNumber: true, type: true } },
  driver: { select: { id: true, name: true, phone: true } },
  issue: true,
} satisfies Prisma.ShipmentInclude;

type ShipmentWithRelations = Prisma.ShipmentGetPayload<{ include: typeof shipmentInclude }>;

const ISSUE_LABELS: Record<string, string> = {
  short_quantity: "Short quantity",
  damaged_goods: "Damaged goods",
  failed_attempt: "Failed attempt",
};

function addressOf(snapshot: Prisma.JsonValue): Record<string, string> {
  const value = (snapshot ?? {}) as Record<string, unknown>;
  return {
    name: String(value.name ?? ""),
    line1: String(value.line1 ?? ""),
    city: String(value.city ?? ""),
    pin: String(value.pin ?? ""),
    phone: String(value.phone ?? ""),
  };
}

function toDto(shipment: ShipmentWithRelations): DriverJobDto {
  const address = addressOf(shipment.order.addressSnapshot);
  return {
    id: shipment.id,
    code: shipment.code,
    orderCode: shipment.order.code,
    sellerId: shipment.sellerId,
    sellerName: shipment.seller.storeName,
    status: shipment.status,
    createdAt: shipment.createdAt.toISOString(),
    buyer: address.name,
    city: address.city,
    pin: address.pin,
    phone: address.phone,
    slot: shipment.slot,
    vehicleId: shipment.vehicleId,
    vehicleReg: shipment.vehicle?.regNumber ?? null,
    vehicleType: shipment.vehicle?.type ?? null,
    driverName: shipment.driver?.name ?? "",
    driverPhone: shipment.driver?.phone ?? "",
    docs: {
      challan: shipment.docsChallan,
      invoice: shipment.docsInvoice,
      eway: shipment.docsEway,
      weighbridge: shipment.docsWeighbridge,
    },
    deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
    deliveredQty: shipment.deliveredQty,
    reviewEnds: shipment.reviewEnds?.toISOString() ?? null,
    otpTries: shipment.otpTries,
    issue: shipment.issue
      ? {
          type: ISSUE_LABELS[shipment.issue.type] ?? shipment.issue.type,
          note: shipment.issue.note,
          claim: shipment.issue.claim?.toFixed(2) ?? null,
        }
      : null,
    lines: shipment.lines.map((line) => ({
      id: line.id,
      name: line.name,
      unit: line.unit,
      qty: line.qty,
      unitPrice: line.unitPrice.toFixed(2),
      lineValue: line.lineValue.toFixed(2),
      bulk: line.product.bulkFlag,
    })),
    events: shipment.events.map((event) => ({
      at: event.at.toISOString(),
      actor: event.actor,
      message: event.message,
    })),
  };
}

async function read(driverId: string, shipmentId: string, client = db): Promise<ShipmentWithRelations> {
  const shipment = await client.shipment.findFirst({
    where: { id: shipmentId, driverId },
    include: shipmentInclude,
  });
  if (!shipment) throw new ApiError(404, "shipment_not_found", "Shipment not found");
  return shipment;
}

export async function listDriverJobs(driverId: string): Promise<DriverJobsResponse> {
  const [driver, jobs] = await Promise.all([
    db.driver.findUnique({
      where: { id: driverId },
      select: { id: true, name: true, phone: true, seller: { select: { storeName: true } } },
    }),
    db.shipment.findMany({
      where: { driverId },
      include: shipmentInclude,
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!driver) throw new ApiError(403, "driver_profile_missing", "No driver profile is linked to this account");
  return {
    driver: { id: driver.id, name: driver.name, phone: driver.phone },
    storeName: driver.seller.storeName,
    jobs: jobs.map(toDto),
  };
}

export async function getDriverJob(driverId: string, shipmentId: string): Promise<DriverJobDto> {
  return toDto(await read(driverId, shipmentId));
}

/** Accepting is an audit event, not a new status: dispatch already assigned the job. */
export async function acceptDriverJob(driverId: string, shipmentId: string): Promise<DriverJobDto> {
  return db.$transaction(
    async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: shipmentId, driverId },
        include: shipmentInclude,
      });
      if (!shipment) throw new ApiError(404, "shipment_not_found", "Shipment not found");
      if (shipment.status !== "dispatched") {
        throw new ApiError(409, "invalid_transition", "Only a dispatched job can be accepted");
      }
      const existing = await tx.shipmentEvent.findFirst({
        where: { shipmentId, actor: "driver", message: { startsWith: "Driver accepted delivery job" } },
      });
      if (!existing) {
        await tx.shipmentEvent.create({
          data: { shipmentId, actor: "driver", message: "Driver accepted delivery job", at: new Date() },
        });
      }
      const fresh = await tx.shipment.findUniqueOrThrow({
        where: { id: shipmentId },
        include: shipmentInclude,
      });
      return toDto(fresh);
    },
    { timeout: 15_000 },
  );
}

function quantities(shipment: ShipmentWithRelations): { totalQty: number; itemValue: Prisma.Decimal } {
  return shipment.lines.reduce(
    (sum, line) => ({
      totalQty: sum.totalQty + line.qty,
      itemValue: sum.itemValue.plus(line.lineValue),
    }),
    { totalQty: 0, itemValue: new Prisma.Decimal(0) },
  );
}

type DeliveryOutcome =
  | { ok: true; shipment: ShipmentWithRelations }
  | { ok: false; status: number; code: string; message: string };

export interface DeliverInput {
  otp: string;
  deliveredQty?: number;
}

export async function deliverDriverShipment(
  driverId: string,
  shipmentId: string,
  input: DeliverInput,
): Promise<DriverJobDto> {
  const outcome = await db.$transaction<DeliveryOutcome>(
    async (tx) => {
      // Row lock serialises concurrent OTP submissions for the same shipment.
      await tx.$queryRaw`SELECT "id" FROM "Shipment" WHERE "id" = ${shipmentId} FOR UPDATE`;
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
        include: shipmentInclude,
      });
      if (!shipment || shipment.driverId !== driverId) {
        return { ok: false, status: 404, code: "shipment_not_found", message: "Shipment not found" };
      }
      if (shipment.status !== "dispatched") {
        return {
          ok: false,
          status: 409,
          code: "invalid_transition",
          message: "This shipment is no longer awaiting delivery",
        };
      }
      if (!shipment.otpHash) {
        return { ok: false, status: 409, code: "otp_missing", message: "No delivery OTP was generated for this shipment" };
      }
      if (shipment.otpTries >= MAX_OTP_TRIES) {
        return { ok: false, status: 429, code: "otp_locked", message: "Too many incorrect attempts" };
      }

      const valid = await verifyOtp(input.otp, shipment.otpHash);
      const now = new Date();
      if (!valid) {
        const tries = shipment.otpTries + 1;
        const exhausted = tries >= MAX_OTP_TRIES;
        await tx.shipment.update({
          where: { id: shipmentId },
          data: { otpTries: tries, ...(exhausted ? { status: "failed" as const } : {}) },
        });
        await tx.shipmentEvent.create({
          data: {
            shipmentId,
            actor: "driver",
            message: exhausted
              ? `OTP failed ${MAX_OTP_TRIES} times, delivery marked as failed attempt`
              : `OTP verification failed (${tries}/${MAX_OTP_TRIES})`,
            at: now,
          },
        });
        if (exhausted && !shipment.issue) {
          await tx.shipmentIssue.create({
            data: {
              shipmentId,
              type: "failed_attempt",
              note: `OTP entered incorrectly ${MAX_OTP_TRIES} times.`,
              auto: false,
              createdAt: now,
            },
          });
        }
        return {
          ok: false,
          status: 422,
          code: "otp_invalid",
          message: exhausted
            ? `Incorrect OTP. The delivery is now marked as a failed attempt.`
            : `Incorrect OTP. ${MAX_OTP_TRIES - tries} tries left.`,
        };
      }

      const { totalQty, itemValue } = quantities(shipment);
      const deliveredQty = input.deliveredQty ?? totalQty;
      if (deliveredQty > totalQty) {
        return {
          ok: false,
          status: 422,
          code: "invalid_quantity",
          message: `Enter a delivered quantity between 0 and ${totalQty}`,
        };
      }

      const shortfall = totalQty - deliveredQty;
      const disputed = shortfall > 0;
      const reviewEnds = disputed ? null : new Date(now.getTime() + REVIEW_WINDOW_HOURS * 3_600_000);
      await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: disputed ? "disputed" : "review",
          deliveredAt: now,
          deliveredQty,
          reviewEnds,
        },
      });
      if (disputed) {
        const claim = totalQty > 0
          ? itemValue.mul(shortfall).div(totalQty).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
          : new Prisma.Decimal(0);
        if (!shipment.issue) {
          await tx.shipmentIssue.create({
            data: {
              shipmentId,
              type: "short_quantity",
              note: `Driver recorded ${deliveredQty} of ${totalQty} delivered at drop-off.`,
              claim,
              auto: true,
              createdAt: now,
            },
          });
        }
        await tx.shipmentEvent.create({
          data: {
            shipmentId,
            actor: "driver",
            message: `Delivered ${deliveredQty} of ${totalQty} with OTP, shortfall opened a dispute and payout is frozen`,
            at: now,
          },
        });
      } else {
        await tx.shipmentEvent.create({
          data: {
            shipmentId,
            actor: "driver",
            message: `Delivered ${deliveredQty} of ${totalQty} with customer OTP`,
            at: now,
          },
        });
      }
      await refreshOrderStage(tx, shipment.orderId);
      const fresh = await tx.shipment.findUniqueOrThrow({
        where: { id: shipmentId },
        include: shipmentInclude,
      });
      return { ok: true, shipment: fresh };
    },
    { timeout: 20_000 },
  );

  if (!outcome.ok) throw new ApiError(outcome.status, outcome.code, outcome.message);
  return toDto(outcome.shipment);
}

export type DriverIssueType = "failed_attempt" | "damaged_goods" | "short_quantity";

export interface DriverIssueInput {
  type: DriverIssueType;
  note: string;
  deliveredQty?: number;
}

export async function reportDriverIssue(
  driverId: string,
  shipmentId: string,
  input: DriverIssueInput,
): Promise<DriverJobDto> {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Shipment" WHERE "id" = ${shipmentId} FOR UPDATE`;
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
        include: shipmentInclude,
      });
      if (!shipment || shipment.driverId !== driverId) {
        throw new ApiError(404, "shipment_not_found", "Shipment not found");
      }
      if (shipment.status !== "dispatched") {
        throw new ApiError(409, "invalid_transition", "Only a shipment on the road can be reported");
      }
      if (shipment.issue) {
        throw new ApiError(409, "issue_exists", "An issue is already recorded for this shipment");
      }

      const now = new Date();
      const { totalQty, itemValue } = quantities(shipment);
      let status: "failed" | "disputed" = "failed";
      let deliveredQty: number | null = null;
      let claim: Prisma.Decimal | null = null;
      let deliveredAt: Date | null = null;

      if (input.type === "short_quantity") {
        if (input.deliveredQty === undefined || input.deliveredQty >= totalQty) {
          throw new ApiError(422, "invalid_quantity", `Enter a delivered quantity below ${totalQty}`);
        }
        deliveredQty = input.deliveredQty;
        deliveredAt = now;
        claim = totalQty > 0
          ? itemValue.mul(totalQty - deliveredQty).div(totalQty).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
          : new Prisma.Decimal(0);
        status = "disputed";
      } else if (input.type === "damaged_goods") {
        status = "disputed";
      }

      await tx.shipment.update({
        where: { id: shipmentId },
        data: { status, deliveredAt, deliveredQty },
      });
      await tx.shipmentIssue.create({
        data: {
          shipmentId,
          type: input.type,
          note: input.note,
          claim,
          auto: input.type === "short_quantity",
          createdAt: now,
        },
      });
      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          actor: "driver",
          message: `${ISSUE_LABELS[input.type]}: ${input.note}`,
          at: now,
        },
      });
      await refreshOrderStage(tx, shipment.orderId);
      const fresh = await tx.shipment.findUniqueOrThrow({
        where: { id: shipmentId },
        include: shipmentInclude,
      });
      return toDto(fresh);
    },
    { timeout: 20_000 },
  );
}

export type DriverDb = Pick<PrismaClient, "shipment" | "shipmentEvent" | "shipmentIssue" | "order" | "driver">;
