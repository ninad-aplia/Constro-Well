// Server-side Admin API client. FASTAPI_BASE_URL is intentionally NOT a
// NEXT_PUBLIC_ variable, so the backend address never reaches the browser
// bundle. Callers must forward the existing `cw_session` cookie; FastAPI
// re-authorizes every request (the UI gate is not the security boundary).
import { ApiClientError, apiFetch } from "./client";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  createdAt: string;
}

export interface AdminUsersPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  pagination: AdminUsersPagination;
}

export interface AuditActor {
  id: string;
  name: string;
}

export interface AuditEventRecord {
  id: string;
  action: string;
  actor: AuditActor;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, string | number>;
  createdAt: string;
}

export interface AuditEventsResponse {
  events: AuditEventRecord[];
  pagination: AdminUsersPagination;
}

export interface AdminSeller {
  id: string;
  storeName: string;
  ownerUserId: string;
  ownerName: string;
  city: string;
  vacationMode: boolean;
  kycGst: string;
  kycPan: string;
  kycCheque: string;
  createdAt: string;
}

export interface AdminSellersResponse {
  sellers: AdminSeller[];
  pagination: AdminUsersPagination;
}

export interface AdminOrder {
  id: string;
  code: string;
  customer: { id: string; name: string };
  stage: string;
  cancelled: boolean;
  grossTotal: string;
  lineCount: number;
  shipmentCount: number;
  shipments: Array<{ code: string; sellerName: string; status: string }>;
  createdAt: string;
}

export interface AdminOrdersResponse {
  orders: AdminOrder[];
  pagination: AdminUsersPagination;
}

export interface AdminShipment {
  id: string;
  code: string;
  orderId: string;
  orderCode: string;
  sellerId: string;
  sellerName: string;
  status: string;
  driverId: string | null;
  driverName: string | null;
  late: boolean;
  deliveredAt: string | null;
  reviewEnds: string | null;
  createdAt: string;
}

export interface AdminShipmentsResponse {
  shipments: AdminShipment[];
  pagination: AdminUsersPagination;
}

export interface AdminOverview {
  generatedAt: string;
  windows: { last30DaysStart: string; dailyStart: string };
  totals: { users: number; sellers: number; orders: number; cancelledOrders: number };
  last30Days: { users: number; sellers: number; orders: number };
  orderStages: Array<{ stage: string; count: number }>;
  shipmentsByStatus: Array<{ status: string; count: number }>;
  ordersPerDay: Array<{ date: string; count: number }>;
  escrowByType: Array<{ type: string; entries: number; amount: string }>;
  kycPending: { gst: number; pan: number; cheque: number };
}

export interface AuditEventFilters {
  action?: string;
  actorId?: string;
  from?: string;
  to?: string;
}

export interface AuditFilterOptions {
  actions: string[];
  actors: Array<{ id: string; name: string }>;
}

export interface AdminOrderDetail {
  order: {
    id: string;
    code: string;
    stage: string;
    cancelled: boolean;
    paymentMethod: string;
    paymentLabel: string;
    createdAt: string;
    updatedAt: string;
  };
  customer: { id: string; name: string; email: string };
  money: {
    itemValue: string;
    discount: string;
    deliveryFee: string;
    taxAmount: string;
    grossTotal: string;
  };
  lines: Array<{
    id: string;
    name: string;
    unit: string;
    unitPrice: string;
    qty: number;
    lineValue: string;
    sellerId: string;
    sellerName: string;
  }>;
  shipments: Array<{
    id: string;
    code: string;
    sellerId: string;
    sellerName: string;
    status: string;
    slot: string | null;
    late: boolean;
    deliveredAt: string | null;
    deliveredQty: number | null;
    reviewEnds: string | null;
    createdAt: string;
    updatedAt: string;
    events: Array<{ id: string; actor: string; message: string; at: string }>;
  }>;
  financialRecords: Array<{
    id: string;
    type: string;
    amount: string;
    createdAt: string;
    sellerId: string | null;
    sellerName: string | null;
    shipmentId: string | null;
  }>;
}

export interface AdminSellerDetail {
  seller: {
    id: string;
    storeName: string;
    city: string;
    phone: string;
    vacationMode: boolean;
    kycGst: string;
    kycPan: string;
    kycCheque: string;
    createdAt: string;
  };
  owner: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
  };
  auditHistory: Array<{
    id: string;
    action: string;
    actor: AuditActor;
    createdAt: string;
  }>;
}

export class AdminApiUnavailableError extends Error {
  constructor() {
    super("Admin API is not configured");
    this.name = "AdminApiUnavailableError";
  }
}

function baseUrl(): string {
  return (process.env.FASTAPI_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

export function adminApiConfigured(): boolean {
  return baseUrl().length > 0;
}

export async function fetchAdminUsers(
  page: number,
  pageSize: number,
  cookie: string,
): Promise<AdminUsersResponse> {
  if (!adminApiConfigured()) throw new AdminApiUnavailableError();
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiFetch<AdminUsersResponse>(
    `/api/admin/users?${query.toString()}`,
    { headers: cookie ? { cookie } : undefined, cache: "no-store" },
    baseUrl(),
  );
}

export async function fetchAuditEvents(
  page: number,
  pageSize: number,
  cookie: string,
  filters: AuditEventFilters = {},
): Promise<AuditEventsResponse> {
  if (!adminApiConfigured()) throw new AdminApiUnavailableError();
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters.action) query.set("action", filters.action);
  if (filters.actorId) query.set("actorId", filters.actorId);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  return apiFetch<AuditEventsResponse>(
    `/api/admin/audit-events?${query.toString()}`,
    { headers: cookie ? { cookie } : undefined, cache: "no-store" },
    baseUrl(),
  );
}

export async function fetchAuditFilterOptions(cookie: string): Promise<AuditFilterOptions> {
  if (!adminApiConfigured()) throw new AdminApiUnavailableError();
  return apiFetch<AuditFilterOptions>(
    "/api/admin/audit-events/filters",
    { headers: cookie ? { cookie } : undefined, cache: "no-store" },
    baseUrl(),
  );
}

export async function fetchAdminSellers(
  page: number,
  pageSize: number,
  cookie: string,
): Promise<AdminSellersResponse> {
  if (!adminApiConfigured()) throw new AdminApiUnavailableError();
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiFetch<AdminSellersResponse>(
    `/api/admin/sellers?${query.toString()}`,
    { headers: cookie ? { cookie } : undefined, cache: "no-store" },
    baseUrl(),
  );
}

export async function fetchAdminSeller(
  id: string,
  cookie: string,
): Promise<AdminSellerDetail> {
  if (!adminApiConfigured()) throw new AdminApiUnavailableError();
  return apiFetch<AdminSellerDetail>(
    `/api/admin/sellers/${encodeURIComponent(id)}`,
    { headers: cookie ? { cookie } : undefined, cache: "no-store" },
    baseUrl(),
  );
}

export async function fetchAdminOrders(
  page: number,
  pageSize: number,
  cookie: string,
): Promise<AdminOrdersResponse> {
  if (!adminApiConfigured()) throw new AdminApiUnavailableError();
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiFetch<AdminOrdersResponse>(
    `/api/admin/orders?${query.toString()}`,
    { headers: cookie ? { cookie } : undefined, cache: "no-store" },
    baseUrl(),
  );
}

export async function fetchAdminOrder(id: string, cookie: string): Promise<AdminOrderDetail> {
  if (!adminApiConfigured()) throw new AdminApiUnavailableError();
  return apiFetch<AdminOrderDetail>(
    `/api/admin/orders/${encodeURIComponent(id)}`,
    { headers: cookie ? { cookie } : undefined, cache: "no-store" },
    baseUrl(),
  );
}

export async function fetchAdminShipments(
  page: number,
  pageSize: number,
  cookie: string,
  status?: string,
): Promise<AdminShipmentsResponse> {
  if (!adminApiConfigured()) throw new AdminApiUnavailableError();
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status) query.set("status", status);
  return apiFetch<AdminShipmentsResponse>(
    `/api/admin/shipments?${query.toString()}`,
    { headers: cookie ? { cookie } : undefined, cache: "no-store" },
    baseUrl(),
  );
}

export async function fetchAdminOverview(cookie: string): Promise<AdminOverview> {
  if (!adminApiConfigured()) throw new AdminApiUnavailableError();
  return apiFetch<AdminOverview>(
    "/api/admin/overview",
    { headers: cookie ? { cookie } : undefined, cache: "no-store" },
    baseUrl(),
  );
}

export { ApiClientError };
