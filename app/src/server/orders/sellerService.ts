// Seller-side shipment lifecycle. Every query is scoped through requireSeller's
// Seller.id; a shipment from another seller is indistinguishable from missing.
import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  SellerLedgerEntryDto,
  SellerLineDto,
  SellerOrdersResponse,
  SellerPaymentsDto,
  SellerPerformanceDto,
  SellerPerformanceStatsDto,
  SellerShipmentDto,
  SellerSummaryDto,
} from "@/lib/api/sellerOrderDto";
import { DISPATCH_WINDOW_HOURS, EWAY_THRESHOLD, computeScore } from "@/lib/seller/rules";
import { encryptOtp, generateOtp, hashOtp } from "@/server/security/otp";
import { db } from "@/server/db";
import { ApiError } from "@/server/http";
import {
  DELIVERED,
  SHIPPED,
  cancelCodCollection,
  refreshOrderStage,
  refundHeldEscrow,
  restoreReservedStock,
} from "./lifecycle";

const shipmentInclude = {
  order: {
    select: {
      code: true,
      createdAt: true,
      addressSnapshot: true,
      paymentLabel: true,
      itemValue: true,
      deliveryFee: true,
      discount: true,
      grossTotal: true,
    },
  },
  lines: {
    include: {
      product: {
        select: {
          code: true,
          unitWeightKg: true,
          bulkFlag: true,
          category: { select: { name: true } },
        },
      },
    },
  },
  events: { orderBy: { at: "asc" as const } },
  vehicle: { select: { id: true, regNumber: true, type: true } },
  driver: { select: { id: true, name: true, phone: true } },
  issue: true,
  escrowEntries: { select: { type: true, amount: true } },
} satisfies Prisma.ShipmentInclude;

type ShipmentWithRelations = Prisma.ShipmentGetPayload<{ include: typeof shipmentInclude }>;

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

function toLine(line: ShipmentWithRelations["lines"][number]): SellerLineDto {
  return {
    id: line.id,
    productId: line.productId,
    productCode: line.product.code,
    name: line.name,
    category: line.product.category.name,
    unit: line.unit,
    qty: line.qty,
    unitPrice: line.unitPrice.toFixed(2),
    lineValue: line.lineValue.toFixed(2),
    weightKg: line.product.unitWeightKg,
    bulk: line.product.bulkFlag,
  };
}

function toDto(shipment: ShipmentWithRelations): SellerShipmentDto {
  const address = addressOf(shipment.order.addressSnapshot);
  return {
    id: shipment.id,
    code: shipment.code,
    orderCode: shipment.order.code,
    status: shipment.status,
    createdAt: shipment.createdAt.toISOString(),
    buyerName: address.name,
    buyerLine: address.line1,
    buyerCity: address.city,
    buyerPin: address.pin,
    buyerPhone: address.phone,
    slot: shipment.slot,
    late: shipment.late,
    acceptBy: shipment.acceptBy?.toISOString() ?? null,
    dispatchBy: shipment.dispatchBy?.toISOString() ?? null,
    deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
    reviewEnds: shipment.reviewEnds?.toISOString() ?? null,
    vehicleId: shipment.vehicleId,
    vehicleReg: shipment.vehicle?.regNumber ?? null,
    driverName: shipment.driver?.name ?? null,
    driverPhone: shipment.driver?.phone ?? null,
    docs: {
      challan: shipment.docsChallan,
      invoice: shipment.docsInvoice,
      eway: shipment.docsEway,
      weighbridge: shipment.docsWeighbridge,
    },
    issue: shipment.issue
      ? {
          type: shipment.issue.type,
          note: shipment.issue.note,
          claim: shipment.issue.claim?.toFixed(2) ?? null,
        }
      : null,
    lines: shipment.lines.map(toLine),
    events: shipment.events.map((event) => ({
      at: event.at.toISOString(),
      message: event.message,
    })),
  };
}

export async function sellerMeta(sellerId: string): Promise<Omit<SellerOrdersResponse, "orders">> {
  const [seller, vehicles, drivers] = await Promise.all([
    db.seller.findUnique({
      where: { id: sellerId },
      select: { freeAbove: true, fee: true, slotsPerDay: true },
    }),
    db.vehicle.findMany({
      where: { sellerId },
      include: { driver: { select: { name: true } } },
      orderBy: { code: "asc" },
    }),
    db.driver.findMany({ where: { sellerId }, orderBy: { code: "asc" } }),
  ]);
  if (!seller) throw new ApiError(403, "seller_profile_missing", "No seller profile is linked to this account");
  return {
    vehicles: vehicles.map((vehicle) => ({
      id: vehicle.id,
      regNumber: vehicle.regNumber,
      type: vehicle.type,
      driverId: vehicle.driverId,
      driverName: vehicle.driver?.name ?? null,
    })),
    drivers: drivers.map((driver) => ({ id: driver.id, name: driver.name, phone: driver.phone })),
    rules: {
      freeAbove: seller.freeAbove.toFixed(2),
      fee: seller.fee.toFixed(2),
      slotsPerDay: seller.slotsPerDay,
    },
  };
}

export async function listSellerOrders(sellerId: string): Promise<SellerOrdersResponse> {
  const [orders, meta] = await Promise.all([
    db.shipment.findMany({
      where: { sellerId },
      include: shipmentInclude,
      orderBy: { createdAt: "desc" },
    }),
    sellerMeta(sellerId),
  ]);
  return { orders: orders.map(toDto), ...meta };
}

export async function sellerSummary(sellerId: string): Promise<SellerSummaryDto> {
  const [seller, statusRows, offers, payments, performance] = await Promise.all([
    db.seller.findUnique({
      where: { id: sellerId },
      select: {
        storeName: true,
        city: true,
        vacationMode: true,
        owner: { select: { name: true } },
      },
    }),
    db.shipment.groupBy({
      by: ["status"],
      where: { sellerId },
      _count: { _all: true },
    }),
    db.sellerOffer.findMany({
      where: { sellerId, status: "active" },
      select: { stock: true, reorderLevel: true },
    }),
    sellerPaymentsSummary(sellerId),
    sellerPerformanceStats(sellerId),
  ]);
  if (!seller) throw new ApiError(403, "seller_profile_missing", "No seller profile is linked to this account");

  const counts = new Map<string, number>(
    statusRows.map((row) => [String(row.status), row._count._all]),
  );
  const count = (status: string) => counts.get(status) ?? 0;
  const late = await db.shipment.count({
    where: {
      sellerId,
      status: { in: ["accepted", "packed"] },
      dispatchBy: { lt: new Date() },
    },
  });

  return {
    storeName: seller.storeName,
    city: seller.city,
    ownerFirstName: seller.owner.name.split(" ")[0] ?? seller.owner.name,
    vacationMode: seller.vacationMode,
    score: performance.score,
    balance: payments.balance,
    newOrders: count("new"),
    readyToDispatch: count("accepted") + count("packed"),
    late,
    openDisputes: count("disputed"),
    review: count("review"),
    failed: count("failed"),
    lowStock: offers.filter((offer) => offer.stock <= offer.reorderLevel).length,
  };
}

export async function getSellerShipment(
  sellerId: string,
  shipmentId: string,
): Promise<SellerShipmentDto> {
  const shipment = await db.shipment.findFirst({
    where: { id: shipmentId, sellerId },
    include: shipmentInclude,
  });
  if (!shipment) throw new ApiError(404, "shipment_not_found", "Shipment not found");
  return toDto(shipment);
}

export async function acceptShipment(
  sellerId: string,
  shipmentId: string,
): Promise<SellerShipmentDto> {
  return db.$transaction(
    async (tx) => {
      const now = new Date();
      const dispatchBy = new Date(now.getTime() + DISPATCH_WINDOW_HOURS * 3_600_000);
      const updated = await tx.shipment.updateMany({
        where: { id: shipmentId, sellerId, status: "new" },
        data: { status: "accepted", dispatchBy },
      });
      if (updated.count === 0) {
        throw new ApiError(409, "invalid_transition", "Only a new shipment can be accepted");
      }
      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          actor: "vendor",
          message: `Accepted, dispatch within ${DISPATCH_WINDOW_HOURS} hours`,
          at: now,
        },
      });
      const shipment = await tx.shipment.findUniqueOrThrow({
        where: { id: shipmentId },
        include: shipmentInclude,
      });
      await refreshOrderStage(tx, shipment.orderId);
      return toDto(shipment);
    },
    { timeout: 15_000 },
  );
}

export async function packShipment(
  sellerId: string,
  shipmentId: string,
): Promise<SellerShipmentDto> {
  return db.$transaction(
    async (tx) => {
      const now = new Date();
      const updated = await tx.shipment.updateMany({
        where: { id: shipmentId, sellerId, status: "accepted" },
        data: { status: "packed" },
      });
      if (updated.count === 0) {
        throw new ApiError(409, "invalid_transition", "Only an accepted shipment can be packed");
      }
      await tx.shipmentEvent.create({
        data: { shipmentId, actor: "vendor", message: "Packed and ready for pickup", at: now },
      });
      const shipment = await tx.shipment.findUniqueOrThrow({
        where: { id: shipmentId },
        include: shipmentInclude,
      });
      await refreshOrderStage(tx, shipment.orderId);
      return toDto(shipment);
    },
    { timeout: 15_000 },
  );
}

export async function rejectShipment(
  sellerId: string,
  shipmentId: string,
  reason: string,
): Promise<SellerShipmentDto> {
  return db.$transaction(
    async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: shipmentId, sellerId },
        include: shipmentInclude,
      });
      if (!shipment) throw new ApiError(404, "shipment_not_found", "Shipment not found");
      if (shipment.status !== "new") {
        throw new ApiError(409, "invalid_transition", "Only a new shipment can be rejected");
      }

      const now = new Date();
      const updated = await tx.shipment.updateMany({
        where: { id: shipmentId, sellerId, status: "new" },
        data: { status: "rejected" },
      });
      if (updated.count === 0) {
        throw new ApiError(409, "invalid_transition", "This shipment was already processed");
      }

      // Restore each reserved quantity exactly once, grouped by offer.
      await restoreReservedStock(tx, shipment.lines);

      // Keep the held entry as audit history and record the refund separately.
      await refundHeldEscrow(tx, shipment, "Shipment rejected, held amount refunded", now);
      await cancelCodCollection(tx, shipment.id);

      await tx.shipmentEvent.create({
        data: { shipmentId, actor: "vendor", message: `Rejected: ${reason}`, at: now },
      });
      await refreshOrderStage(tx, shipment.orderId);
      const fresh = await tx.shipment.findUniqueOrThrow({
        where: { id: shipmentId },
        include: shipmentInclude,
      });
      return toDto(fresh);
    },
    { timeout: 15_000 },
  );
}

export interface DispatchInput {
  vehicleId: string;
  slot: string;
  challan: boolean;
  invoice: boolean;
  eway?: string;
  weighbridge?: string;
}

export async function dispatchShipment(
  sellerId: string,
  shipmentId: string,
  input: DispatchInput,
): Promise<SellerShipmentDto> {
  return db.$transaction(
    async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: shipmentId, sellerId },
        include: shipmentInclude,
      });
      if (!shipment) throw new ApiError(404, "shipment_not_found", "Shipment not found");
      if (!["accepted", "packed"].includes(shipment.status)) {
        throw new ApiError(409, "invalid_transition", "Shipment must be accepted before dispatch");
      }
      if (!input.challan || !input.invoice) {
        throw new ApiError(422, "docs_required", "Challan and GST invoice are required");
      }

      const vehicle = await tx.vehicle.findFirst({
        where: { id: input.vehicleId, sellerId },
        select: { id: true, regNumber: true, driverId: true },
      });
      if (!vehicle) throw new ApiError(404, "vehicle_not_found", "Vehicle not found");
      if (vehicle.driverId) {
        const driver = await tx.driver.findFirst({ where: { id: vehicle.driverId, sellerId } });
        if (!driver) throw new ApiError(422, "driver_unavailable", "The vehicle driver is not active for this seller");
      }

      const itemValue = shipment.lines.reduce(
        (sum, line) => sum.plus(line.lineValue),
        new Prisma.Decimal(0),
      );
      const needsEway = itemValue.gte(EWAY_THRESHOLD);
      const needsWeighbridge = shipment.lines.some((line) => line.product.bulkFlag);
      if (needsEway && !/^\d{12}$/.test(input.eway ?? "")) {
        throw new ApiError(422, "eway_required", "A 12-digit e-way bill is required");
      }
      if (needsWeighbridge && (input.weighbridge ?? "").trim().length < 3) {
        throw new ApiError(422, "weighbridge_required", "A weighbridge slip is required");
      }

      const now = new Date();
      const late = shipment.dispatchBy ? now.getTime() > shipment.dispatchBy.getTime() : false;
      const otp = generateOtp();
      const otpHash = await hashOtp(otp);
      const otpEncrypted = encryptOtp(otp);
      const updated = await tx.shipment.updateMany({
        where: { id: shipmentId, sellerId, status: { in: ["accepted", "packed"] } },
        data: {
          status: "dispatched",
          vehicleId: vehicle.id,
          driverId: vehicle.driverId,
          slot: input.slot,
          docsChallan: input.challan,
          docsInvoice: input.invoice,
          docsEway: input.eway ?? null,
          docsWeighbridge: input.weighbridge ?? null,
          late,
          otpHash,
          otpEncrypted,
          otpTries: 0,
        },
      });
      if (updated.count === 0) {
        throw new ApiError(409, "invalid_transition", "This shipment was already processed");
      }
      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          actor: "vendor",
          message: `Dispatched with ${vehicle.regNumber}${late ? " (late)" : ""}, customer OTP generated`,
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
    { timeout: 15_000 },
  );
}

/**
 * Reassigns a failed delivery attempt to a (possibly different) vehicle/driver
 * and retries: `failed → dispatched` with a fresh OTP. Only the logistics
 * failure case (`status: "failed"`, opened by 3 wrong OTP tries or a driver's
 * "failed attempt" report) is eligible — a goods-condition dispute
 * (`disputed`: short quantity / damaged goods) is a refund-policy question
 * (WP-2 admin resolution, not a logistics retry) and is untouched here.
 */
export async function redispatchShipment(
  sellerId: string,
  shipmentId: string,
  input: DispatchInput,
): Promise<SellerShipmentDto> {
  return db.$transaction(
    async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: shipmentId, sellerId },
        include: shipmentInclude,
      });
      if (!shipment) throw new ApiError(404, "shipment_not_found", "Shipment not found");
      if (shipment.status !== "failed") {
        throw new ApiError(409, "invalid_transition", "Only a failed delivery attempt can be reassigned");
      }
      if (!input.challan || !input.invoice) {
        throw new ApiError(422, "docs_required", "Challan and GST invoice are required");
      }

      const vehicle = await tx.vehicle.findFirst({
        where: { id: input.vehicleId, sellerId },
        select: { id: true, regNumber: true, driverId: true },
      });
      if (!vehicle) throw new ApiError(404, "vehicle_not_found", "Vehicle not found");
      if (vehicle.driverId) {
        const driver = await tx.driver.findFirst({ where: { id: vehicle.driverId, sellerId } });
        if (!driver) throw new ApiError(422, "driver_unavailable", "The vehicle driver is not active for this seller");
      }

      const itemValue = shipment.lines.reduce(
        (sum, line) => sum.plus(line.lineValue),
        new Prisma.Decimal(0),
      );
      const needsEway = itemValue.gte(EWAY_THRESHOLD);
      const needsWeighbridge = shipment.lines.some((line) => line.product.bulkFlag);
      if (needsEway && !/^\d{12}$/.test(input.eway ?? "")) {
        throw new ApiError(422, "eway_required", "A 12-digit e-way bill is required");
      }
      if (needsWeighbridge && (input.weighbridge ?? "").trim().length < 3) {
        throw new ApiError(422, "weighbridge_required", "A weighbridge slip is required");
      }

      const now = new Date();
      const late = shipment.dispatchBy ? now.getTime() > shipment.dispatchBy.getTime() : false;
      const otp = generateOtp();
      const otpHash = await hashOtp(otp);
      const otpEncrypted = encryptOtp(otp);
      const updated = await tx.shipment.updateMany({
        where: { id: shipmentId, sellerId, status: "failed" },
        data: {
          status: "dispatched",
          vehicleId: vehicle.id,
          driverId: vehicle.driverId,
          slot: input.slot,
          docsChallan: input.challan,
          docsInvoice: input.invoice,
          docsEway: input.eway ?? null,
          docsWeighbridge: input.weighbridge ?? null,
          late,
          otpHash,
          otpEncrypted,
          otpTries: 0,
        },
      });
      if (updated.count === 0) {
        throw new ApiError(409, "invalid_transition", "This shipment was already processed");
      }
      // The failed-attempt issue is resolved by the retry; `ShipmentIssue` is the
      // current dispute slot for this shipment (schema comment), not permanent
      // history — the full narrative survives in the append-only ShipmentEvent log.
      if (shipment.issue) {
        await tx.shipmentIssue.delete({ where: { shipmentId } });
      }
      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          actor: "vendor",
          message: `Reassigned to ${vehicle.regNumber} after a failed delivery attempt, customer OTP regenerated`,
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
    { timeout: 15_000 },
  );
}

/**
 * Gives up on a failed delivery attempt: `failed → missed` (a terminal status
 * already modeled in `TERMINAL_CANCEL`, but nothing previously set it).
 * Restores reserved stock and cancels the COD expectation exactly like a
 * pre-dispatch reject, since the goods never reached the customer and no cash
 * was ever collected.
 */
export async function markShipmentMissed(
  sellerId: string,
  shipmentId: string,
  reason: string,
): Promise<SellerShipmentDto> {
  return db.$transaction(
    async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: shipmentId, sellerId },
        include: shipmentInclude,
      });
      if (!shipment) throw new ApiError(404, "shipment_not_found", "Shipment not found");
      if (shipment.status !== "failed") {
        throw new ApiError(409, "invalid_transition", "Only a failed delivery attempt can be marked missed");
      }

      const now = new Date();
      const updated = await tx.shipment.updateMany({
        where: { id: shipmentId, sellerId, status: "failed" },
        data: { status: "missed" },
      });
      if (updated.count === 0) {
        throw new ApiError(409, "invalid_transition", "This shipment was already processed");
      }

      await restoreReservedStock(tx, shipment.lines);
      await refundHeldEscrow(tx, shipment, "Delivery marked as missed, held amount refunded", now);
      await cancelCodCollection(tx, shipment.id);

      await tx.shipmentEvent.create({
        data: { shipmentId, actor: "vendor", message: `Marked as missed: ${reason}`, at: now },
      });
      await refreshOrderStage(tx, shipment.orderId);
      const fresh = await tx.shipment.findUniqueOrThrow({
        where: { id: shipmentId },
        include: shipmentInclude,
      });
      return toDto(fresh);
    },
    { timeout: 15_000 },
  );
}

/**
 * LEGACY escrow-ledger aggregate (read-only, pre-cutover). `EscrowEntry` is the
 * historical platform-custody model — it is NOT current COD cash and never
 * implies Constro-Well holds a seller's money. Seller-collected COD accounting
 * (collections, commission, remittances, reconciliation) lives in the FastAPI
 * finance domain; this summary only renders pre-cutover history.
 */
export async function sellerPaymentsSummary(sellerId: string): Promise<SellerPaymentsDto> {
  const [seller, entries] = await Promise.all([
    db.seller.findUnique({ where: { id: sellerId }, select: { bankRef: true } }),
    db.escrowEntry.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
      include: {
        order: { select: { code: true } },
        shipment: { select: { code: true, status: true } },
      },
    }),
  ]);
  if (!seller) throw new ApiError(403, "seller_profile_missing", "No seller profile is linked to this account");

  let totalReleased = 0;
  let totalWithdrawn = 0;
  const perShipment = new Map<
    string,
    { held: number; commission: number; released: number; refund: number; status: string }
  >();

  for (const entry of entries) {
    const amount = Number(entry.amount);
    if (entry.type === "released") totalReleased += amount;
    if (entry.type === "withdrawn") totalWithdrawn += amount;
    if (entry.shipmentId && entry.shipment) {
      const bucket = perShipment.get(entry.shipmentId) ?? {
        held: 0,
        commission: 0,
        released: 0,
        refund: 0,
        status: entry.shipment.status,
      };
      if (entry.type === "held") bucket.held += amount;
      if (entry.type === "commission") bucket.commission += amount;
      if (entry.type === "released") bucket.released += amount;
      if (entry.type === "refund") bucket.refund += amount;
      perShipment.set(entry.shipmentId, bucket);
    }
  }

  let pendingRelease = 0;
  let frozen = 0;
  for (const bucket of perShipment.values()) {
    const unresolved = bucket.held - bucket.commission - bucket.released - bucket.refund;
    if (unresolved <= 0) continue;
    if (bucket.status === "disputed") frozen += unresolved;
    else pendingRelease += unresolved;
  }

  const ledger: SellerLedgerEntryDto[] = entries.map((entry) => ({
    id: entry.id,
    type: entry.type,
    amount: entry.amount.toFixed(2),
    note: entry.note,
    createdAt: entry.createdAt.toISOString(),
    orderCode: entry.order?.code ?? null,
    shipmentCode: entry.shipment?.code ?? null,
  }));

  return {
    balance: {
      available: (totalReleased - totalWithdrawn).toFixed(2),
      pendingRelease: pendingRelease.toFixed(2),
      frozen: frozen.toFixed(2),
    },
    totalReleased: totalReleased.toFixed(2),
    totalWithdrawn: totalWithdrawn.toFixed(2),
    bankRef: seller.bankRef,
    ledger,
  };
}

/**
 * Real delivery-performance stats computed from Shipment rows, in the exact
 * shape `lib/seller/rules.ts`'s computeScore/acceptanceRate/onTimeRate/
 * issueFreeRate already expect — those formulas are reused unchanged so the
 * score here matches the Performance page's metric bars exactly.
 */
export async function sellerPerformanceStats(sellerId: string): Promise<SellerPerformanceDto> {
  const shipments = await db.shipment.findMany({
    where: { sellerId },
    select: { status: true, late: true, issue: { select: { id: true } } },
  });

  const decided = shipments.filter((s) => s.status !== "new");
  const offered = decided.length;
  const accepted = decided.filter((s) => s.status !== "rejected" && s.status !== "missed").length;
  const dispatchedShipments = shipments.filter((s) => SHIPPED.has(s.status));
  const dispatched = dispatchedShipments.length;
  const ontime = dispatchedShipments.filter((s) => !s.late).length;
  const deliveredShipments = shipments.filter((s) => DELIVERED.has(s.status));
  const delivered = deliveredShipments.length;
  const issues = deliveredShipments.filter((s) => s.issue).length;

  const stats: SellerPerformanceStatsDto = { offered, accepted, dispatched, ontime, delivered, issues };
  return { stats, score: computeScore(stats) };
}

export type SellerOrdersDb = Pick<PrismaClient, "shipment" | "shipmentEvent" | "sellerOffer" | "escrowEntry" | "vehicle" | "driver" | "seller">;
