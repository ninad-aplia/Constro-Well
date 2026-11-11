import { afterAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  addCartItem,
  applyCoupon,
  getCart,
  removeCartItem,
  updateCartItem,
} from "./service";

const hasDb = Boolean(process.env.DATABASE_URL);
const prisma = hasDb ? new PrismaClient() : null;

async function withCustomer(fn: (userId: string) => Promise<void>) {
  if (!prisma) throw new Error("DATABASE_URL is required");
  const user = await prisma.user.create({
    data: {
      email: `cart-service-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
      passwordHash: "not-used",
      role: "customer",
      name: "Cart Service Test",
    },
  });
  try {
    await fn(user.id);
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
}

async function offers() {
  if (!prisma) throw new Error("DATABASE_URL is required");
  const rows = await prisma.sellerOffer.findMany({
    where: {
      status: "active",
      stock: { gte: 1 },
      seller: { vacationMode: false },
    },
    include: { seller: { select: { id: true } } },
    take: 100,
  });
  const usable = rows
    .filter((offer) => offer.stock >= offer.minOrderQty)
    .sort((a, b) => b.price.comparedTo(a.price));
  const first = usable[0];
  const second = usable.find((offer) => offer.sellerId !== first.sellerId);
  if (!first || !second) throw new Error("Not enough seeded offers for the cart test");
  return { first, second };
}

describe.skipIf(!hasDb)("cart service against PostgreSQL", () => {
  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it("persists a multi-seller cart, merges duplicates, updates, saves and removes", async () => {
    const { first, second } = await offers();
    await withCustomer(async (userId) => {
      expect((await getCart(userId)).items).toHaveLength(0);

      await addCartItem(userId, first.id, first.minOrderQty);
      await addCartItem(userId, first.id, 1);
      let cart = await addCartItem(userId, second.id, second.minOrderQty);
      expect(cart.groups).toHaveLength(2);
      expect(cart.items.filter((item) => item.offerId === first.id)).toHaveLength(1);
      expect(cart.items.find((item) => item.offerId === first.id)?.qty).toBe(first.minOrderQty + 1);

      const item = cart.items.find((candidate) => candidate.offerId === first.id)!;
      cart = await updateCartItem(userId, item.id, { qty: item.minOrderQty });
      expect(cart.items.find((candidate) => candidate.id === item.id)?.qty).toBe(item.minOrderQty);

      cart = await updateCartItem(userId, item.id, { savedForLater: true });
      expect(cart.savedItems.some((candidate) => candidate.id === item.id)).toBe(true);
      cart = await updateCartItem(userId, item.id, { savedForLater: false });
      expect(cart.items.some((candidate) => candidate.id === item.id)).toBe(true);

      cart = await removeCartItem(userId, item.id);
      expect(cart.items.some((candidate) => candidate.id === item.id)).toBe(false);
      expect(cart.items.length).toBeGreaterThan(0);
    });
  });

  it("rejects another customer's item and applies coupons from the server", async () => {
    const { first, second } = await offers();
    await withCustomer(async (ownerId) => {
      await withCustomer(async (otherId) => {
        const qty = Math.min(
          first.stock,
          Math.max(first.minOrderQty, Math.ceil(2100 / Number(first.price))),
        );
        let cart = await addCartItem(ownerId, first.id, qty);
        if (Number(cart.totals.subtotal) < 2000) {
          cart = await addCartItem(ownerId, second.id, second.minOrderQty);
        }
        const item = cart.items[0];
        await expect(updateCartItem(otherId, item.id, { qty: item.minOrderQty })).rejects.toMatchObject({
          status: 404,
        });
        await expect(removeCartItem(otherId, item.id)).rejects.toMatchObject({ status: 404 });
      });

      const couponCart = await applyCoupon(ownerId, "BUILD10");
      expect(couponCart.coupon?.code).toBe("BUILD10");
      expect(Number(couponCart.totals.discount)).toBeGreaterThan(0);

      const firstOrder = await applyCoupon(ownerId, "FIRST250");
      expect(firstOrder.totals.discount).toBe("250.00");

      const free = await applyCoupon(ownerId, "FREESHIP");
      expect(free.totals.deliveryFee).toBe("0.00");

      await expect(applyCoupon(ownerId, "NOT-A-CODE")).rejects.toMatchObject({ status: 422 });
    });
  });

  it("serializes concurrent adds so cart quantity cannot exceed stock", async () => {
    const { first } = await offers();
    await withCustomer(async (userId) => {
      const qty = Math.floor(first.stock / 2) + 1;
      const results = await Promise.allSettled([
        addCartItem(userId, first.id, qty),
        addCartItem(userId, first.id, qty),
      ]);
      const fulfilled = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result) => result.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ status: 409 });

      const cart = await getCart(userId);
      expect(cart.items[0].qty).toBeLessThanOrEqual(first.stock);
    });
  });

  it("applies a per-offer custom bulk tier and keeps the offer defaults when cleared", async () => {
    const { first } = await offers();
    const threshold = Math.max(2, first.minOrderQty);
    const original = first.bulkTiers as Prisma.InputJsonValue;
    try {
      await prisma!.sellerOffer.update({
        where: { id: first.id },
        data: { bulkTiers: [[threshold, 25]] },
      });

      await withCustomer(async (userId) => {
        const cart = await addCartItem(userId, first.id, threshold);
        const item = cart.items.find((candidate) => candidate.offerId === first.id)!;
        const expected = (Math.round(Number(first.price) * 75) / 100).toFixed(2);
        expect(item.unitPrice).toBe(expected);
        expect(item.bulk).toBe(true);
      });
    } finally {
      await prisma!.sellerOffer.update({ where: { id: first.id }, data: { bulkTiers: original } });
    }
  });
});
