import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { getSellerProfile, updateSellerProfile, updateSellerProfileSchema } from "./profile";

const hasDb = Boolean(process.env.DATABASE_URL);
const prisma = hasDb ? new PrismaClient() : null;
const created = { users: [] as string[], sellers: [] as string[] };

async function makeSeller() {
  if (!prisma) throw new Error("DATABASE_URL is required");
  const user = await prisma.user.create({
    data: {
      email: `profile-test-${randomUUID()}@example.test`,
      passwordHash: await bcrypt.hash("SellerTest9!", 4),
      role: "seller",
      name: "Profile Test Seller",
    },
  });
  created.users.push(user.id);
  const seller = await prisma.seller.create({
    data: {
      code: `profile-${randomUUID()}`,
      ownerUserId: user.id,
      storeName: "Original Store",
      gstin: `29${randomUUID().replace(/-/g, "").slice(0, 13).toUpperCase()}`,
      phone: "9800000000",
      city: "Bengaluru",
      pickupAddress: "Original pickup address",
      bankRef: "Test bank",
      kycGst: "verified",
      kycPan: "pending",
      kycCheque: "pending",
      vacationMode: false,
      freeAbove: 5000,
      fee: 199,
      slotsPerDay: [3],
    },
  });
  created.sellers.push(seller.id);
  return seller;
}

async function cleanup() {
  if (!prisma) return;
  await prisma.seller.deleteMany({ where: { id: { in: created.sellers } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: created.users } } }).catch(() => {});
}

describe.skipIf(!hasDb)("seller profile service", () => {
  afterAll(async () => {
    await cleanup();
    if (prisma) await prisma.$disconnect();
  });

  it("reads and persists real profile fields, scoped by sellerId", async () => {
    const seller = await makeSeller();
    const other = await makeSeller();

    const initial = await getSellerProfile(seller.id);
    expect(initial.storeName).toBe("Original Store");
    expect(initial.kyc.gst).toBe("verified");
    expect(initial.kyc.pan).toBe("pending");
    expect(initial.vacationMode).toBe(false);

    const updated = await updateSellerProfile(seller.id, {
      storeName: "Renamed Store",
      pickupAddress: "New pickup address",
      vacationMode: true,
    });
    expect(updated.storeName).toBe("Renamed Store");
    expect(updated.pickupAddress).toBe("New pickup address");
    expect(updated.vacationMode).toBe(true);
    expect(updated.phone).toBe("9800000000"); // untouched field unchanged

    const reread = await getSellerProfile(seller.id);
    expect(reread.storeName).toBe("Renamed Store");
    expect(reread.vacationMode).toBe(true);

    // the other seller's row must be untouched
    const otherProfile = await getSellerProfile(other.id);
    expect(otherProfile.storeName).toBe("Original Store");
    expect(otherProfile.vacationMode).toBe(false);
  });

  it("rejects an invalid GSTIN at the validation boundary", () => {
    expect(updateSellerProfileSchema.safeParse({ gstin: "not-a-gstin" }).success).toBe(false);
    expect(updateSellerProfileSchema.safeParse({ phone: "12345" }).success).toBe(false);
    expect(updateSellerProfileSchema.safeParse({ storeName: "ab" }).success).toBe(false);
    expect(updateSellerProfileSchema.safeParse({ gstin: "29ABCDE1234F1Z5" }).success).toBe(true);
  });

  it("rejects a duplicate GSTIN at the database layer", async () => {
    const seller = await makeSeller();
    const other = await makeSeller();

    await expect(updateSellerProfile(seller.id, { gstin: other.gstin })).rejects.toMatchObject({
      status: 409,
      code: "gstin_in_use",
    });
  });
});
