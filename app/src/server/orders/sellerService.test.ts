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
  packShipment,
  rejectShipment,
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
    await prisma.shipmentIssue.deleteMany({ where: { shipment: { orderId: order.id } } });
    await prisma.shipmentEvent.deleteMany({ where: { shipment: { orderId: order.id } } });
    await prisma.orderLine.deleteMany({ where: { orderId: order.id } });
    await prisma.shipment.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  }
  await prisma.cartItem.deleteMany({ where: { cart: { userId: { in: created.users } } } }).catch(() => {});
  await prisma.cart.deleteMany({ where: { userId: { in: created.users } } }).catch(() => {});
  await prisma.sellerOffer.deleteMany({ where: { id: { in: created.offers } } }).catch(() => {});
  await prisma.vehicle.deleteMany({ where: { id: { in: created.vehicles } } }).catch(() => {});
  await prisma.driver.deleteMany({ where: { id: { in: created.drivers } } }).catch(() => {});
  await prisma.seller.deleteMany({ where: { id: { in: created.sellers } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: created.users } } }).catch(() => {});
}

describe.skipIf(!hasDb)("seller order lifecycle", { timeout: 30_000 }, () => {
  afterAll(async () => {
    await cleanup();
    if (prisma) await prisma.$disconnect();
  });

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

  it("rejects once, restores stock and refunds escrow", async () => {
    const seller = await makeSeller(3, "0");
    const order = await customerWithOrder(seller.offer.id);
    const shipmentId = order.shipments[0].id;
    const stockAfterOrder = (await prisma!.sellerOffer.findUnique({ where: { id: seller.offer.id } }))!.stock;
    expect(stockAfterOrder).toBe(19);

    const rejected = await rejectShipment(seller.seller.id, shipmentId, "Out of stock");
    expect(rejected.status).toBe("rejected");
    expect((await prisma!.sellerOffer.findUnique({ where: { id: seller.offer.id } }))!.stock).toBe(20);
    expect(rejected.events.at(-1)?.message).toContain("Rejected");
    const refunds = await prisma!.escrowEntry.count({ where: { shipmentId, type: "refund" } });
    expect(refunds).toBe(1);

    await expect(rejectShipment(seller.seller.id, shipmentId, "Again")).rejects.toMatchObject({ status: 409 });
    expect((await prisma!.sellerOffer.findUnique({ where: { id: seller.offer.id } }))!.stock).toBe(20);
  });
});
