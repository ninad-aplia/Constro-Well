export interface AddressDto {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  pin: string;
  isDefault: boolean;
}

export interface OrderTotalsDto {
  subtotal: string;
  discount: string;
  deliveryFee: string;
  taxAmount: string;
  total: string;
}

export interface OrderLineDto {
  id: string;
  productId: string;
  productCode: string;
  name: string;
  category: string;
  unit: string;
  sellerId: string;
  sellerName: string;
  qty: number;
  unitPrice: string;
  lineValue: string;
  hue: string;
  art: string;
}

export interface OrderShipmentEventDto {
  at: string;
  actor: string;
  message: string;
}

export interface OrderShipmentIssueDto {
  type: string;
  note: string;
  createdAt: string;
}

export interface OrderShipmentDto {
  id: string;
  code: string;
  sellerId: string;
  sellerName: string;
  status: string;
  deliveredAt: string | null;
  reviewEnds: string | null;
  /** Only populated for the owning customer while this shipment is on the road. */
  otp: string | null;
  events: OrderShipmentEventDto[];
  /** Present once a dispute has been opened (driver shortfall or customer report). */
  issue: OrderShipmentIssueDto | null;
}

export interface OrderEscrowDto {
  held: string;
  refunded: string;
  released: string;
}

export interface OrderDto {
  id: string; // public code, e.g. BG-123456
  code: string;
  createdAt: string;
  stage: number;
  cancelled: boolean;
  financeModel: "escrow" | "seller_collected";
  paymentMethod: string;
  paymentLabel: string;
  couponCode: string | null;
  itemCount: number;
  address: AddressDto;
  totals: OrderTotalsDto;
  escrow: OrderEscrowDto;
  lines: OrderLineDto[];
  shipments: OrderShipmentDto[];
}

export interface CheckoutPreviewDto {
  address: AddressDto;
  groups: import("./cartDto").CartGroupDto[];
  totals: import("./cartDto").CartTotalsDto;
  coupon: import("./cartDto").CartCouponDto | null;
  errors: string[];
  canPlaceOrder: boolean;
}
