// Shared cart API shapes. Money fields are fixed decimal strings.
export interface CartItemDto {
  id: string;
  offerId: string;
  productId: string;
  productCode: string;
  name: string;
  category: string;
  unit: string;
  sellerId: string;
  sellerName: string;
  sellerCity: string;
  price: string;
  unitPrice: string;
  qty: number;
  minOrderQty: number;
  stock: number;
  leadTimeDays: number;
  lineTotal: string;
  available: boolean;
  issue: string | null;
  bulk: boolean;
  savedForLater: boolean;
  hue: string;
  art: string;
}

export interface CartGroupDto {
  sellerId: string;
  sellerName: string;
  sellerCity: string;
  items: CartItemDto[];
  subtotal: string;
  deliveryFee: string;
  freeAbove: string;
}

export interface CartTotalsDto {
  subtotal: string;
  discount: string;
  deliveryFee: string;
  taxAmount: string;
  total: string;
  itemCount: number;
  couponCode: string | null;
  couponMessage: string | null;
}

export interface CartCouponDto {
  code: string;
  label: string;
  discount: string;
  freeDelivery: boolean;
}

export interface CartDto {
  items: CartItemDto[];
  savedItems: CartItemDto[];
  groups: CartGroupDto[];
  totals: CartTotalsDto;
  coupon: CartCouponDto | null;
  couponMessage: string | null;
}
