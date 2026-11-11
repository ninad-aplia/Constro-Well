import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { getProductById, listCategories, listProductOffers, listProducts } from "./service";

const hasDb = Boolean(process.env.DATABASE_URL);
const prisma = hasDb ? new PrismaClient() : null;

async function withRollback(fn: (tx: Prisma.TransactionClient) => Promise<void>) {
  if (!prisma) throw new Error("DATABASE_URL is required");
  const marker = new Error("__CATALOG_TEST_ROLLBACK__");
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw marker;
    }, { timeout: 20_000 });
  } catch (error) {
    if (error !== marker) throw error;
  }
}

describe.skipIf(!hasDb)("catalogue service", () => {
  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it("reads categories and paginates/filter-sorts products from PostgreSQL", async () => {
    const categories = await listCategories();
    expect(categories.length).toBe(13);
    expect(categories.find((c) => c.name === "Cement")?.productCount).toBeGreaterThan(0);
    expect(categories.every((c) => typeof c.slug === "string" && c.slug.length > 0)).toBe(true);

    const result = await listProducts({
      q: "cement",
      category: "Cement",
      sort: "price_asc",
      page: 1,
      pageSize: 2,
    });
    expect(result.products.length).toBe(2);
    expect(result.pagination.total).toBeGreaterThan(2);
    expect(result.products.every((p) => p.category === "Cement")).toBe(true);
    expect(result.products.every((p) => /^\d+\.\d{2}$/.test(p.price))).toBe(true);
    const prices = result.products.map((p) => Number(p.price));
    expect(prices[0]).toBeLessThanOrEqual(prices[1]);

    const page2 = await listProducts({
      q: "cement",
      category: "Cement",
      sort: "price_asc",
      page: 2,
      pageSize: 2,
    });
    expect(page2.products[0]?.code).not.toBe(result.products[0]?.code);
  });

  it("returns product detail and offers without private seller fields", async () => {
    const detail = await getProductById("0");
    expect(detail.code).toBe("0");
    expect(detail.available).toBe(true);
    expect(detail.offers.length).toBeGreaterThan(0);
    const offer = detail.offers[0];
    expect(offer.price).toMatch(/^\d+\.\d{2}$/);
    expect(offer.sellerName.length).toBeGreaterThan(0);
    expect(offer).not.toHaveProperty("phone");
    expect(offer).not.toHaveProperty("gstin");
    expect(offer).not.toHaveProperty("ownerUserId");
    expect(Array.isArray(offer.serviceablePincodes)).toBe(true);
    // The card CTA targets the cheapest purchasable offer serialized here.
    expect(detail.offerId).toBe(offer.id);
    expect(detail.minOrderQty).toBe(offer.minOrderQty);
    expect(detail.stock).toBe(offer.stock);
    expect(detail.purchasable).toBe(detail.available);

    const offers = await listProductOffers("0");
    expect(offers.offers.length).toBe(detail.offers.length);
  });

  it("returns 404 for an unknown product", async () => {
    await expect(getProductById("does-not-exist")).rejects.toMatchObject({
      status: 404,
      code: "product_not_found",
    });
  });

  it("filters out paused offers and aggregates multi-seller active offers", async () => {
    await withRollback(async (tx) => {
      const category = await tx.category.findFirst();
      const sellerA = await tx.seller.findFirst({ orderBy: { code: "asc" } });
      const sellerB = await tx.seller.findFirst({ where: { id: { not: sellerA!.id } } });
      expect(category).not.toBeNull();
      expect(sellerA).not.toBeNull();
      expect(sellerB).not.toBeNull();

      const product = await tx.product.create({
        data: {
          code: `test-active-${randomUUID()}`,
          categoryId: category!.id,
          name: `Active Test Product ${randomUUID()}`,
          brand: "TestBrand",
          unit: "unit",
          mrp: new Prisma.Decimal("200.00"),
          unitWeightKg: 1,
          bulkFlag: false,
          specs: ["test spec"],
        },
      });
      await tx.sellerOffer.create({
        data: {
          code: `${sellerA!.code}:${product.code}`,
          sellerId: sellerA!.id,
          productId: product.id,
          price: new Prisma.Decimal("123.45"),
          stock: 5,
          minOrderQty: 1,
          status: "active",
          leadTimeDays: 2,
        },
      });
      await tx.sellerOffer.create({
        data: {
          code: `${sellerB!.code}:${product.code}`,
          sellerId: sellerB!.id,
          productId: product.id,
          price: new Prisma.Decimal("150.00"),
          stock: 3,
          minOrderQty: 1,
          status: "active",
          leadTimeDays: 4,
        },
      });

      const detail = await getProductById(product.code, tx);
      expect(detail.offers).toHaveLength(2);
      expect(detail.price).toBe("123.45");
      expect(detail.offers.map((o) => o.sellerName).sort()).toEqual(
        [sellerA!.storeName, sellerB!.storeName].sort(),
      );

      const paused = await tx.product.create({
        data: {
          code: `test-paused-${randomUUID()}`,
          categoryId: category!.id,
          name: `Paused Test Product ${randomUUID()}`,
          unit: "unit",
          mrp: new Prisma.Decimal("100.00"),
          unitWeightKg: 1,
        },
      });
      await tx.sellerOffer.create({
        data: {
          code: `${sellerA!.code}:${paused.code}`,
          sellerId: sellerA!.id,
          productId: paused.id,
          price: new Prisma.Decimal("99.00"),
          stock: 10,
          minOrderQty: 1,
          status: "paused",
        },
      });
      const pausedDetail = await getProductById(paused.code, tx);
      expect(pausedDetail.available).toBe(false);
      expect(pausedDetail.offers).toHaveLength(0);

      const found = await listProducts(
        { q: product.name, sort: "relevance", page: 1, pageSize: 10 },
        tx,
      );
      expect(found.products.map((p) => p.code)).toContain(product.code);
      const hidden = await listProducts(
        { q: paused.name, sort: "relevance", page: 1, pageSize: 10 },
        tx,
      );
      expect(hidden.products.map((p) => p.code)).not.toContain(paused.code);
    });
  });
});
