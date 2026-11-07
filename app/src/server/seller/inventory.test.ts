import { afterAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  createSellerProduct,
  listSellerProducts,
  updateSellerProduct,
  updateSellerStock,
} from "./inventory";

const hasDb = Boolean(process.env.DATABASE_URL);
const prisma = hasDb ? new PrismaClient() : null;

async function withRollback(fn: (tx: Prisma.TransactionClient) => Promise<void>) {
  if (!prisma) throw new Error("DATABASE_URL is required");
  const marker = new Error("__INVENTORY_TEST_ROLLBACK__");
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw marker;
    }, { timeout: 20_000 });
  } catch (error) {
    if (error !== marker) throw error;
  }
}

describe.skipIf(!hasDb)("seller inventory service", () => {
  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it("lists only the authenticated seller's offers", async () => {
    const seller = await prisma!.seller.findFirst({
      where: { offers: { some: {} } },
      orderBy: { code: "asc" },
    });
    expect(seller).not.toBeNull();
    const products = await listSellerProducts(seller!.id);
    expect(products.length).toBeGreaterThan(0);
    const rows = await prisma!.sellerOffer.findMany({
      where: { sellerId: seller!.id },
      select: { id: true },
    });
    expect(products.map((p) => p.offerId).sort()).toEqual(rows.map((r) => r.id).sort());
    expect(products.every((p) => p.price.match(/^\d+\.\d{2}$/))).toBe(true);
  });

  it("creates, updates, pauses and rejects stock transitions without touching other sellers", async () => {
    await withRollback(async (tx) => {
      const seller = await tx.seller.findFirst({
        where: { offers: { some: {} } },
        orderBy: { code: "asc" },
      });
      const otherSeller = await tx.seller.findFirst({
        where: { id: { not: seller!.id } },
      });
      const product = await tx.product.findFirst({
        where: { offers: { none: { sellerId: seller!.id } } },
      });
      const otherOffer = await tx.sellerOffer.findFirst({
        where: { sellerId: otherSeller!.id },
      });
      expect(seller).not.toBeNull();
      expect(otherSeller).not.toBeNull();
      expect(product).not.toBeNull();
      expect(otherOffer).not.toBeNull();

      const created = await createSellerProduct(
        seller!,
        {
          productId: product!.id,
          price: new Prisma.Decimal("777.00"),
          stock: 3,
          minOrderQty: 1,
          reorderLevel: 0,
          leadTimeDays: 2,
        },
        tx,
      );
      expect(created.price).toBe("777.00");
      expect(created.status).toBe("active");
      expect(created.name).toBe(product!.name);

      const listed = await listSellerProducts(seller!.id, tx);
      expect(listed.map((p) => p.offerId)).toContain(created.offerId);
      expect(listed.every((p) => p.offerId !== otherOffer!.id)).toBe(true);

      const paused = await updateSellerStock(seller!.id, created.offerId, 0, tx);
      expect(paused.stock).toBe(0);
      expect(paused.status).toBe("paused");

      const reactivated = await updateSellerProduct(
        seller!.id,
        created.offerId,
        { stock: 5, status: "active" },
        tx,
      );
      expect(reactivated.stock).toBe(5);
      expect(reactivated.status).toBe("active");

      await expect(
        updateSellerProduct(
          seller!.id,
          created.offerId,
          { stock: 0, status: "active" },
          tx,
        ),
      ).rejects.toMatchObject({ status: 400, code: "out_of_stock" });

      await expect(
        updateSellerProduct(seller!.id, otherOffer!.id, { price: new Prisma.Decimal("1.00") }, tx),
      ).rejects.toMatchObject({ status: 404, code: "offer_not_found" });

      await expect(
        updateSellerStock(seller!.id, otherOffer!.id, 999, tx),
      ).rejects.toMatchObject({ status: 404, code: "offer_not_found" });

      await expect(
        createSellerProduct(
          seller!,
          {
            productId: product!.id,
            price: new Prisma.Decimal("10.00"),
            stock: 1,
            minOrderQty: 1,
            reorderLevel: 0,
            leadTimeDays: 1,
          },
          tx,
        ),
      ).rejects.toMatchObject({ status: 409, code: "offer_exists" });

      await expect(
        createSellerProduct(
          seller!,
          {
            productId: "missing-product",
            price: new Prisma.Decimal("10.00"),
            stock: 1,
            minOrderQty: 1,
            reorderLevel: 0,
            leadTimeDays: 1,
          },
          tx,
        ),
      ).rejects.toMatchObject({ status: 404, code: "product_not_found" });
    });
  });
});
