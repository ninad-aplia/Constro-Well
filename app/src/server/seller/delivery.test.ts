import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
import { addServiceArea, getSellerDeliverySettings, removeServiceArea, updateDeliveryRules } from "./delivery";

const hasDb = Boolean(process.env.DATABASE_URL);
const prisma = hasDb ? new PrismaClient() : null;
const created = { users: [] as string[], sellers: [] as string[] };

async function makeSeller() {
  if (!prisma) throw new Error("DATABASE_URL is required");
  const user = await prisma.user.create({
    data: {
      email: `delivery-test-${randomUUID()}@example.test`,
      passwordHash: await bcrypt.hash("SellerTest9!", 4),
      role: "seller",
      name: "Delivery Test Seller",
    },
  });
  created.users.push(user.id);
  const seller = await prisma.seller.create({
    data: {
      code: `delivery-${randomUUID()}`,
      ownerUserId: user.id,
      storeName: "Delivery Test Store",
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
      slotsPerDay: [1, 2, 3],
    },
  });
  created.sellers.push(seller.id);
  return seller;
}

async function cleanup() {
  if (!prisma) return;
  await prisma.sellerPincode.deleteMany({ where: { sellerId: { in: created.sellers } } }).catch(() => {});
  await prisma.seller.deleteMany({ where: { id: { in: created.sellers } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: created.users } } }).catch(() => {});
}

describe.skipIf(!hasDb)("seller delivery settings service", () => {
  afterAll(async () => {
    await cleanup();
    if (prisma) await prisma.$disconnect();
  });

  it("reads real delivery rules, adds/removes service areas, and scopes everything by seller", async () => {
    const seller = await makeSeller();
    const other = await makeSeller();
    await prisma!.sellerPincode.create({ data: { sellerId: seller.id, pin: "560001" } });

    const initial = await getSellerDeliverySettings(seller.id);
    expect(initial.rules.freeAbove).toBe("5000.00");
    expect(initial.serviceAreas).toEqual(["560001"]);

    const afterAdd = await addServiceArea(seller.id, "600002");
    expect(afterAdd.serviceAreas.sort()).toEqual(["560001", "600002"]);

    await expect(addServiceArea(seller.id, "560001")).rejects.toMatchObject({ status: 409, code: "pincode_exists" });

    const afterRemove = await removeServiceArea(seller.id, "560001");
    expect(afterRemove.serviceAreas).toEqual(["600002"]);

    const updated = await updateDeliveryRules(seller.id, {
      freeAbove: new Prisma.Decimal("3000"),
      fee: new Prisma.Decimal("99"),
      slotsPerDay: [5, 5, 5],
    });
    expect(updated.rules.freeAbove).toBe("3000.00");
    expect(updated.rules.fee).toBe("99.00");
    expect(updated.rules.slotsPerDay).toEqual([5, 5, 5]);

    // Untouched for the other seller.
    const otherSettings = await getSellerDeliverySettings(other.id);
    expect(otherSettings.serviceAreas).toEqual([]);
    expect(otherSettings.rules.freeAbove).toBe("5000.00");

    // Removing another seller's pincode by id-scoped deleteMany is a no-op, not a cross-seller mutation.
    const stillThere = await removeServiceArea(other.id, "600002");
    expect(stillThere.serviceAreas).toEqual([]);
    const sellerUnaffected = await getSellerDeliverySettings(seller.id);
    expect(sellerUnaffected.serviceAreas).toEqual(["600002"]);
  });
});
