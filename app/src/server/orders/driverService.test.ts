import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { addCartItem } from "@/server/cart/service";
import { decryptOtp } from "@/server/security/otp";
import { createAddress } from "./addresses";
import { placeOrder, getOrder } from "./service";
import { acceptShipment, dispatchShipment } from "./sellerService";
import {
  acceptDriverJob,
  confirmDriverPickup,
  declineDriverJob,
  deliverDriverShipment,
  getDriverJob,
  listDriverJobs,
  reportDriverIssue,
} from "./driverService";

const hasDb = Boolean(process.env.DATABASE_URL);
process.env.OTP_ENCRYPTION_KEY ||= "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
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
      email: `driver-lifecycle-${randomUUID()}@example.test`,
      passwordHash: await bcrypt.hash("DriverTest9!", 4),
      role: "seller",
      name: `Driver Lifecycle Seller ${index}`,
    },
  });
  created.users.push(user.id);
  const seller = await prisma.seller.create({
    data: {
      code: `driver-life-${randomUUID()}`,
      ownerUserId: user.id,
      storeName: `Driver Lifecycle Seller ${index}`,
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
    data: { sellerId: seller.id, code: `d-${randomUUID()}`, name: `Driver ${index}`, phone: "9800000001" },
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

async function setup(qty = 1, index = 1) {
  if (!prisma) throw new Error("DATABASE_URL is required");
  const seller = await makeSeller(index, String(index % 2));
  const customer = await prisma.user.create({
    data: {
      email: `driver-order-customer-${randomUUID()}@example.test`,
      passwordHash: "unused",
      role: "customer",
      name: "Driver Order Customer",
    },
  });
  created.users.push(customer.id);
  const address = await createAddress(customer.id, {
    label: "Home",
    name: "Driver Order Customer",
    phone: "9845012345",
    line1: "12 Test Street",
    city: "Bengaluru",
    state: "Karnataka",
    pin: "560001",
    isDefault: true,
  });
  await addCartItem(customer.id, seller.offer.id, qty);
  const order = await placeOrder(customer.id, address.id, null, `driver-order-${randomUUID()}`);
  created.orders.push(order.code);
  const shipmentId = order.shipments[0].id;

  await acceptShipment(seller.seller.id, shipmentId);
  const dispatched = await dispatchShipment(seller.seller.id, shipmentId, {
    vehicleId: seller.vehicle.id,
    slot: "Today, 2 to 6 pm",
    challan: true,
    invoice: true,
    weighbridge: "WB-1234",
  });
  expect(dispatched.status).toBe("dispatched");
  const row = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
  const otp = decryptOtp(row.otpEncrypted);
  if (!otp) throw new Error("OTP encryption failed");
  return { ...seller, order, shipmentId, otp, qty, customer };
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
  await prisma.sellerOffer.deleteMany({ where: { id: { in: created.offers } } }).catch(() => {});
  await prisma.vehicle.deleteMany({ where: { id: { in: created.vehicles } } }).catch(() => {});
  await prisma.driver.deleteMany({ where: { id: { in: created.drivers } } }).catch(() => {});
  await prisma.sellerPincode.deleteMany({ where: { sellerId: { in: created.sellers } } }).catch(() => {});
  await prisma.seller.deleteMany({ where: { id: { in: created.sellers } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: created.users } } }).catch(() => {});
}

const wrong = (otp: string) => (otp === "0000" ? "1111" : "0000");

describe.skipIf(!hasDb)("driver delivery lifecycle", { timeout: 45_000 }, () => {
  afterAll(async () => {
    await cleanup();
    if (prisma) await prisma.$disconnect();
  });

  it("shows only jobs assigned to the authenticated driver", async () => {
    const first = await setup(1, 1);
    const second = await setup(1, 2);

    const jobs = await listDriverJobs(first.driver.id);
    expect(jobs.jobs.map((job) => job.id)).toContain(first.shipmentId);
    expect(jobs.jobs.map((job) => job.id)).not.toContain(second.shipmentId);

    await expect(getDriverJob(second.driver.id, first.shipmentId)).rejects.toMatchObject({ status: 404 });
    await expect(getDriverJob(first.driver.id, first.shipmentId)).resolves.toMatchObject({ id: first.shipmentId });
  });

  it("accepts a job idempotently without changing stock or escrow", async () => {
    const { driver, shipmentId, offer } = await setup(1, 1);
    const stock = (await prisma!.sellerOffer.findUniqueOrThrow({ where: { id: offer.id } })).stock;
    await acceptDriverJob(driver.id, shipmentId);
    const accepted = await acceptDriverJob(driver.id, shipmentId);
    expect(accepted.events.filter((event) => event.message.startsWith("Driver accepted delivery job"))).toHaveLength(1);
    expect((await prisma!.sellerOffer.findUniqueOrThrow({ where: { id: offer.id } })).stock).toBe(stock);
  });

  it("confirms pickup idempotently, keeping the customer OTP and shipped stage", async () => {
    const { driver, shipmentId, otp, customer, order } = await setup(1, 7);

    const picked = await confirmDriverPickup(driver.id, shipmentId);
    expect(picked.status).toBe("picked_up");

    const again = await confirmDriverPickup(driver.id, shipmentId);
    expect(again.status).toBe("picked_up");
    const pickupEvents = await prisma!.shipmentEvent.count({
      where: { shipmentId, message: { contains: "pickup" } },
    });
    expect(pickupEvents).toBe(1);

    const row = await prisma!.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      select: { orderId: true, otpEncrypted: true },
    });
    expect(row.otpEncrypted).not.toBeNull();
    const orderRow = await prisma!.order.findUniqueOrThrow({ where: { id: row.orderId }, select: { stage: true } });
    expect(orderRow.stage).toBe("shipped");

    const customerOrder = await getOrder(customer.id, order.id);
    expect(customerOrder.shipments[0].status).toBe("picked_up");
    expect(customerOrder.shipments[0].otp).toBe(otp);
  });

  it("delivers a picked-up shipment with the customer OTP", async () => {
    const { driver, shipmentId, otp } = await setup(1, 8);
    await confirmDriverPickup(driver.id, shipmentId);
    const delivered = await deliverDriverShipment(driver.id, shipmentId, { otp, deliveredQty: 1 });
    expect(delivered.status).toBe("review");
  });

  it("scopes pickup to the assigned driver and rejects a non-dispatched job", async () => {
    const first = await setup(1, 9);
    const second = await setup(1, 10);

    await expect(confirmDriverPickup(second.driver.id, first.shipmentId)).rejects.toMatchObject({ status: 404 });

    await deliverDriverShipment(first.driver.id, first.shipmentId, { otp: first.otp, deliveredQty: 1 });
    await expect(confirmDriverPickup(first.driver.id, first.shipmentId)).rejects.toMatchObject({ status: 409 });
  });

  it("declines a dispatched job, clears the assignment/OTP and returns it to packed", async () => {
    const { driver, seller, vehicle, shipmentId } = await setup(1, 11);

    const declined = await declineDriverJob(driver.id, shipmentId, "Vehicle breakdown");
    expect(declined.status).toBe("packed");
    expect(declined.driverName).toBe("");
    expect(declined.vehicleId).toBeNull();

    const row = await prisma!.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      select: {
        status: true,
        driverId: true,
        vehicleId: true,
        otpHash: true,
        otpEncrypted: true,
        otpTries: true,
        orderId: true,
      },
    });
    expect(row.status).toBe("packed");
    expect(row.driverId).toBeNull();
    expect(row.vehicleId).toBeNull();
    expect(row.otpHash).toBeNull();
    expect(row.otpEncrypted).toBeNull();
    expect(row.otpTries).toBe(0);

    // COD expectation and stock stay intact; only the assignment moved back.
    expect((await prisma!.codCollection.findUniqueOrThrow({ where: { shipmentId } })).status).toBe("pending");
    const orderRow = await prisma!.order.findUniqueOrThrow({ where: { id: row.orderId }, select: { stage: true } });
    expect(orderRow.stage).toBe("packed");
    const events = await prisma!.shipmentEvent.findMany({ where: { shipmentId }, select: { message: true } });
    expect(events.some((event) => event.message.includes("Vehicle breakdown"))).toBe(true);

    // The seller can dispatch the shipment again to another driver/vehicle.
    const redispatched = await dispatchShipment(seller.id, shipmentId, {
      vehicleId: vehicle.id,
      slot: "Tomorrow, 8 am to 12",
      challan: true,
      invoice: true,
      weighbridge: "WB-4321",
    });
    expect(redispatched.status).toBe("dispatched");
  });

  it("rejects duplicate declines, non-assigned drivers and declines after delivery", async () => {
    const first = await setup(1, 12);
    const second = await setup(1, 13);

    await expect(
      declineDriverJob(second.driver.id, first.shipmentId, "Not my route"),
    ).rejects.toMatchObject({ status: 404 });

    await declineDriverJob(first.driver.id, first.shipmentId, "Route mismatch");
    // The assignment is cleared, so a repeat decline is indistinguishable from
    // a job that is no longer this driver's (404), never a silent success.
    await expect(
      declineDriverJob(first.driver.id, first.shipmentId, "Again"),
    ).rejects.toMatchObject({ status: 404 });

    const picked = await setup(1, 15);
    await confirmDriverPickup(picked.driver.id, picked.shipmentId);
    await expect(
      declineDriverJob(picked.driver.id, picked.shipmentId, "After pickup"),
    ).rejects.toMatchObject({ status: 409 });

    const delivered = await setup(1, 14);
    await deliverDriverShipment(delivered.driver.id, delivered.shipmentId, {
      otp: delivered.otp,
      deliveredQty: 1,
    });
    await expect(
      declineDriverJob(delivered.driver.id, delivered.shipmentId, "Too late"),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("increments OTP attempts and fails the delivery after three wrong codes", async () => {
    const { driver, shipmentId, otp } = await setup(1, 1);
    const bad = wrong(otp);

    await expect(deliverDriverShipment(driver.id, shipmentId, { otp: bad })).rejects.toMatchObject({
      status: 422,
      code: "otp_invalid",
      message: "Incorrect OTP. 2 tries left.",
    });
    expect((await prisma!.shipment.findUniqueOrThrow({ where: { id: shipmentId } })).otpTries).toBe(1);

    await expect(deliverDriverShipment(driver.id, shipmentId, { otp: bad })).rejects.toMatchObject({ status: 422 });
    await expect(deliverDriverShipment(driver.id, shipmentId, { otp: bad })).rejects.toMatchObject({ status: 422 });

    const failed = await prisma!.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(failed.status).toBe("failed");
    expect(failed.otpTries).toBe(3);
    expect(failed.deliveredAt).toBeNull();
    const issue = await prisma!.shipmentIssue.findUnique({ where: { shipmentId } });
    expect(issue?.type).toBe("failed_attempt");

    await expect(deliverDriverShipment(driver.id, shipmentId, { otp })).rejects.toMatchObject({ status: 409 });
  });

  it("delivers with the correct OTP and advances the order stage", async () => {
    const { driver, shipmentId, otp, order } = await setup(1, 1);
    const delivered = await deliverDriverShipment(driver.id, shipmentId, { otp, deliveredQty: 1 });
    expect(delivered.status).toBe("review");
    expect(delivered.deliveredAt).not.toBeNull();
    expect(delivered.deliveredQty).toBe(1);
    expect(delivered.events.at(-1)?.message).toContain("with customer OTP");

    const orderRow = await prisma!.order.findUniqueOrThrow({ where: { code: order.code } });
    expect(orderRow.stage).toBe("delivered");
    await expect(deliverDriverShipment(driver.id, shipmentId, { otp })).rejects.toMatchObject({ status: 409 });
  });

  it("opens a short-quantity dispute instead of releasing escrow", async () => {
    const { driver, shipmentId, otp, order } = await setup(2, 0);
    const disputed = await deliverDriverShipment(driver.id, shipmentId, { otp, deliveredQty: 1 });
    expect(disputed.status).toBe("disputed");
    expect(disputed.deliveredQty).toBe(1);
    expect(disputed.issue).toMatchObject({ type: "Short quantity", claim: "100.00" });

    const orderRow = await prisma!.order.findUniqueOrThrow({ where: { code: order.code } });
    expect(orderRow.stage).toBe("delivered");
    const released = await prisma!.escrowEntry.count({
      where: { orderId: orderRow.id, type: { in: ["released", "refund"] } },
    });
    expect(released).toBe(0);
    // Delivery (even a disputed one) does not confirm cash collection.
    const collection = await prisma!.codCollection.findUnique({ where: { shipmentId } });
    expect(collection?.status).toBe("pending");
  });

  it("reports an issue without marking the shipment delivered", async () => {
    const { driver, shipmentId } = await setup(1, 1);
    const failed = await reportDriverIssue(driver.id, shipmentId, {
      type: "failed_attempt",
      note: "Customer not reachable at the gate",
    });
    expect(failed.status).toBe("failed");
    expect(failed.deliveredAt).toBeNull();
    expect(failed.issue).toMatchObject({ type: "Failed attempt" });
    await expect(deliverDriverShipment(driver.id, shipmentId, { otp: "1234" })).rejects.toMatchObject({ status: 409 });
  });

  it("cannot deliver twice under concurrent submissions", async () => {
    const { driver, shipmentId, otp } = await setup(1, 1);
    const results = await Promise.allSettled([
      deliverDriverShipment(driver.id, shipmentId, { otp }),
      deliverDriverShipment(driver.id, shipmentId, { otp }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const row = await prisma!.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(row.status).toBe("review");
  });
});
