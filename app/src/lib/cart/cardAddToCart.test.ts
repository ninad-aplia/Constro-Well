import { describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/client";
import {
  CARD_ROLE_MESSAGE,
  CARD_UNAVAILABLE_MESSAGE,
  addCardItemToCart,
  type CardAddInput,
} from "./cardAddToCart";

const input: CardAddInput = {
  sessionStatus: "authenticated",
  role: "customer",
  adding: false,
  offerId: "offer-1",
  purchasable: true,
  minOrderQty: 5,
  nextPath: "/search?q=cement",
};

describe("addCardItemToCart", () => {
  it("adds the purchasable offer at the seller's minimum quantity", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    await expect(addCardItemToCart(input, add)).resolves.toEqual({ status: "added" });
    expect(add).toHaveBeenCalledOnce();
    expect(add).toHaveBeenCalledWith("offer-1", 5);
  });

  it("never asks for less than one unit", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    await addCardItemToCart({ ...input, minOrderQty: undefined }, add);
    expect(add).toHaveBeenCalledWith("offer-1", 1);
  });

  it("blocks an unavailable offer instead of calling the cart API", async () => {
    const add = vi.fn();
    await expect(
      addCardItemToCart({ ...input, offerId: null, purchasable: false }, add),
    ).resolves.toEqual({ status: "notice", message: CARD_UNAVAILABLE_MESSAGE });
    await expect(
      addCardItemToCart({ ...input, purchasable: false }, add),
    ).resolves.toEqual({ status: "notice", message: CARD_UNAVAILABLE_MESSAGE });
    expect(add).not.toHaveBeenCalled();
  });

  it("sends guests to sign in and back to the current path", async () => {
    const add = vi.fn();
    const result = await addCardItemToCart(
      { ...input, sessionStatus: "guest", role: null },
      add,
    );
    expect(result).toEqual({
      status: "redirect",
      href: `/login?next=${encodeURIComponent("/search?q=cement")}`,
    });
    expect(add).not.toHaveBeenCalled();
  });

  it("refuses a signed-in non-customer with a message", async () => {
    const add = vi.fn();
    await expect(addCardItemToCart({ ...input, role: "seller" }, add)).resolves.toEqual({
      status: "notice",
      message: CARD_ROLE_MESSAGE,
    });
    expect(add).not.toHaveBeenCalled();
  });

  it("ignores a duplicate click while a request is in flight", async () => {
    const add = vi.fn();
    await expect(addCardItemToCart({ ...input, adding: true }, add)).resolves.toEqual({
      status: "ignored",
    });
    expect(add).not.toHaveBeenCalled();
  });

  it("ignores clicks while the session is still loading", async () => {
    const add = vi.fn();
    await expect(
      addCardItemToCart({ ...input, sessionStatus: "loading", role: null }, add),
    ).resolves.toEqual({ status: "ignored" });
    expect(add).not.toHaveBeenCalled();
  });

  it("surfaces the server message when the cart API rejects", async () => {
    const add = vi.fn().mockRejectedValue(
      new ApiClientError(409, "insufficient_stock", "Only 3 left in stock"),
    );
    await expect(addCardItemToCart(input, add)).resolves.toEqual({
      status: "failed",
      message: "Only 3 left in stock",
    });
  });

  it("falls back to a generic message on an unknown failure", async () => {
    const add = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(addCardItemToCart(input, add)).resolves.toEqual({
      status: "failed",
      message: "Could not add to cart",
    });
  });
});
