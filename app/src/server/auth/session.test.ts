import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
import { ApiError } from "@/server/http";
import {
  assertRole,
  authenticateUser,
  createSession,
  deleteSessionByToken,
  generateSessionToken,
  getSessionUserByToken,
  hashToken,
  isSessionActive,
  registerCustomer,
  requireDriverForUser,
  requireSellerForUser,
  resolveDriverForUser,
  resolveSellerForUser,
  toPublicUser,
} from "./session";

describe("session primitives", () => {
  it("generates an opaque token and stores only its SHA-256 digest", () => {
    const token = generateSessionToken();
    const digest = hashToken(token);
    expect(token.length).toBeGreaterThan(30);
    expect(digest).toHaveLength(64);
    expect(digest).not.toBe(token);
    expect(hashToken(token)).toBe(digest);
  });

  it("treats only future expiries as active", () => {
    expect(isSessionActive(new Date(Date.now() + 60_000))).toBe(true);
    expect(isSessionActive(new Date(Date.now() - 60_000))).toBe(false);
  });

  it("returns only public user fields", () => {
    const fake = {
      id: "user_1",
      email: "a@example.test",
      name: "Test",
      phone: null,
      role: "customer" as const,
      passwordHash: "should-not-leak",
    };
    const publicUser = toPublicUser(fake);
    expect(publicUser).toEqual({
      id: "user_1",
      email: "a@example.test",
      name: "Test",
      phone: null,
      role: "customer",
    });
    expect(publicUser).not.toHaveProperty("passwordHash");
  });

  it("enforces role restrictions", () => {
    const customer = { role: "customer" as const };
    expect(() => assertRole(customer, ["customer"])).not.toThrow();
    expect(() => assertRole(customer, ["admin"])).toThrow(ApiError);
    try {
      assertRole(customer, ["admin"]);
    } catch (error) {
      expect(error).toMatchObject({ status: 403 });
    }
  });
});

const hasDb = Boolean(process.env.DATABASE_URL);
const prisma = hasDb ? new PrismaClient() : null;

async function withRollback(
  fn: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<void> {
  if (!prisma) throw new Error("DATABASE_URL is required for this test");
  const marker = new Error("__AUTH_TEST_ROLLBACK__");
  try {
    await prisma.$transaction(
      async (tx) => {
        await fn(tx);
        throw marker;
      },
      { timeout: 20_000 },
    );
  } catch (error) {
    if (error !== marker) throw error;
  }
}

describe.skipIf(!hasDb)("auth against PostgreSQL", () => {
  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it("registers a customer, logs in, validates sessions, logs out and expires safely", async () => {
    await withRollback(async (tx) => {
      const email = `auth-${randomUUID()}@example.test`;
      const password = "CorrectHorse9";
      const { user, token } = await registerCustomer(
        { name: "Test Customer", email, password },
        tx,
      );

      expect(user.role).toBe("customer");
      expect(user).not.toHaveProperty("passwordHash");

      const row = await tx.user.findUnique({ where: { email } });
      expect(row).not.toBeNull();
      expect(row?.passwordHash).not.toBe(password);

      const session = await tx.session.findUnique({
        where: { tokenHash: hashToken(token) },
      });
      expect(session).not.toBeNull();
      expect(session?.tokenHash).not.toBe(token);
      expect((await getSessionUserByToken(token, tx))?.id).toBe(row?.id);

      expect(await authenticateUser(email, "wrong-password", tx)).toBeNull();
      expect((await authenticateUser(email, password, tx))?.id).toBe(row?.id);

      await deleteSessionByToken(token, tx);
      expect(await getSessionUserByToken(token, tx)).toBeNull();

      const second = await createSession(row!.id, tx);
      await tx.session.update({
        where: { tokenHash: hashToken(second.token) },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
      expect(await getSessionUserByToken(second.token, tx)).toBeNull();
    });
  }, 20_000);

  it("authenticates every role and resolves real seller/driver relationships", async () => {
    await withRollback(async (tx) => {
      const password = "CorrectHorse9";
      const passwordHash = await bcrypt.hash(password, 4);

      for (const role of ["customer", "seller", "driver", "admin"] as const) {
        const email = `role-${role}-${randomUUID()}@example.test`;
        await tx.user.create({
          data: { email, passwordHash, role, name: `Test ${role}` },
        });
        const authenticated = await authenticateUser(email, password, tx);
        expect(authenticated?.role).toBe(role);
      }

      const sellerUser = await tx.user.create({
        data: {
          email: `seller-${randomUUID()}@example.test`,
          passwordHash,
          role: "seller",
          name: "Test Seller",
        },
      });
      const seller = await tx.seller.create({
        data: {
          code: `test-seller-${randomUUID()}`,
          ownerUserId: sellerUser.id,
          storeName: "Test Store",
          gstin: `29${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`,
          phone: "9800000000",
          city: "Bengaluru",
          pickupAddress: "Test pickup",
          bankRef: "Test bank",
          kycGst: "pending",
          kycPan: "pending",
          kycCheque: "pending",
          freeAbove: new Prisma.Decimal(5000),
          fee: new Prisma.Decimal(199),
          slotsPerDay: [3],
        },
      });

      expect((await resolveSellerForUser(sellerUser, tx))?.id).toBe(seller.id);
      await expect(requireSellerForUser(sellerUser, tx)).resolves.toMatchObject({
        id: seller.id,
      });

      const customerUser = await tx.user.create({
        data: {
          email: `customer-${randomUUID()}@example.test`,
          passwordHash,
          role: "customer",
          name: "Test Customer",
        },
      });
      expect(await resolveSellerForUser(customerUser, tx)).toBeNull();
      await expect(requireSellerForUser(customerUser, tx)).rejects.toMatchObject({
        status: 403,
      });

      const driverUser = await tx.user.create({
        data: {
          email: `driver-${randomUUID()}@example.test`,
          passwordHash,
          role: "driver",
          name: "Test Driver",
        },
      });
      const driver = await tx.driver.create({
        data: {
          sellerId: seller.id,
          code: `test-driver-${randomUUID()}`,
          name: "Test Driver",
          phone: "9800000001",
          userId: driverUser.id,
        },
      });

      expect((await resolveDriverForUser(driverUser, tx))?.id).toBe(driver.id);
      await expect(requireDriverForUser(driverUser, tx)).resolves.toMatchObject({
        id: driver.id,
      });
      await expect(requireDriverForUser(customerUser, tx)).rejects.toMatchObject({
        status: 403,
      });
    });
  });
});
