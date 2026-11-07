export interface DriverEventDto {
  at: string;
  actor: string;
  message: string;
}

export interface DriverLineDto {
  id: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: string;
  lineValue: string;
  bulk: boolean;
}

export interface DriverIssueDto {
  type: string;
  note: string;
  claim: string | null;
}

export interface DriverJobDto {
  id: string;
  code: string;
  orderCode: string;
  sellerId: string;
  sellerName: string;
  status: string;
  createdAt: string;
  buyer: string;
  city: string;
  pin: string;
  phone: string;
  slot: string | null;
  vehicleId: string | null;
  vehicleReg: string | null;
  vehicleType: string | null;
  driverName: string;
  driverPhone: string;
  docs: {
    challan: boolean;
    invoice: boolean;
    eway: string | null;
    weighbridge: string | null;
  };
  deliveredAt: string | null;
  deliveredQty: number | null;
  reviewEnds: string | null;
  otpTries: number;
  issue: DriverIssueDto | null;
  lines: DriverLineDto[];
  events: DriverEventDto[];
}

export interface DriverJobsResponse {
  jobs: DriverJobDto[];
  driver: { id: string; name: string; phone: string };
  storeName: string;
}
