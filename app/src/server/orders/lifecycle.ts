// Shared order/shipment lifecycle helpers. Used by seller, driver and customer
// transitions so the parent Order always reflects its per-seller shipments.
import type { Prisma } from "@prisma/client";

const DELIVERED = new Set(["review", "disputed", "settled", "refunded"]);
const SHIPPED = new Set(["dispatched", "review", "disputed", "settled", "failed", "refunded"]);
const TERMINAL_CANCEL = new Set(["cancelled", "rejected", "missed"]);

export async function refreshOrderStage(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  const shipments = await tx.shipment.findMany({
    where: { orderId },
    select: { status: true },
  });
  const statuses = shipments.map((shipment) => shipment.status);

  const allCancelled =
    statuses.length > 0 && statuses.every((status) => TERMINAL_CANCEL.has(status));
  const allDelivered =
    statuses.length > 0 && statuses.every((status) => DELIVERED.has(status));

  let stage: "ordered" | "packed" | "shipped" | "delivered" = "ordered";
  if (allDelivered) stage = "delivered";
  else if (statuses.some((status) => SHIPPED.has(status))) stage = "shipped";
  else if (
    statuses.length > 0 &&
    statuses.every((status) => status === "accepted" || status === "packed")
  ) {
    stage = "packed";
  }

  await tx.order.update({
    where: { id: orderId },
    data: { stage, ...(allCancelled ? { cancelled: true } : {}) },
  });
}

export interface ReservedLine {
  sellerOfferId: string | null;
  qty: number;
}

/** Restores reserved stock once per offer. The caller must guard the status transition. */
export async function restoreReservedStock(
  tx: Prisma.TransactionClient,
  lines: ReservedLine[],
): Promise<void> {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    if (!line.sellerOfferId) continue;
    quantities.set(line.sellerOfferId, (quantities.get(line.sellerOfferId) ?? 0) + line.qty);
  }
  for (const [offerId, qty] of quantities) {
    const offer = await tx.sellerOffer.update({
      where: { id: offerId },
      data: { stock: { increment: qty } },
      select: { stock: true, status: true },
    });
    if (offer.stock > 0 && offer.status === "paused") {
      await tx.sellerOffer.update({ where: { id: offerId }, data: { status: "active" } });
    }
  }
}

export interface HeldEscrow {
  type: string;
  amount: Prisma.Decimal;
}

export async function refundHeldEscrow(
  tx: Prisma.TransactionClient,
  shipment: {
    id: string;
    orderId: string;
    sellerId: string;
    escrowEntries: HeldEscrow[];
  },
  note: string,
  now: Date,
): Promise<void> {
  for (const held of shipment.escrowEntries.filter((entry) => entry.type === "held")) {
    await tx.escrowEntry.create({
      data: {
        orderId: shipment.orderId,
        shipmentId: shipment.id,
        sellerId: shipment.sellerId,
        type: "refund",
        amount: held.amount,
        note,
        createdAt: now,
      },
    });
  }
}
