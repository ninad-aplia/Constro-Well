export interface SellerLineDto {
  id: string;
  productId: string;
  productCode: string;
  name: string;
  category: string;
  unit: string;
  qty: number;
  unitPrice: string;
  lineValue: string;
  weightKg: number;
  bulk: boolean;
}

export interface SellerEventDto {
  at: string;
  message: string;
}

export interface SellerShipmentDto {
  id: string;
  code: string;
  orderCode: string;
  status: string;
  createdAt: string;
  buyerName: string;
  buyerLine: string;
  buyerCity: string;
  buyerPin: string;
  buyerPhone: string;
  slot: string | null;
  late: boolean;
  acceptBy: string | null;
  dispatchBy: string | null;
  deliveredAt: string | null;
  reviewEnds: string | null;
  vehicleId: string | null;
  vehicleReg: string | null;
  driverName: string | null;
  driverPhone: string | null;
  docs: {
    challan: boolean;
    invoice: boolean;
    eway: string | null;
    weighbridge: string | null;
  };
  issue: { type: string; note: string; claim: string | null } | null;
  lines: SellerLineDto[];
  events: SellerEventDto[];
}

export interface SellerVehicleDto {
  id: string;
  regNumber: string;
  type: string;
  driverId: string | null;
  driverName: string | null;
}

export interface SellerDriverDto {
  id: string;
  name: string;
  phone: string;
}

export interface SellerRulesDto {
  freeAbove: string;
  fee: string;
  slotsPerDay: number[];
}

export interface SellerBalanceDto {
  available: string;
  pendingRelease: string;
  frozen: string;
}

export interface SellerSummaryDto {
  storeName: string;
  city: string;
  ownerFirstName: string;
  newOrders: number;
  readyToDispatch: number;
  late: number;
  openDisputes: number;
  review: number;
  failed: number;
  lowStock: number;
  vacationMode: boolean;
  score: number;
  balance: SellerBalanceDto;
}

export interface SellerOrdersResponse {
  orders: SellerShipmentDto[];
  vehicles: SellerVehicleDto[];
  drivers: SellerDriverDto[];
  rules: SellerRulesDto;
}

export interface SellerProfileDto {
  storeName: string;
  gstin: string;
  phone: string;
  city: string;
  pickupAddress: string;
  vacationMode: boolean;
  kyc: {
    gst: "verified" | "pending";
    pan: "verified" | "pending";
    cheque: "verified" | "pending";
  };
}

export interface SellerDeliverySettingsDto {
  rules: SellerRulesDto;
  serviceAreas: string[];
}

export interface SellerLedgerEntryDto {
  id: string;
  type: string;
  amount: string;
  note: string;
  createdAt: string;
  orderCode: string | null;
  shipmentCode: string | null;
}

export interface SellerPaymentsDto {
  balance: SellerBalanceDto;
  totalReleased: string;
  totalWithdrawn: string;
  bankRef: string;
  ledger: SellerLedgerEntryDto[];
}

export interface SellerPerformanceStatsDto {
  offered: number;
  accepted: number;
  dispatched: number;
  ontime: number;
  delivered: number;
  issues: number;
}

export interface SellerPerformanceDto {
  stats: SellerPerformanceStatsDto;
  score: number;
}
