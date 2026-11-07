// Seller Hub domain types — shape mirrors buildgrid-seller-dashboard.html's
// `S.products`/`S.orders`/etc. Deadlines are pre-formatted labels, not live
// timestamps: this is a static preview (no 30s timer tick, no demo time
// travel — the prototype's own audit flags those as dev-only, never
// production surface), so "Accept by 3:45 PM" is computed once in mock data
// rather than a live-ticking countdown recomputed on every render.

export type SellerOrderStatus =
  | "new"
  | "accepted"
  | "packed"
  | "dispatched"
  | "failed"
  | "review"
  | "disputed"
  | "settled"
  | "rejected"
  | "missed";

export interface SellerProduct {
  id: string;
  name: string;
  category: string;
  unit: string;
  weightKg: number;
  mrp: number;
  price: number;
  stock: number;
  minOrderQty: number;
  reorderLevel: number;
  status: "active" | "paused";
  bulk: boolean;
  sold: number;
}

export interface SellerOrderEvent {
  at: string;
  message: string;
}

export interface SellerOrderDocs {
  challan?: boolean;
  invoice?: boolean;
  eway?: string;
  weighbridge?: string;
}

export interface SellerOrderIssue {
  type: string;
  note: string;
  claim?: number;
}

export interface SellerOrder {
  id: string;
  buyer: string;
  city: string;
  pin: string;
  productId: string;
  productName: string;
  productCategory: string;
  unit: string;
  price: number;
  qty: number;
  weightKg: number;
  bulk: boolean;
  createdLabel: string;
  status: SellerOrderStatus;
  acceptByLabel?: string;
  dispatchByLabel?: string;
  late?: boolean;
  slot?: string;
  vehicleId?: string;
  docs?: SellerOrderDocs;
  deliveredAtLabel?: string;
  reviewEndsLabel?: string;
  issue?: SellerOrderIssue;
  paidAtLabel?: string;
  withdrawn: boolean;
  refund?: number;
  events: SellerOrderEvent[];
}

export interface Vehicle {
  id: string;
  regNumber: string;
  type: string;
  driverId: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
}

export interface Transfer {
  id: string;
  dateLabel: string;
  amount: number;
  bank: string;
}

export interface SellerReview {
  name: string;
  stars: number;
  title: string;
  daysAgo: number;
  productName: string;
}

export interface SellerStats {
  offered: number;
  accepted: number;
  dispatched: number;
  ontime: number;
  delivered: number;
  issues: number;
}

export interface StoreProfile {
  name: string;
  owner: string;
  gstin: string;
  phone: string;
  city: string;
  address: string;
  bank: string;
  kyc: {
    gst: "Verified" | "Pending";
    pan: "Verified" | "Pending";
    cheque: "Verified" | "Pending";
  };
}

export interface DeliveryRules {
  freeAbove: number;
  fee: number;
  slotsPerDay: number[];
}

export interface NotificationPreferences {
  newOrder: boolean;
  deadlineReminders: boolean;
  lowStock: boolean;
  payouts: boolean;
}

export interface Notification {
  id: string;
  atLabel: string;
  message: string;
  read: boolean;
}

export interface SellerState {
  store: StoreProfile;
  stats: SellerStats;
  vacationMode: boolean;
  rules: DeliveryRules;
  serviceAreas: string[];
  vehicles: Vehicle[];
  drivers: Driver[];
  products: SellerProduct[];
  orders: SellerOrder[];
  transfers: Transfer[];
  reviews: SellerReview[];
  dailySales: number[];
  notifications: Notification[];
  preferences: NotificationPreferences;
}
