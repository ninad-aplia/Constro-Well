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
}

export interface SellerOrdersResponse {
  orders: SellerShipmentDto[];
  vehicles: SellerVehicleDto[];
  drivers: SellerDriverDto[];
  rules: SellerRulesDto;
}
