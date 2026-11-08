import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { addCartItem } from "@/server/cart/service";
import { createAddress } from "./addresses";
import { getOrder, cancelOrder, idempotencyOrderId, placeOrder, placeOrderTx, previewCheckout } from "./service";
import { refreshOrderStage } from "./lifecycle";

const hasDb = Boolean(process.env.DATABASE_URL);
const prisma = hasDb ? new PrismaClient() : null;
const created = { users: [] as string[], sellers: [] as string[], offers: [] as string[], orders: [] as string[] };

async function customer() {
  if (!prisma) throw new Error("DATABASE_URL is required");
  const user = await prisma.user.create({
    data: {
      email: `order-customer-${randomUUID()}@example.test`,
      passwordHash: await bcrypt.hash("OrderTest9!", 4),
      role: "customer",
      name: "Order Test Customer",
    },
  });
  created.users.push(user.id);
  return user;
}

async function sellerWithOffer(index: number, price: string) {
  if (!prisma) throw new Error("DATABASE_URL is required");
  const user = await prisma.user.create({
    data: {
      email: `order-seller-${randomUUID()}@example.test`,
      passwordHash: "unused",
      role: "seller",
      name: `Order Seller ${index}`,
    },
  });
  created.users.push(user.id);
  const seller = await prisma.seller.create({
    data: {
      code: `order-seller-${randomUUID()}`,
      ownerUserId: user.id,
      storeName: `Order Seller ${index}`,
      gstin: `29${randomUUID().replace(/-/g, "").slice(0, 13).toUpperCase()}`,
      phone: "9800000000",
      city: "Bengaluru",
      pickupAddress: "Test pickup",
      bankRef: "Test bank",
      kycGst: "pending",
      kycPan: "pending",
      kycCheque: "pending",
      freeAbove: 5000,
      fee: 199,
      slotsPerDay: [3],
    },
  });
  created.sellers.push(seller.id);
  await prisma.sellerPincode.create({ data: { sellerId: seller.id, pin: "560001" } });
  const product = await prisma.product.findUnique({ where: { code: index === 0 ? "0" : "1" } });
  if (!product) throw new Error("seed product missing");
  const offer = await prisma.sellerOffer.create({
    data: {
      code: `${seller.code}:${product.code}`,
      sellerId: seller.id,
      productId: product.id,
      price,
      stock: 20,
      minOrderQty: 1,
      status: "active",
      leadTimeDays: 1,
    },
  });
  created.offers.push(offer.id);
  return offer;
}

async function addressFor(userId: string, pin = "560001") {
  return createAddress(userId, {
    label: "Home",
    name: "Order Test Customer",
    phone: "9845012345",
    line1: "12 Test Street",
    city: "Bengaluru",
    state: "Karnataka",
    pin,
    isDefault: true,
  });
}

async function cleanupOrder(code: string) {
  if (!prisma) return;
  const order = await prisma.order.findUnique({ where: { code }, select: { id: true } });
  if (!order) return;
  await prisma.escrowEntry.deleteMany({ where: { orderId: order.id } });
  await prisma.shipmentIssue.deleteMany({ where: { shipment: { orderId: order.id } } });
  await prisma.shipmentEvent.deleteMany({ where: { shipment: { orderId: order.id } } });
  await prisma.orderLine.deleteMany({ where: { orderId: order.id } });
  await prisma.shipment.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
}

describe.skipIf(!hasDb)("checkout and order placement", { timeout: 30_000 }, () => {
  afterAll(async () => {
    if (!prisma) return;
    for (const code of created.orders) await cleanupOrder(code).catch(() => {});
    await prisma.cartItem.deleteMany({ where: { cart: { userId: { in: created.users } } } }).catch(() => {});
    await prisma.cart.deleteMany({ where: { userId: { in: created.users } } }).catch(() => {});
    await prisma.address.deleteMany({ where: { userId: { in: created.users } } }).catch(() => {});
    await prisma.sellerOffer.deleteMany({ where: { id: { in: created.offers } } }).catch(() => {});
    await prisma.sellerPincode.deleteMany({ where: { sellerId: { in: created.sellers } } }).catch(() => {});
    await prisma.seller.deleteMany({ where: { id: { in: created.sellers } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: created.users } } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("splits a multi-seller order, uses re-read prices, and rolls back cleanly", async () => {
    const user = await customer();
    const address = await addressFor(user.id);
    const offerA = await sellerWithOffer(0, "100.00");
    const offerB = await sellerWithOffer(1, "200.00");
    await addCartItem(user.id, offerA.id, 5);
    await addCartItem(user.id, offerB.id, 5);

    const observed: Array<{
      code: string;
      lines: number;
      shipments: number;
      escrow: number;
      total: string;
      firstUnitPrice: string;
    }> = [];
    const marker = new Error("__ORDER_ROLLBACK__");
    try {
      await prisma!.$transaction(
        async (tx) => {
          await tx.sellerOffer.update({ where: { id: offerA.id }, data: { price: "110.00" } });
          const order = await placeOrderTx(
            tx,
            user.id,
            address.id,
            null,
            idempotencyOrderId(user.id, "rollback-key"),
          );
          observed.push({
            code: order.code,
            lines: await tx.orderLine.count({ where: { order: { code: order.code } } }),
            shipments: await tx.shipment.count({ where: { order: { code: order.code } } }),
            escrow: await tx.escrowEntry.count({ where: { order: { code: order.code } } }),
            total: order.totals.total,
            firstUnitPrice: order.lines.find((line) => line.sellerId === offerA.sellerId)?.unitPrice ?? "",
          });
          throw marker;
        },
        { timeout: 20_000 },
      );
    } catch (error) {
      if (error !== marker) throw error;
    }

    // The rollback happened before the order id was known to the caller.
    expect(observed).toHaveLength(1);
    const capture = observed[0];
    expect(capture.lines).toBe(2);
    expect(capture.shipments).toBe(2);
    expect(capture.escrow).toBe(2);
    expect(capture.total).toBe("1948.00");
    expect(capture.firstUnitPrice).toBe("110.00");
    expect(await prisma!.order.count({ where: { id: idempotencyOrderId(user.id, "rollback-key") } })).toBe(0);
    const offers = await prisma!.sellerOffer.findMany({
      where: { id: { in: [offerA.id, offerB.id] } },
      select: { stock: true, price: true },
      orderBy: { id: "asc" },
    });
    expect(offers.map((offer) => offer.stock)).toEqual([20, 20]);
    const cart = await prisma!.cartItem.count({ where: { cart: { userId: user.id } } });
    expect(cart).toBe(2);
  });

  it("enforces address and order ownership", async () => {
    const owner = await customer();
    const other = await customer();
    const address = await addressFor(owner.id);
    const offer = await sellerWithOffer(0, "100.00");
    await addCartItem(owner.id, offer.id, 1);
    await expect(previewCheckout(other.id, address.id, null)).rejects.toMatchObject({
      status: 404,
    });
    await expect(getOrder(other.id, "BG-000000")).rejects.toMatchObject({ status: 404 });
  });

  it("cancels a pre-dispatch order once, restoring stock and escrow", async () => {
    const user = await customer();
    const other = await customer();
    const address = await addressFor(user.id);
    const offerA = await sellerWithOffer(0, "100.00");
    const offerB = await sellerWithOffer(1, "200.00");
    await addCartItem(user.id, offerA.id, 5);
    await addCartItem(user.id, offerB.id, 5);
    const order = await placeOrder(user.id, address.id, null, `cancel-${randomUUID()}`);
    created.orders.push(order.code);

    const held = order.escrow.held;
    const cancelled = await cancelOrder(user.id, order.code, "Ordered by mistake");
    expect(cancelled.cancelled).toBe(true);
    expect(cancelled.shipments.every((shipment) => shipment.status === "cancelled")).toBe(true);
    expect(cancelled.escrow.refunded).toBe(held);

    const stocks = await prisma!.sellerOffer.findMany({
      where: { id: { in: [offerA.id, offerB.id] } },
      select: { stock: true },
    });
    expect(stocks.map((offer) => offer.stock).sort()).toEqual([20, 20]);
    expect(await prisma!.escrowEntry.count({ where: { order: { code: order.code }, type: "refund" } })).toBe(2);

    await expect(cancelOrder(user.id, order.code, "Again")).rejects.toMatchObject({ status: 409 });
    await expect(cancelOrder(other.id, order.code, "Not mine")).rejects.toMatchObject({ status: 404 });
    expect(await prisma!.escrowEntry.count({ where: { order: { code: order.code }, type: "refund" } })).toBe(2);
  });

  it("refuses cancellation after any shipment is dispatched", async () => {
    const user = await customer();
    const address = await addressFor(user.id);
    const offer = await sellerWithOffer(0, "100.00");
    await addCartItem(user.id, offer.id, 2);
    const order = await placeOrder(user.id, address.id, null, `cancel-blocked-${randomUUID()}`);
    created.orders.push(order.code);

    await prisma!.shipment.update({
      where: { id: order.shipments[0].id },
      data: { status: "dispatched" },
    });
    await expect(cancelOrder(user.id, order.code, "Too late")).rejects.toMatchObject({ status: 409 });
    expect((await prisma!.shipment.findUniqueOrThrow({ where: { id: order.shipments[0].id } })).status).toBe("dispatched");
    expect((await prisma!.sellerOffer.findUniqueOrThrow({ where: { id: offer.id } })).stock).toBe(18);
  });

  it("does not mark a mixed multi-seller order delivered", async () => {
    const user = await customer();
    const address = await addressFor(user.id);
    const offerA = await sellerWithOffer(0, "100.00");
    const offerB = await sellerWithOffer(1, "200.00");
    await addCartItem(user.id, offerA.id, 1);
    await addCartItem(user.id, offerB.id, 1);
    const order = await placeOrder(user.id, address.id, null, `stage-${randomUUID()}`);
    created.orders.push(order.code);
    const [first, second] = order.shipments;
    const orderId = (await prisma!.order.findUniqueOrThrow({ where: { code: order.code }, select: { id: true } })).id;

    await prisma!.shipment.update({ where: { id: first.id }, data: { status: "review" } });
    await prisma!.$transaction((tx) => refreshOrderStage(tx, orderId));
    let row = await prisma!.order.findUniqueOrThrow({ where: { code: order.code } });
    expect(row.stage).toBe("shipped");

    await prisma!.shipment.update({ where: { id: second.id }, data: { status: "dispatched" } });
    await prisma!.$transaction((tx) => refreshOrderStage(tx, row.id));
    row = await prisma!.order.findUniqueOrThrow({ where: { code: order.code } });
    expect(row.stage).toBe("shipped");

    await prisma!.shipment.update({ where: { id: second.id }, data: { status: "review" } });
    await prisma!.$transaction((tx) => refreshOrderStage(tx, row.id));
    row = await prisma!.order.findUniqueOrThrow({ where: { code: order.code } });
    expect(row.stage).toBe("delivered");
  });

  it("is idempotent and serializes concurrent order submissions", async () => {
    const user = await customer();
    const address = await addressFor(user.id);
    const offerA = await sellerWithOffer(0, "100.00");
    const offerB = await sellerWithOffer(1, "200.00");
    await addCartItem(user.id, offerA.id, 5);
    await addCartItem(user.id, offerB.id, 5);

    const key = `idem-${randomUUID()}`;
    const first = await placeOrder(user.id, address.id, null, key);
    created.orders.push(first.code);
    const second = await placeOrder(user.id, address.id, null, key);
    expect(second.code).toBe(first.code);
    expect(await prisma!.order.count({ where: { id: idempotencyOrderId(user.id, key) } })).toBe(1);

    let stocks = await prisma!.sellerOffer.findMany({
      where: { id: { in: [offerA.id, offerB.id] } },
      select: { stock: true },
      orderBy: { id: "asc" },
    });
    expect(stocks.map((offer) => offer.stock)).toEqual([15, 15]);

    await addCartItem(user.id, offerA.id, 3);
    await addCartItem(user.id, offerB.id, 3);
    const results = await Promise.allSettled([
      placeOrder(user.id, address.id, null, `${key}-concurrent-a`),
      placeOrder(user.id, address.id, null, `${key}-concurrent-b`),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    results
      .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof placeOrder>>> => result.status === "fulfilled")
      .forEach((result) => created.orders.push(result.value.code));
    expect(fulfilled).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected && "reason" in rejected ? rejected.reason : null).toMatchObject({ status: 422 });

    stocks = await prisma!.sellerOffer.findMany({
      where: { id: { in: [offerA.id, offerB.id] } },
      select: { stock: true },
      orderBy: { id: "asc" },
    });
    expect(stocks.map((offer) => offer.stock)).toEqual([12, 12]);
  });
});
