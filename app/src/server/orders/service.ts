// Customer checkout + order placement. The same cart pricing service is used
// for preview and placement, so the browser never supplies a price or total.
import { createHash, randomInt } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { ART, HUE } from "@/data/catalog";
import type { Category } from "@/lib/shop/types";
import type {
  AddressDto,
  CheckoutPreviewDto,
  OrderDto,
  OrderLineDto,
  OrderShipmentDto,
} from "@/lib/api/orderDto";
import { COD_CAP } from "@/lib/shop/pricing";
import { ACCEPT_WINDOW_HOURS } from "@/lib/seller/rules";
import { db } from "@/server/db";
import { getCart, type CartReadClient } from "@/server/cart/service";
import { ApiError } from "@/server/http";
import { decryptOtp } from "@/server/security/otp";
import { getAddress, toAddress } from "./addresses";
import { refreshOrderStage, refundHeldEscrow, restoreReservedStock, cancelCodCollection } from "./lifecycle";
import type { ReportShipmentIssueInput } from "./validation";

const ISSUE_LABELS: Record<string, string> = {
  damaged_goods: "Damaged goods",
};

const D = Prisma.Decimal;
const STAGE_INDEX = {
  ordered: 0,
  packed: 1,
  shipped: 2,
  out_for_delivery: 3,
  delivered: 4,
} as const;

export const orderInclude = {
  lines: {
    include: {
      seller: { select: { storeName: true } },
      product: { include: { category: { select: { name: true } } } },
    },
  },
  shipments: {
    include: {
      seller: { select: { storeName: true } },
      events: { orderBy: { at: "asc" } },
      issue: true,
    },
  },
  escrow: { select: { type: true, amount: true } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function categoryArt(name: string): { hue: string; art: string } {
  const key = (Object.prototype.hasOwnProperty.call(ART, name) ? name : "Cement") as Category;
  return { hue: HUE[key], art: ART[key] };
}

function addressFromSnapshot(snapshot: Prisma.JsonValue): AddressDto {
  const value = (snapshot ?? {}) as Record<string, unknown>;
  return {
    id: String(value.id ?? ""),
    label: String(value.label ?? "Home"),
    name: String(value.name ?? ""),
    phone: String(value.phone ?? ""),
    line1: String(value.line1 ?? ""),
    city: String(value.city ?? ""),
    state: String(value.state ?? ""),
    pin: String(value.pin ?? ""),
    isDefault: Boolean(value.isDefault),
  };
}

function toOrderDto(order: OrderWithRelations, includeOtp = false): OrderDto {
  const lines: OrderLineDto[] = order.lines.map((line) => {
    const art = categoryArt(line.product.category.name);
    return {
      id: line.id,
      productId: line.productId,
      productCode: line.product.code,
      name: line.name,
      category: line.product.category.name,
      unit: line.unit,
      sellerId: line.sellerId,
      sellerName: line.seller.storeName,
      qty: line.qty,
      unitPrice: line.unitPrice.toFixed(2),
      lineValue: line.lineValue.toFixed(2),
      hue: art.hue,
      art: art.art,
    };
  });

  const shipments: OrderShipmentDto[] = order.shipments.map((shipment) => ({
    id: shipment.id,
    code: shipment.code,
    sellerId: shipment.sellerId,
    sellerName: shipment.seller.storeName,
    status: shipment.status,
    deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
    reviewEnds: shipment.reviewEnds?.toISOString() ?? null,
    otp: includeOtp && shipment.status === "dispatched" ? decryptOtp(shipment.otpEncrypted) : null,
    events: shipment.events.map((event) => ({
      at: event.at.toISOString(),
      actor: event.actor,
      message: event.message,
    })),
    issue: shipment.issue
      ? {
          type: shipment.issue.type,
          note: shipment.issue.note,
          createdAt: shipment.issue.createdAt.toISOString(),
        }
      : null,
  }));

  const escrow = order.escrow.reduce(
    (sum, entry) => {
      if (entry.type === "held") sum.held += Number(entry.amount);
      else if (entry.type === "refund") sum.refunded += Number(entry.amount);
      else if (entry.type === "released") sum.released += Number(entry.amount);
      return sum;
    },
    { held: 0, refunded: 0, released: 0 },
  );

  return {
    id: order.code,
    code: order.code,
    createdAt: order.createdAt.toISOString(),
    stage: STAGE_INDEX[order.stage],
    cancelled: order.cancelled,
    financeModel: order.financeModel,
    paymentMethod: order.paymentMethod,
    paymentLabel: order.paymentLabel,
    couponCode: order.couponCode,
    itemCount: order.lines.reduce((sum, line) => sum + line.qty, 0),
    address: addressFromSnapshot(order.addressSnapshot),
    totals: {
      subtotal: order.itemValue.toFixed(2),
      discount: order.discount.toFixed(2),
      deliveryFee: order.deliveryFee.toFixed(2),
      taxAmount: order.taxAmount.toFixed(2),
      total: order.grossTotal.toFixed(2),
    },
    escrow: {
      held: escrow.held.toFixed(2),
      refunded: escrow.refunded.toFixed(2),
      released: escrow.released.toFixed(2),
    },
    lines,
    shipments,
  };
}

export function idempotencyOrderId(userId: string, key: string): string {
  return "ord_" + createHash("sha256").update(`${userId}:${key}`).digest("hex").slice(0, 24);
}

export async function previewCheckout(
  userId: string,
  addressId: string,
  couponCode: string | null,
): Promise<CheckoutPreviewDto> {
  const address = await getAddress(userId, addressId);
  const cart = await getCart(userId, couponCode);
  const errors: string[] = [];
  if (cart.items.length === 0) errors.push("Your cart is empty");
  for (const item of cart.items) {
    if (!item.available) errors.push(`${item.name}: ${item.issue ?? "Unavailable"}`);
  }

  const sellerIds = [...new Set(cart.groups.map((group) => group.sellerId))];
  const rows = await db.sellerPincode.findMany({
    where: { sellerId: { in: sellerIds }, pin: address.pin },
    select: { sellerId: true },
  });
  const serviceable = new Set(rows.map((row) => row.sellerId));
  for (const group of cart.groups) {
    if (!serviceable.has(group.sellerId)) {
      errors.push(`${group.sellerName} does not deliver to pincode ${address.pin}`);
    }
  }
  if (new D(cart.totals.total).gt(COD_CAP)) {
    errors.push("Cash on delivery is not available above ₹50,000");
  }

  return {
    address: toAddress(address),
    groups: cart.groups,
    totals: cart.totals,
    coupon: cart.coupon,
    errors,
    canPlaceOrder: errors.length === 0,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function generateOrderCode(client: Pick<PrismaClient, "order">): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `BG-${randomInt(100000, 1000000)}`;
    const exists = await client.order.findUnique({ where: { code } });
    if (!exists) return code;
  }
  throw new ApiError(500, "order_code_failed", "Could not allocate an order number");
}

export async function placeOrderTx(
  tx: Prisma.TransactionClient,
  userId: string,
  addressId: string,
  couponCode: string | null,
  orderId: string,
): Promise<OrderDto> {
  const address = await tx.address.findFirst({ where: { id: addressId, userId } });
  if (!address) throw new ApiError(404, "address_not_found", "Address not found");

  const cartRow = await tx.cart.findUnique({
    where: { userId },
    select: { id: true, items: { select: { sellerOfferId: true } } },
  });
  if (!cartRow || cartRow.items.length === 0) {
    throw new ApiError(422, "cart_empty", "Your cart is empty");
  }

  // Deterministic lock order prevents deadlocks between concurrent checkouts.
  const offerIds = [...new Set(cartRow.items.map((item) => item.sellerOfferId))].sort();
  for (const offerId of offerIds) {
    await tx.$queryRaw`SELECT "id" FROM "SellerOffer" WHERE "id" = ${offerId} FOR UPDATE`;
  }

  const cart = await getCart(userId, couponCode, tx as unknown as CartReadClient, true);
  if (cart.items.length === 0) throw new ApiError(422, "cart_empty", "Your cart is empty");
  const unavailable = cart.items.find((item) => !item.available);
  if (unavailable) {
    throw new ApiError(409, "item_unavailable", `${unavailable.name}: ${unavailable.issue ?? "Unavailable"}`);
  }

  const sellerIds = [...new Set(cart.groups.map((group) => group.sellerId))];
  const serviceableRows = await tx.sellerPincode.findMany({
    where: { sellerId: { in: sellerIds }, pin: address.pin },
    select: { sellerId: true },
  });
  const serviceable = new Set(serviceableRows.map((row) => row.sellerId));
  const unserviceable = sellerIds.find((sellerId) => !serviceable.has(sellerId));
  if (unserviceable) {
    throw new ApiError(409, "seller_unserviceable", `A seller does not deliver to pincode ${address.pin}`);
  }
  if (new D(cart.totals.total).gt(COD_CAP)) {
    throw new ApiError(422, "cod_limit", "Cash on delivery is not available above ₹50,000");
  }

  const now = new Date();
  const acceptBy = new Date(now.getTime() + ACCEPT_WINDOW_HOURS * 3_600_000);
  const code = await generateOrderCode(tx);

  // Stock is decremented exactly once per purchased offer, after all validation
  // and while the seller-offer rows are locked. Any failure rolls back.
  for (const item of cart.items) {
    const updated = await tx.sellerOffer.updateMany({
      where: { id: item.offerId, stock: { gte: item.qty }, status: "active" },
      data: { stock: { decrement: item.qty } },
    });
    if (updated.count !== 1) {
      throw new ApiError(409, "insufficient_stock", `${item.name}: stock changed, try again`);
    }
    const after = await tx.sellerOffer.findUnique({
      where: { id: item.offerId },
      select: { stock: true },
    });
    if (after?.stock === 0) {
      await tx.sellerOffer.update({ where: { id: item.offerId }, data: { status: "paused" } });
    }
  }

  const order = await tx.order.create({
    data: {
      id: orderId,
      code,
      userId,
      itemValue: new D(cart.totals.subtotal),
      discount: new D(cart.totals.discount),
      couponCode: cart.totals.couponCode,
      deliveryFee: new D(cart.totals.deliveryFee),
      taxAmount: new D(cart.totals.taxAmount),
      taxRate: new D("0.18"),
      grossTotal: new D(cart.totals.total),
      paymentMethod: "COD",
      paymentLabel: "Cash on delivery",
      // WP-1: new orders are seller-collected COD (the customer pays the seller
      // directly; Constro-Well never custodies the proceeds).
      financeModel: "seller_collected",
      addressSnapshot: {
        label: address.label,
        name: address.name,
        phone: address.phone,
        line1: address.line1,
        city: address.city,
        state: address.state,
        pin: address.pin,
      },
    },
  });

  const shipmentBySeller = new Map<string, string>();
  let shipmentIndex = 1;
  for (const group of cart.groups) {
    const shipment = await tx.shipment.create({
      data: {
        code: `${code}-${shipmentIndex}`,
        orderId: order.id,
        sellerId: group.sellerId,
        status: "new",
        acceptBy,
        events: {
          create: [
            {
              actor: "customer",
              message: "Order placed with cash on delivery",
              at: now,
            },
          ],
        },
      },
    });
    shipmentBySeller.set(group.sellerId, shipment.id);
    shipmentIndex += 1;
  }

  for (const item of cart.items) {
    const shipmentId = shipmentBySeller.get(item.sellerId);
    if (!shipmentId) throw new ApiError(500, "shipment_missing", "Shipment was not created");
    await tx.orderLine.create({
      data: {
        orderId: order.id,
        productId: item.productId,
        sellerId: item.sellerId,
        sellerOfferId: item.offerId,
        name: item.name,
        unit: item.unit,
        unitPrice: new D(item.unitPrice),
        qty: item.qty,
        lineValue: new D(item.lineTotal),
        shipmentId,
      },
    });
  }

  // Allocate the order-level coupon discount proportionally across sellers;
  // the last seller receives the rounding remainder so the totals sum exactly.
  // Each seller's expected COD = their group subtotal − allocated discount +
  // their delivery fee. Recorded as a CodCollection expectation, not platform
  // escrow (the seller collects this cash directly from the customer).
  const totalSubtotal = new D(cart.totals.subtotal);
  const totalDiscount = new D(cart.totals.discount);
  let allocated = new D(0);
  for (let index = 0; index < cart.groups.length; index += 1) {
    const group = cart.groups[index]!;
    const shipmentId = shipmentBySeller.get(group.sellerId);
    if (!shipmentId) continue;
    const groupSubtotal = new D(group.subtotal);
    const groupDiscount =
      index === cart.groups.length - 1
        ? totalDiscount.minus(allocated)
        : totalSubtotal.gt(0)
          ? totalDiscount.mul(groupSubtotal).div(totalSubtotal).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
          : new D(0);
    allocated = allocated.plus(groupDiscount);
    await tx.codCollection.create({
      data: {
        shipmentId,
        sellerId: group.sellerId,
        expectedAmount: groupSubtotal.minus(groupDiscount).plus(new D(group.deliveryFee)),
        status: "pending",
      },
    });
  }

  await tx.cartItem.deleteMany({ where: { cartId: cartRow.id, savedForLater: false } });

  const created = await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  return toOrderDto(created);
}

export async function placeOrder(
  userId: string,
  addressId: string,
  couponCode: string | null,
  idempotencyKey: string,
): Promise<OrderDto> {
  const orderId = idempotencyOrderId(userId, idempotencyKey);
  const existing = await db.order.findUnique({ where: { id: orderId }, include: orderInclude });
  if (existing) return toOrderDto(existing);

  try {
    return await db.$transaction(
      (tx) => placeOrderTx(tx, userId, addressId, couponCode, orderId),
      { timeout: 20_000 },
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      const duplicate = await db.order.findUnique({ where: { id: orderId }, include: orderInclude });
      if (duplicate) return toOrderDto(duplicate);
    }
    throw error;
  }
}

export async function listOrders(userId: string): Promise<OrderDto[]> {
  const orders = await db.order.findMany({
    where: { userId },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });
  return orders.map((order) => toOrderDto(order));
}

export async function getOrder(userId: string, id: string): Promise<OrderDto> {
  const order = await db.order.findFirst({
    where: { userId, OR: [{ code: id }, { id }] },
    include: orderInclude,
  });
  if (!order) throw new ApiError(404, "order_not_found", "Order not found");
  return toOrderDto(order, true);
}

const CANCELLABLE_STATUSES = ["new", "accepted", "packed"] as const;

/** Customer cancellation before any shipment is dispatched. */
export async function cancelOrder(
  userId: string,
  id: string,
  reason: string,
): Promise<OrderDto> {
  return db.$transaction(
    async (tx) => {
      const order = await tx.order.findFirst({
        where: { userId, OR: [{ code: id }, { id }] },
        select: { id: true },
      });
      if (!order) throw new ApiError(404, "order_not_found", "Order not found");

      await tx.$queryRaw`SELECT "id" FROM "Shipment" WHERE "orderId" = ${order.id} FOR UPDATE`;
      const shipments = await tx.shipment.findMany({
        where: { orderId: order.id },
        include: {
          lines: { select: { sellerOfferId: true, qty: true } },
          escrowEntries: { select: { type: true, amount: true } },
        },
      });
      if (shipments.length === 0) {
        throw new ApiError(409, "not_cancellable", "This order has no shipments to cancel");
      }
      const blocked = shipments.find(
        (shipment) => !(CANCELLABLE_STATUSES as readonly string[]).includes(shipment.status),
      );
      if (blocked) {
        throw new ApiError(409, "too_late_to_cancel", "An order cannot be cancelled after a seller dispatches it");
      }

      const now = new Date();
      for (const shipment of shipments) {
        const updated = await tx.shipment.updateMany({
          where: { id: shipment.id, status: { in: [...CANCELLABLE_STATUSES] } },
          data: { status: "cancelled" },
        });
        if (updated.count !== 1) {
          throw new ApiError(409, "already_cancelled", "This order was already cancelled");
        }
        await restoreReservedStock(tx, shipment.lines);
        await refundHeldEscrow(tx, shipment, "Order cancelled by customer, held amount refunded", now);
        await cancelCodCollection(tx, shipment.id);
        await tx.shipmentEvent.create({
          data: {
            shipmentId: shipment.id,
            actor: "customer",
            message: `Cancelled by customer: ${reason}`,
            at: now,
          },
        });
      }

      await tx.order.update({ where: { id: order.id }, data: { cancelled: true } });
      await refreshOrderStage(tx, order.id);
      const fresh = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude,
      });
      return toOrderDto(fresh);
    },
    { timeout: 20_000 },
  );
}

/** Loads a shipment the given customer owns (via the parent order) and locks its row. */
async function lockOwnedShipment(
  tx: Prisma.TransactionClient,
  userId: string,
  orderId: string,
  shipmentId: string,
): Promise<{ orderPk: string; shipmentPk: string; status: string }> {
  const order = await tx.order.findFirst({
    where: { userId, OR: [{ code: orderId }, { id: orderId }] },
    select: { id: true },
  });
  if (!order) throw new ApiError(404, "order_not_found", "Order not found");

  await tx.$queryRaw`SELECT "id" FROM "Shipment" WHERE "id" = ${shipmentId} AND "orderId" = ${order.id} FOR UPDATE`;
  const shipment = await tx.shipment.findFirst({
    where: { id: shipmentId, orderId: order.id },
    select: { id: true, status: true },
  });
  if (!shipment) throw new ApiError(404, "shipment_not_found", "Shipment not found");
  return { orderPk: order.id, shipmentPk: shipment.id, status: shipment.status };
}

/**
 * Customer confirms a delivered shipment during its review window — closes
 * the window early with no dispute. Purely a status/event record today: no
 * settlement job reacts to "settled" yet (task 7.5), so this never moves
 * money or commission on its own.
 */
export async function confirmShipmentDelivery(
  userId: string,
  orderId: string,
  shipmentId: string,
): Promise<OrderDto> {
  return db.$transaction(async (tx) => {
    const { orderPk, shipmentPk, status } = await lockOwnedShipment(tx, userId, orderId, shipmentId);
    if (status !== "review") {
      throw new ApiError(409, "not_reviewable", "This shipment is not awaiting your review");
    }
    const now = new Date();
    await tx.shipment.update({ where: { id: shipmentPk }, data: { status: "settled" } });
    await tx.shipmentEvent.create({
      data: { shipmentId: shipmentPk, actor: "customer", message: "Customer confirmed delivery", at: now },
    });
    await refreshOrderStage(tx, orderPk);
    const fresh = await tx.order.findUniqueOrThrow({ where: { id: orderPk }, include: orderInclude });
    return toOrderDto(fresh);
  });
}

/**
 * Customer reports a problem with a delivered shipment during its review
 * window. Opens the same `ShipmentIssue` record the driver's auto-shortfall
 * dispute uses (type "damaged_goods" is the customer-report slot in the
 * approved vocabulary); an admin resolves it (WP-2, not yet built — gated on
 * the open refund/adjustment policy decision). This action only records the
 * report; it does not move money.
 */
export async function reportShipmentIssue(
  userId: string,
  orderId: string,
  shipmentId: string,
  input: ReportShipmentIssueInput,
): Promise<OrderDto> {
  return db.$transaction(async (tx) => {
    const { orderPk, shipmentPk, status } = await lockOwnedShipment(tx, userId, orderId, shipmentId);
    if (status !== "review") {
      throw new ApiError(409, "not_reviewable", "This shipment is not awaiting your review");
    }
    const now = new Date();
    try {
      await tx.shipmentIssue.create({
        data: { shipmentId: shipmentPk, type: input.type, note: input.note, auto: false, createdAt: now },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ApiError(409, "issue_already_reported", "An issue was already reported for this shipment");
      }
      throw error;
    }
    await tx.shipment.update({ where: { id: shipmentPk }, data: { status: "disputed" } });
    await tx.shipmentEvent.create({
      data: {
        shipmentId: shipmentPk,
        actor: "customer",
        message: `Customer reported an issue (${ISSUE_LABELS[input.type] ?? input.type}): ${input.note}`,
        at: now,
      },
    });
    await refreshOrderStage(tx, orderPk);
    const fresh = await tx.order.findUniqueOrThrow({ where: { id: orderPk }, include: orderInclude });
    return toOrderDto(fresh);
  });
}
