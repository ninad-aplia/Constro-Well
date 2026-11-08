// Pure gate for the cart's "Proceed to Buy" control — enabled only when the
// cart has at least one item the server still considers purchasable
// (`CartItemDto.available`). Extracted so the condition that was previously
// hardcoded to `disabled` on CartView's button is covered by a unit test
// rather than only verified by eye.
import type { CartItemDto } from "@/lib/api/cartDto";

export function hasPurchasableItem(items: Pick<CartItemDto, "available">[]): boolean {
  return items.some((item) => item.available);
}
