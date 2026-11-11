// Decision + execution for a product card's "Add to cart" control. Extracted
// from the component so the guest/role/availability branches and the failure
// path can be tested without a DOM, session or cart provider. The rules mirror
// the PDP buy box exactly - no new cart API, no client-side price/stock trust.
import { ApiClientError } from "@/lib/api/client";

export type CardSessionStatus = "loading" | "authenticated" | "guest";

export interface CardAddInput {
  sessionStatus: CardSessionStatus;
  role: string | null | undefined;
  /** True while a request for this card is in flight (duplicate-submit guard). */
  adding: boolean;
  offerId: string | null | undefined;
  purchasable: boolean | undefined;
  minOrderQty: number | undefined;
  /** Path to return to after signing in. */
  nextPath: string;
}

export type CardAddResult =
  | { status: "ignored" }
  | { status: "redirect"; href: string }
  | { status: "notice"; message: string }
  | { status: "added" }
  | { status: "failed"; message: string };

export const CARD_UNAVAILABLE_MESSAGE = "This item is not available right now.";
export const CARD_ROLE_MESSAGE = "Sign in with a customer account to add items";

export async function addCardItemToCart(
  input: CardAddInput,
  add: (offerId: string, qty: number) => Promise<void>,
): Promise<CardAddResult> {
  if (input.adding || input.sessionStatus === "loading") return { status: "ignored" };
  if (!input.offerId || !input.purchasable) {
    return { status: "notice", message: CARD_UNAVAILABLE_MESSAGE };
  }
  if (input.sessionStatus !== "authenticated") {
    return { status: "redirect", href: `/login?next=${encodeURIComponent(input.nextPath)}` };
  }
  if (input.role !== "customer") return { status: "notice", message: CARD_ROLE_MESSAGE };

  try {
    // The seller's minimum order is enforced by POST /api/cart/items; asking
    // for less would be rejected server-side, so the card adds the minimum.
    await add(input.offerId, Math.max(1, input.minOrderQty ?? 1));
    return { status: "added" };
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof ApiClientError ? error.message : "Could not add to cart",
    };
  }
}
