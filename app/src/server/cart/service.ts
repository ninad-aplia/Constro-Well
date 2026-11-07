// Persistent multi-seller cart service. Every read/write is scoped by the
// authenticated user; prices, stock, delivery and coupons are always recomputed
// from PostgreSQL. Stock is never decremented by cart operations.
import { Prisma, type PrismaClient } from "@prisma/client";
import { ART, HUE } from "@/data/catalog";
import type { Category } from "@/lib/shop/types";
import type {
  CartCouponDto,
  CartDto,
  CartGroupDto,
  CartItemDto,
} from "@/lib/api/cartDto";
import { db } from "@/server/db";
import { ApiError } from "@/server/http";
import {
  bulkPercent,
  deliveryFeeFor,
  evaluateCoupon,
  loadCoupon,
  money,
  taxFor,
  unitPrice,
} from "./pricing";

export const CART_COUPON_COOKIE = "cw_coupon";

const D = Prisma.Decimal;

export type CartReadClient = Pick<
  PrismaClient,
  "cart" | "cartItem" | "sellerOffer" | "coupon" | "order"
>;

const offerInclude = {
  product: { include: { category: { select: { name: true } } } },
  seller: {
    select: {
      storeName: true,
      city: true,
      vacationMode: true,
      freeAbove: true,
      fee: true,
    },
  },
} satisfies Prisma.SellerOfferInclude;

const cartInclude = {
  items: {
    include: { sellerOffer: { include: offerInclude } },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
type OfferWithRelations = Prisma.SellerOfferGetPayload<{ include: typeof offerInclude }>;

const ZERO = "0.00";

function categoryArt(category: string): { hue: string; art: string } {
  const key = (Object.prototype.hasOwnProperty.call(ART, category) ? category : "Cement") as Category;
  return { hue: HUE[key], art: ART[key] };
}

function emptyCart(couponMessage: string | null = null): CartDto {
  return {
    items: [],
    savedItems: [],
    groups: [],
    totals: {
      subtotal: ZERO,
      discount: ZERO,
      deliveryFee: ZERO,
      taxAmount: ZERO,
      total: ZERO,
      itemCount: 0,
      couponCode: null,
      couponMessage,
    },
    coupon: null,
    couponMessage,
  };
}

function itemIssue(offer: OfferWithRelations, qty: number): string | null {
  if (offer.status !== "active") return "This listing is paused";
  if (offer.seller.vacationMode) return "Seller is not accepting orders";
  if (qty < offer.minOrderQty) return `Minimum order is ${offer.minOrderQty}`;
  if (qty > offer.stock) return `Only ${offer.stock} left in stock`;
  return null;
}

function toItem(item: CartWithItems["items"][number]): CartItemDto {
  const offer = item.sellerOffer;
  const issue = itemIssue(offer, item.qty);
  const available = issue === null;
  const unit = unitPrice(offer.price, item.qty);
  const lineTotal = available ? unit.mul(item.qty) : new D(0);
  const art = categoryArt(offer.product.category.name);
  return {
    id: item.id,
    offerId: offer.id,
    productId: offer.product.id,
    productCode: offer.product.code,
    name: offer.product.name,
    category: offer.product.category.name,
    unit: offer.product.unit,
    sellerId: offer.sellerId,
    sellerName: offer.seller.storeName,
    sellerCity: offer.seller.city,
    price: money(offer.price),
    unitPrice: money(unit),
    qty: item.qty,
    minOrderQty: offer.minOrderQty,
    stock: offer.stock,
    leadTimeDays: offer.leadTimeDays,
    lineTotal: money(lineTotal),
    available,
    issue,
    bulk: bulkPercent(item.qty) > 0,
    savedForLater: item.savedForLater,
    hue: art.hue,
    art: art.art,
  };
}

async function computeCart(
  cart: CartWithItems,
  userId: string,
  couponCode: string | null,
  client: CartReadClient,
  strictCoupon: boolean,
): Promise<CartDto> {
  const allItems = cart.items.map(toItem);
  const items = allItems.filter((item) => !item.savedForLater);
  const savedItems = allItems.filter((item) => item.savedForLater);

  const groupsById = new Map<string, CartGroupDto>();
  for (const item of items) {
    const raw = cart.items.find((row) => row.id === item.id);
    if (!raw) continue;
    const seller = raw.sellerOffer.seller;
    let group = groupsById.get(item.sellerId);
    if (!group) {
      group = {
        sellerId: item.sellerId,
        sellerName: item.sellerName,
        sellerCity: item.sellerCity,
        items: [],
        subtotal: ZERO,
        deliveryFee: ZERO,
        freeAbove: money(seller.freeAbove),
      };
      groupsById.set(item.sellerId, group);
    }
    group.items.push(item);
  }

  let subtotal = new D(0);
  let deliveryFee = new D(0);
  for (const group of groupsById.values()) {
    const raw = cart.items.find((row) => row.sellerOffer.sellerId === group.sellerId && !row.savedForLater);
    if (!raw) continue;
    const seller = raw.sellerOffer.seller;
    const groupSubtotal = group.items.reduce(
      (sum, item) => (item.available ? sum.plus(new D(item.lineTotal)) : sum),
      new D(0),
    );
    const groupDelivery = deliveryFeeFor(groupSubtotal, seller.freeAbove, seller.fee);
    group.subtotal = money(groupSubtotal);
    group.deliveryFee = money(groupDelivery);
    subtotal = subtotal.plus(groupSubtotal);
    deliveryFee = deliveryFee.plus(groupDelivery);
  }

  let coupon: CartCouponDto | null = null;
  let couponMessage: string | null = null;
  let discount = new D(0);

  if (couponCode) {
    const rule = await loadCoupon(couponCode, client);
    if (!rule) {
      couponMessage = "That code is not valid";
      if (strictCoupon) throw new ApiError(422, "coupon_invalid", couponMessage);
    } else {
      try {
        const firstOrder = (await client.order.count({ where: { userId } })) === 0;
        const outcome = evaluateCoupon(rule, subtotal, firstOrder);
        discount = outcome.discount;
        if (outcome.freeDelivery) {
          deliveryFee = new D(0);
          for (const group of groupsById.values()) group.deliveryFee = ZERO;
        }
        coupon = {
          code: rule.code,
          label: rule.label,
          discount: money(discount),
          freeDelivery: outcome.freeDelivery,
        };
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        couponMessage = error.message;
        if (strictCoupon) throw error;
      }
    }
  }

  const taxable = subtotal.minus(discount);
  const tax = taxFor(taxable.lt(0) ? new D(0) : taxable);
  let total = taxable.plus(deliveryFee);
  if (total.lt(0)) total = new D(0);

  return {
    items,
    savedItems,
    groups: [...groupsById.values()],
    totals: {
      subtotal: money(subtotal),
      discount: money(discount),
      deliveryFee: money(deliveryFee),
      taxAmount: money(tax),
      total: money(total),
      itemCount: items.reduce((sum, item) => sum + item.qty, 0),
      couponCode: coupon?.code ?? null,
      couponMessage,
    },
    coupon,
    couponMessage,
  };
}

export async function getCart(
  userId: string,
  couponCode: string | null = null,
  client: CartReadClient = db,
  strictCoupon = false,
): Promise<CartDto> {
  const cart = await client.cart.findUnique({
    where: { userId },
    include: cartInclude,
  });
  if (!cart) {
    if (strictCoupon) {
      throw new ApiError(422, "cart_empty", "Add items before applying a coupon");
    }
    return emptyCart(couponCode ? "Add items before applying a coupon" : null);
  }
  return computeCart(cart, userId, couponCode, client, strictCoupon);
}

function validateQuantity(offer: OfferWithRelations, qty: number): void {
  if (offer.status !== "active") {
    throw new ApiError(409, "offer_unavailable", "This listing is not available");
  }
  if (offer.seller.vacationMode) {
    throw new ApiError(409, "seller_unavailable", "This seller is not accepting orders");
  }
  if (qty < offer.minOrderQty) {
    throw new ApiError(422, "minimum_quantity", `Minimum order is ${offer.minOrderQty}`);
  }
  if (qty > offer.stock) {
    throw new ApiError(409, "insufficient_stock", `Only ${offer.stock} left in stock`);
  }
}

async function lockOffer(tx: Prisma.TransactionClient, offerId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "SellerOffer" WHERE "id" = ${offerId} FOR UPDATE`;
}

export async function addCartItem(
  userId: string,
  offerId: string,
  qty: number,
  couponCode: string | null = null,
): Promise<CartDto> {
  return db.$transaction(
    async (tx) => {
      await lockOffer(tx, offerId);
      const offer = await tx.sellerOffer.findUnique({ where: { id: offerId }, include: offerInclude });
      if (!offer) throw new ApiError(404, "offer_not_found", "Listing not found");

      const cart = await tx.cart.upsert({
        where: { userId },
        update: {},
        create: { userId },
        include: cartInclude,
      });
      const existing = cart.items.find((item) => item.sellerOfferId === offerId);
      const nextQty = (existing?.qty ?? 0) + qty;
      validateQuantity(offer, nextQty);

      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { qty: nextQty, savedForLater: false },
        });
      } else {
        await tx.cartItem.create({
          data: { cartId: cart.id, sellerOfferId: offerId, qty },
        });
      }

      const fresh = await tx.cart.findUniqueOrThrow({ where: { id: cart.id }, include: cartInclude });
      return computeCart(fresh, userId, couponCode, tx, false);
    },
    { timeout: 15_000 },
  );
}

export async function updateCartItem(
  userId: string,
  itemId: string,
  input: { qty?: number; savedForLater?: boolean },
  couponCode: string | null = null,
): Promise<CartDto> {
  return db.$transaction(
    async (tx) => {
      const item = await tx.cartItem.findFirst({
        where: { id: itemId, cart: { userId } },
        include: { sellerOffer: { include: offerInclude } },
      });
      if (!item) throw new ApiError(404, "cart_item_not_found", "Cart item not found");

      await lockOffer(tx, item.sellerOfferId);
      const offer = await tx.sellerOffer.findUnique({
        where: { id: item.sellerOfferId },
        include: offerInclude,
      });
      if (!offer) throw new ApiError(404, "offer_not_found", "Listing not found");
      const nextSaved = input.savedForLater ?? item.savedForLater;
      if (!nextSaved || input.qty !== undefined) {
        validateQuantity(offer, input.qty ?? item.qty);
      }

      await tx.cartItem.update({
        where: { id: item.id },
        data: {
          ...(input.qty !== undefined ? { qty: input.qty } : {}),
          ...(input.savedForLater !== undefined ? { savedForLater: input.savedForLater } : {}),
        },
      });

      const cart = await tx.cart.findUniqueOrThrow({
        where: { id: item.cartId },
        include: cartInclude,
      });
      return computeCart(cart, userId, couponCode, tx, false);
    },
    { timeout: 15_000 },
  );
}

export async function removeCartItem(
  userId: string,
  itemId: string,
  couponCode: string | null = null,
): Promise<CartDto> {
  const removed = await db.cartItem.deleteMany({
    where: { id: itemId, cart: { userId } },
  });
  if (removed.count === 0) {
    throw new ApiError(404, "cart_item_not_found", "Cart item not found");
  }
  return getCart(userId, couponCode);
}

export async function applyCoupon(userId: string, code: string): Promise<CartDto> {
  return getCart(userId, code.trim().toUpperCase(), db, true);
}
