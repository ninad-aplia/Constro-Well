// Isolated finance fixtures for the Playwright flows.
//
// The browser tests must exercise real authenticated requests without touching
// real business records, so each run creates its own seller/customer/admin,
// one pending COD collection per seller, and a session for each role. Everything
// is deleted afterwards, including the audit rows the flows produce.
import { randomBytes, randomUUID, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, "..", ".env");
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const value = match[2].replace(/^"(.*)"$/, "$1");
    process.env[match[1]] = value;
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return process.env.DATABASE_URL;
}

export interface FinanceFixture {
  storeName: string;
  otherStoreName: string;
  adminUserId: string;
  sellerUserId: string;
  sellerId: string;
  customerId: string;
  shipmentId: string;
  otherShipmentId: string;
  expectedAmount: string;
  adminToken: string;
  sellerToken: string;
  customerToken: string;
  cleanup(): Promise<void>;
}

const BCRYPT_PLACEHOLDER = "$2b$12$wi1PjdyJ.pppWbuSsIPbAOyHx8bDqskMqrBAscIpXTziE36.k1qAq";

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

export async function seedFinanceFixture(): Promise<FinanceFixture> {
  const prisma = new PrismaClient({ datasourceUrl: loadDatabaseUrl() });
  const suffix = randomUUID().slice(0, 8);
  const storeName = `PW Finance ${suffix}`;
  const otherStoreName = `PW Other ${suffix}`;

  const adminUserId = newId("pwadmin");
  const sellerUserId = newId("pwseller");
  const otherSellerUserId = newId("pwother");
  const customerId = newId("pwcustomer");
  const sellerId = newId("pwsellerrow");
  const otherSellerId = newId("pwotherrow");
  const customerOrderId = newId("pworder");
  const otherOrderId = newId("pworder");
  const shipmentId = newId("pwship");
  const otherShipmentId = newId("pwship");
  const expectedAmount = "4321.00";
  const otherAmount = "999.00";

  const adminSession = newToken();
  const sellerSession = newToken();
  const customerSession = newToken();

  try {
    for (const [id, role, name] of [
      [adminUserId, "admin", "PW Admin"],
      [sellerUserId, "seller", "PW Seller"],
      [otherSellerUserId, "seller", "PW Other Seller"],
      [customerId, "customer", "PW Customer"],
    ] as const) {
      await prisma.$executeRaw`
        INSERT INTO "User" (id, email, "passwordHash", role, name, "createdAt", "updatedAt")
        VALUES (${id}, ${`${id}@pw-finance.test`}, ${BCRYPT_PLACEHOLDER}, CAST(${role} AS "Role"), ${name}, now(), now())
      `;
    }

    for (const [id, owner, store] of [
      [sellerId, sellerUserId, storeName],
      [otherSellerId, otherSellerUserId, otherStoreName],
    ] as const) {
      await prisma.$executeRaw`
        INSERT INTO "Seller" (id, code, "ownerUserId", "storeName", gstin, phone, city,
          "pickupAddress", "bankRef", "kycGst", "kycPan", "kycCheque", "vacationMode", "freeAbove", fee, "createdAt", "updatedAt")
        VALUES (${id}, ${`pw-${id.slice(-8)}`}, ${owner}, ${store}, ${`PWG${id.slice(-8).toUpperCase()}`}, '9000000000', 'Pune',
          'Pickup', 'BANK-REF', CAST('verified' AS "KycStatus"), CAST('pending' AS "KycStatus"),
          CAST('pending' AS "KycStatus"), false, 0, 0, now(), now())
      `;
    }

    for (const [orderId, shipment] of [
      [customerOrderId, shipmentId],
      [otherOrderId, otherShipmentId],
    ] as const) {
      await prisma.$executeRaw`
        INSERT INTO "Order" (id, code, "userId", "itemValue", "deliveryFee", "grossTotal", stage, cancelled,
          "addressSnapshot", "financeModel", "createdAt", "updatedAt")
        VALUES (${orderId}, ${`PWBG-${orderId.slice(-6).toUpperCase()}`}, ${customerId}, 100, 0, 100,
          CAST('ordered' AS "OrderStage"), false, '{"name":"PW Customer"}'::jsonb,
          CAST('seller_collected' AS "FinanceModel"), now(), now())
      `;
      await prisma.$executeRaw`
        INSERT INTO "Shipment" (id, code, "orderId", "sellerId", status)
        VALUES (${shipment}, ${`PWSH-${shipment.slice(-6).toUpperCase()}`}, ${orderId},
          ${shipment === shipmentId ? sellerId : otherSellerId}, CAST('review' AS "ShipmentStatus"))
      `;
    }

    for (const [shipment, seller, amount] of [
      [shipmentId, sellerId, expectedAmount],
      [otherShipmentId, otherSellerId, otherAmount],
    ] as const) {
      await prisma.$executeRaw`
        INSERT INTO "CodCollection" (id, "shipmentId", "sellerId", "expectedAmount", status, "createdAt", "updatedAt")
        VALUES (${newId("pwcol")}, ${shipment}, ${seller}, ${amount}::numeric, CAST('pending' AS "CodCollectionStatus"), now(), now())
      `;
    }

    for (const [userId, session] of [
      [adminUserId, adminSession],
      [sellerUserId, sellerSession],
      [customerId, customerSession],
    ] as const) {
      await prisma.$executeRaw`
        INSERT INTO "Session" (id, "userId", "tokenHash", "expiresAt", "createdAt")
        VALUES (${newId("pwsess")}, ${userId}, ${session.hash}, now() + interval '1 hour', now())
      `;
    }
  } finally {
    await prisma.$disconnect();
  }

  const cleanup = async () => {
    const prismaCleanup = new PrismaClient({ datasourceUrl: loadDatabaseUrl() });
    try {
      const sellerIds = [sellerId, otherSellerId];
      const shipments = await prismaCleanup.shipment.findMany({
        where: { sellerId: { in: sellerIds } },
        select: { id: true, orderId: true },
      });
      const shipmentIds = shipments.map((s) => s.id);
      const orderIds = shipments.map((s) => s.orderId);
      await prismaCleanup.codCollection.deleteMany({ where: { sellerId: { in: sellerIds } } });
      await prismaCleanup.shipmentEvent.deleteMany({ where: { shipmentId: { in: shipmentIds } } });
      await prismaCleanup.shipment.deleteMany({ where: { id: { in: shipmentIds } } });
      await prismaCleanup.order.deleteMany({ where: { id: { in: orderIds } } });
      await prismaCleanup.seller.deleteMany({ where: { id: { in: sellerIds } } });
      await prismaCleanup.session.deleteMany({
        where: { userId: { in: [adminUserId, sellerUserId, otherSellerUserId, customerId] } },
      });

      // Audit rows are append-only by trigger; disabling it is scoped to this
      // cleanup and re-enabled immediately.
      await prismaCleanup.$executeRawUnsafe('ALTER TABLE "AuditEvent" DISABLE TRIGGER "AuditEvent_append_only"');
      await prismaCleanup.$executeRawUnsafe('ALTER TABLE "AuditEvent" DISABLE TRIGGER "AuditEvent_no_truncate"');
      await prismaCleanup.$executeRaw`
        DELETE FROM "AuditEvent" WHERE "actorUserId" IN (${adminUserId}, ${sellerUserId}, ${customerId})
      `;
      await prismaCleanup.$executeRawUnsafe('ALTER TABLE "AuditEvent" ENABLE TRIGGER "AuditEvent_append_only"');
      await prismaCleanup.$executeRawUnsafe('ALTER TABLE "AuditEvent" ENABLE TRIGGER "AuditEvent_no_truncate"');

      await prismaCleanup.user.deleteMany({
        where: { id: { in: [adminUserId, sellerUserId, otherSellerUserId, customerId] } },
      });
    } finally {
      await prismaCleanup.$disconnect();
    }
  };

  return {
    storeName,
    otherStoreName,
    adminUserId,
    sellerUserId,
    sellerId,
    customerId,
    shipmentId,
    otherShipmentId,
    expectedAmount,
    adminToken: adminSession.token,
    sellerToken: sellerSession.token,
    customerToken: customerSession.token,
    cleanup,
  };
}
