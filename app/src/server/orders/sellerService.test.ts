import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { addCartItem } from "@/server/cart/service";
import { createAddress } from "./addresses";
import { placeOrder } from "./service";
import {
  acceptShipment,
  dispatchShipment,
  getSellerShipment,
  listSellerOrders,
  markShipmentMissed,
  packShipment,
  redispatchShipment,
  rejectShipment,
  sellerPaymentsSummary,
  sellerPerformanceStats,
} from "./sellerService";

const hasDb = Boolean(process.env.DATABASE_URL);
const prisma = hasDb ? new PrismaClient() : null;
const created = {
  users: [] as string[],
  sellers: [] as string[],
  offers: [] as string[],
  vehicles: [] as string[],
  drivers: [] as string[],
  orders: [] as string[],
};

async function makeSeller(index: number, productCode: string) {
  if (!prisma) throw new Error("DATABASE_URL is required");
  const user = await prisma.user.create({
    data: {
      email: `seller-lifecycle-${randomUUID()}@example.test`,
      passwordHash: await bcrypt.hash("SellerTest9!", 4),
      role: "seller",
      name: `Lifecycle Seller ${index}`,
    },
  });
  created.users.push(user.id);
  const seller = await prisma.seller.create({
    data: {
      code: `lifecycle-${randomUUID()}`,
      ownerUserId: user.id,
      storeName: `Lifecycle Seller ${index}`,
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
  const driver = await prisma.driver.create({
    data: { sellerId: seller.id, code: `d-${randomUUID()}`, name: "Lifecycle Driver", phone: "9800000001" },
  });
  created.drivers.push(driver.id);
  const vehicle = await prisma.vehicle.create({
    data: { sellerId: seller.id, code: `v-${randomUUID()}`, regNumber: `KA${randomUUID().slice(0, 6).toUpperCase()}`, type: "Truck", driverId: driver.id },
  });
  created.vehicles.push(vehicle.id);
  const product = await prisma.product.findUnique({ where: { code: productCode } });
  if (!product) throw new Error("seed product missing");
  const offer = await prisma.sellerOffer.create({
    data: {
      code: `${seller.code}:${product.code}`,
      sellerId: seller.id,
      productId: product.id,
      price: "100.00",
      stock: 20,
      minOrderQty: 1,
      status: "active",
      leadTimeDays: 1,
    },
  });
  created.offers.push(offer.id);
  return { user, seller, driver, vehicle, offer };
}

async function customerWithOrder(offerId: string) {
  if (!prisma) throw new Error("DATABASE_URL is required");
  const user = await prisma.user.create({
    data: {
      email: `seller-order-customer-${randomUUID()}@example.test`,
      passwordHash: "unused",
      role: "customer",
      name: "Seller Order Customer",
    },
  });
  created.users.push(user.id);
  const address = await createAddress(user.id, {
    label: "Home",
    name: "Seller Order Customer",
    phone: "9845012345",
    line1: "12 Test Street",
    city: "Bengaluru",
    state: "Karnataka",
    pin: "560001",
    isDefault: true,
  });
  await addCartItem(user.id, offerId, 1);
  const order = await placeOrder(user.id, address.id, null, `seller-order-${randomUUID()}`);
  created.orders.push(order.code);
  return order;
}

async function cleanup() {
  if (!prisma) return;
  for (const code of created.orders) {
    const order = await prisma.order.findUnique({ where: { code }, select: { id: true } });
    if (!order) continue;
    await prisma.escrowEntry.deleteMany({ where: { orderId: order.id } });
    await prisma.codCollection.deleteMany({ where: { shipment: { orderId: order.id } } });
    await prisma.commissionAssessment.deleteMany({ where: { shipment: { orderId: order.id } } });
    await prisma.shipmentIssue.deleteMany({ where: { shipment: { orderId: order.id } } });
    await prisma.shipmentEvent.deleteMany({ where: { shipment: { orderId: order.id } } });
    await prisma.orderLine.deleteMany({ where: { orderId: order.id } });
    await prisma.shipment.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  }
  await prisma.cartItem.deleteMany({ where: { cart: { userId: { in: created.users } } } }).catch(() => {});
  await prisma.cart.deleteMany({ where: { userId: { in: created.users } } }).catch(() => {});
  await prisma.address.deleteMany({ where: { userId: { in: created.users } } }).catch(() => {});
  // The payments test writes a seller-scoped `withdrawn` escrow row (no order)
  // — it would block seller deletion via Restrict if left behind.
  await prisma.escrowEntry.deleteMany({ where: { sellerId: { in: created.sellers } } }).catch(() => {});
  await prisma.sellerOffer.deleteMany({ where: { id: { in: created.offers } } }).catch(() => {});
  await prisma.vehicle.deleteMany({ where: { id: { in: created.vehicles } } }).catch(() => {});
  await prisma.driver.deleteMany({ where: { id: { in: created.drivers } } }).catch(() => {});
  await prisma.sellerPincode.deleteMany({ where: { sellerId: { in: created.sellers } } }).catch(() => {});
  await prisma.seller.deleteMany({ where: { id: { in: created.sellers } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: created.users } } }).catch(() => {});
}

describe.skipIf(!hasDb)("seller order lifecycle", { timeout: 30_000 }, () => {
  // Cleanup now deletes rows for 10 sellers/customers across 6 tests; the
  // default 10s hook timeout was observed to flake under concurrent DB load.
  afterAll(async () => {
    await cleanup();
    if (prisma) await prisma.$disconnect();
  }, 30_000);

  it("lists only own shipments, accepts, packs, dispatches and blocks repeats", async () => {
    const first = await makeSeller(1, "0");
    const second = await makeSeller(2, "1");
    const order = await customerWithOrder(first.offer.id);
    const shipmentId = order.shipments[0].id;

    const own = await listSellerOrders(first.seller.id);
    expect(own.orders.some((shipment) => shipment.id === shipmentId)).toBe(true);
    const other = await listSellerOrders(second.seller.id);
    expect(other.orders.some((shipment) => shipment.id === shipmentId)).toBe(false);
    await expect(getSellerShipment(second.seller.id, shipmentId)).rejects.toMatchObject({ status: 404 });

    const stockBefore = (await prisma!.sellerOffer.findUnique({ where: { id: first.offer.id } }))!.stock;
    const accepted = await acceptShipment(first.seller.id, shipmentId);
    expect(accepted.status).toBe("accepted");
    expect(accepted.dispatchBy).not.toBeNull();
    expect(accepted.events.at(-1)?.message).toContain("Accepted");
    expect((await prisma!.sellerOffer.findUnique({ where: { id: first.offer.id } }))!.stock).toBe(stockBefore);
    await expect(acceptShipment(first.seller.id, shipmentId)).rejects.toMatchObject({ status: 409 });

    const packed = await packShipment(first.seller.id, shipmentId);
    expect(packed.status).toBe("packed");
    const dispatched = await dispatchShipment(first.seller.id, shipmentId, {
      vehicleId: first.vehicle.id,
      slot: "Today, 2 to 6 pm",
      challan: true,
      invoice: true,
      weighbridge: "WB-1234",
    });
    expect(dispatched.status).toBe("dispatched");
    expect(dispatched.vehicleId).toBe(first.vehicle.id);
    expect(dispatched.docs.challan).toBe(true);
    await expect(
      dispatchShipment(first.seller.id, shipmentId, {
        vehicleId: first.vehicle.id,
        slot: "Today, 2 to 6 pm",
        challan: true,
        invoice: true,
        weighbridge: "WB-1234",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejects once, restores stock and cancels the COD collection", async () => {
    const seller = await makeSeller(3, "0");
    const order = await customerWithOrder(seller.offer.id);
    const shipmentId = order.shipments[0].id;
    const stockAfterOrder = (await prisma!.sellerOffer.findUnique({ where: { id: seller.offer.id } }))!.stock;
    expect(stockAfterOrder).toBe(19);

    const rejected = await rejectShipment(seller.seller.id, shipmentId, "Out of stock");
    expect(rejected.status).toBe("rejected");
    expect((await prisma!.sellerOffer.findUnique({ where: { id: seller.offer.id } }))!.stock).toBe(20);
    expect(rejected.events.at(-1)?.message).toContain("Rejected");
    // No platform-held escrow; the pending COD collection is cancelled instead.
    const collection = await prisma!.codCollection.findUnique({ where: { shipmentId } });
    expect(collection?.status).toBe("cancelled");

    await expect(rejectShipment(seller.seller.id, shipmentId, "Again")).rejects.toMatchObject({ status: 409 });
    expect((await prisma!.sellerOffer.findUnique({ where: { id: seller.offer.id } }))!.stock).toBe(20);
  });

  it("computes the legacy escrow summary from historical entries, scoped to the seller", async () => {
    const seller = await makeSeller(4, "0");
    const other = await makeSeller(5, "1");
    const openOrder = await customerWithOrder(seller.offer.id); // no escrow created — simulate a legacy held row
    const openShipmentId = openOrder.shipments[0].id;
    const openOrderRow = await prisma!.order.findUniqueOrThrow({ where: { code: openOrder.code }, select: { id: true } });

    // A still-open legacy shipment: held only, which lands in pendingRelease.
    await prisma!.escrowEntry.create({
      data: { orderId: openOrderRow.id, shipmentId: openShipmentId, sellerId: seller.seller.id, type: "held", amount: "100.00", note: "legacy held" },
    });

    // A settled legacy shipment: simulate the commission+release the review
    // window normally produced (prisma/seed.ts does the same thing directly).
    const settledOrder = await customerWithOrder(seller.offer.id);
    const settledShipmentId = settledOrder.shipments[0].id;
    const settledOrderRow = await prisma!.order.findUniqueOrThrow({ where: { code: settledOrder.code }, select: { id: true } });
    await prisma!.shipment.update({ where: { id: settledShipmentId }, data: { status: "settled" } });
    await prisma!.escrowEntry.create({
      data: { orderId: settledOrderRow.id, shipmentId: settledShipmentId, sellerId: seller.seller.id, type: "held", amount: "100.00", note: "legacy held" },
    });
    await prisma!.escrowEntry.create({
      data: { orderId: settledOrderRow.id, shipmentId: settledShipmentId, sellerId: seller.seller.id, type: "commission", amount: "5.00", note: "test commission" },
    });
    await prisma!.escrowEntry.create({
      data: { orderId: settledOrderRow.id, shipmentId: settledShipmentId, sellerId: seller.seller.id, type: "released", amount: "95.00", note: "test release" },
    });
    await prisma!.escrowEntry.create({
      data: { sellerId: seller.seller.id, type: "withdrawn", amount: "40.00", note: "test transfer" },
    });

    const summary = await sellerPaymentsSummary(seller.seller.id);
    expect(summary.totalReleased).toBe("95.00");
    expect(summary.totalWithdrawn).toBe("40.00");
    expect(summary.balance.available).toBe("55.00");
    expect(summary.balance.pendingRelease).toBe("100.00"); // the still-open legacy held
    expect(summary.balance.frozen).toBe("0.00");
    expect(summary.ledger.some((e) => e.shipmentCode && e.type === "held")).toBe(true);
    expect(summary.bankRef).toBe("Test bank");

    const otherSummary = await sellerPaymentsSummary(other.seller.id);
    expect(otherSummary.ledger.length).toBe(0);
    expect(otherSummary.balance.available).toBe("0.00");
  });

  it("computes performance stats from real shipment history, scoped to the seller", async () => {
    const seller = await makeSeller(6, "0");
    const accepted = await customerWithOrder(seller.offer.id);
    const rejected = await customerWithOrder(seller.offer.id);
    await customerWithOrder(seller.offer.id); // left in "new" status — excluded from offered/accepted

    await acceptShipment(seller.seller.id, accepted.shipments[0].id);
    await packShipment(seller.seller.id, accepted.shipments[0].id);
    await dispatchShipment(seller.seller.id, accepted.shipments[0].id, {
      vehicleId: seller.vehicle.id,
      slot: "Today, 2 to 6 pm",
      challan: true,
      invoice: true,
      weighbridge: "WB-9999",
    });
    await rejectShipment(seller.seller.id, rejected.shipments[0].id, "Out of stock");

    const { stats, score } = await sellerPerformanceStats(seller.seller.id);
    // offered/accepted exclude the still-"new" shipment (no decision made yet).
    expect(stats.offered).toBe(2);
    expect(stats.accepted).toBe(1);
    expect(stats.dispatched).toBe(1);
    expect(stats.ontime).toBe(1);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("reassigns a failed delivery attempt to a new vehicle, resets the OTP and clears the issue", async () => {
    const seller = await makeSeller(7, "0");
    const other = await makeSeller(8, "1");
    const order = await customerWithOrder(seller.offer.id);
    const shipmentId = order.shipments[0].id;
    await acceptShipment(seller.seller.id, shipmentId);
    await packShipment(seller.seller.id, shipmentId);
    await dispatchShipment(seller.seller.id, shipmentId, {
      vehicleId: seller.vehicle.id,
      slot: "Today, 2 to 6 pm",
      challan: true,
      invoice: true,
      weighbridge: "WB-1234",
    });
    const otpHashAfterDispatch = (await prisma!.shipment.findUniqueOrThrow({ where: { id: shipmentId } })).otpHash;

    // Simulate what `deliverDriverShipment` does after 3 wrong OTP tries.
    await prisma!.shipment.update({ where: { id: shipmentId }, data: { status: "failed", otpTries: 3 } });
    await prisma!.shipmentIssue.create({
      data: { shipmentId, type: "failed_attempt", note: "OTP entered incorrectly 3 times.", auto: false },
    });

    const secondDriver = await prisma!.driver.create({
      data: { sellerId: seller.seller.id, code: `d-${randomUUID()}`, name: "Second Driver", phone: "9800000099" },
    });
    created.drivers.push(secondDriver.id);
    const secondVehicle = await prisma!.vehicle.create({
      data: { sellerId: seller.seller.id, code: `v-${randomUUID()}`, regNumber: `KA${randomUUID().slice(0, 6).toUpperCase()}`, type: "Truck", driverId: secondDriver.id },
    });
    created.vehicles.push(secondVehicle.id);

    await expect(
      redispatchShipment(other.seller.id, shipmentId, {
        vehicleId: secondVehicle.id,
        slot: "Today, 2 to 6 pm",
        challan: true,
        invoice: true,
        weighbridge: "WB-5678",
      }),
    ).rejects.toMatchObject({ status: 404 });

    const reassigned = await redispatchShipment(seller.seller.id, shipmentId, {
      vehicleId: secondVehicle.id,
      slot: "Today, 2 to 6 pm",
      challan: true,
      invoice: true,
      weighbridge: "WB-5678",
    });
    expect(reassigned.status).toBe("dispatched");
    expect(reassigned.vehicleId).toBe(secondVehicle.id);
    expect(reassigned.issue).toBeNull();
    expect(reassigned.events.at(-1)?.message).toContain("Reassigned");

    const fresh = await prisma!.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(fresh.otpTries).toBe(0);
    expect(fresh.otpHash).not.toBe(otpHashAfterDispatch);
    expect(await prisma!.shipmentIssue.findUnique({ where: { shipmentId } })).toBeNull();

    // No longer "failed": a second reassignment attempt is rejected.
    await expect(
      redispatchShipment(seller.seller.id, shipmentId, {
        vehicleId: seller.vehicle.id,
        slot: "Today, 2 to 6 pm",
        challan: true,
        invoice: true,
        weighbridge: "WB-5678",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("marks a failed delivery as missed once, restoring stock and cancelling the COD collection", async () => {
    const seller = await makeSeller(9, "0");
    const other = await makeSeller(10, "1");
    const order = await customerWithOrder(seller.offer.id);
    const shipmentId = order.shipments[0].id;
    await acceptShipment(seller.seller.id, shipmentId);
    await packShipment(seller.seller.id, shipmentId);
    await dispatchShipment(seller.seller.id, shipmentId, {
      vehicleId: seller.vehicle.id,
      slot: "Today, 2 to 6 pm",
      challan: true,
      invoice: true,
      weighbridge: "WB-1234",
    });
    const stockAfterDispatch = (await prisma!.sellerOffer.findUnique({ where: { id: seller.offer.id } }))!.stock;
    expect(stockAfterDispatch).toBe(19);
    await prisma!.shipment.update({ where: { id: shipmentId }, data: { status: "failed", otpTries: 3 } });

    await expect(markShipmentMissed(other.seller.id, shipmentId, "Not mine")).rejects.toMatchObject({ status: 404 });

    const missed = await markShipmentMissed(seller.seller.id, shipmentId, "Customer unreachable after repeated attempts");
    expect(missed.status).toBe("missed");
    expect(missed.events.at(-1)?.message).toContain("Marked as missed");
    expect((await prisma!.sellerOffer.findUnique({ where: { id: seller.offer.id } }))!.stock).toBe(20);
    const collection = await prisma!.codCollection.findUnique({ where: { shipmentId } });
    expect(collection?.status).toBe("cancelled");

    await expect(markShipmentMissed(seller.seller.id, shipmentId, "Again")).rejects.toMatchObject({ status: 409 });
    expect((await prisma!.sellerOffer.findUnique({ where: { id: seller.offer.id } }))!.stock).toBe(20);
  });
});
