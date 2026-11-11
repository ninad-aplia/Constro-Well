"""Admin API schemas (camelCase on the wire, matching existing DTO conventions)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AdminUserOut(CamelModel):
    id: str
    email: str
    name: str
    phone: str | None
    role: str
    created_at: datetime


class AdminPaginationOut(CamelModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class AdminUserListOut(CamelModel):
    users: list[AdminUserOut]
    pagination: AdminPaginationOut


class AuditActorOut(CamelModel):
    id: str
    name: str


class AuditEventOut(CamelModel):
    id: str
    action: str
    actor: AuditActorOut
    target_type: str
    target_id: str | None
    metadata: dict
    created_at: datetime


class AuditEventListOut(CamelModel):
    events: list[AuditEventOut]
    pagination: AdminPaginationOut


class AdminSellerOut(CamelModel):
    id: str
    store_name: str
    owner_user_id: str
    owner_name: str
    city: str
    vacation_mode: bool
    kyc_gst: str
    kyc_pan: str
    kyc_cheque: str
    created_at: datetime


class AdminSellerListOut(CamelModel):
    sellers: list[AdminSellerOut]
    pagination: AdminPaginationOut


class AdminSellerProfileOut(CamelModel):
    id: str
    store_name: str
    city: str
    phone: str
    vacation_mode: bool
    kyc_gst: str
    kyc_pan: str
    kyc_cheque: str
    created_at: datetime


class AdminSellerOwnerOut(CamelModel):
    id: str
    name: str
    email: str
    created_at: datetime


class AdminSellerAuditOut(CamelModel):
    id: str
    action: str
    actor: AuditActorOut
    created_at: datetime


class AdminSellerDetailOut(CamelModel):
    seller: AdminSellerProfileOut
    owner: AdminSellerOwnerOut
    audit_history: list[AdminSellerAuditOut]


class AdminOrderCustomerOut(CamelModel):
    id: str
    name: str


class AdminOrderShipmentOut(CamelModel):
    code: str
    seller_name: str
    status: str


class AdminOrderOut(CamelModel):
    id: str
    code: str
    customer: AdminOrderCustomerOut
    stage: str
    cancelled: bool
    gross_total: str
    line_count: int
    shipment_count: int
    shipments: list[AdminOrderShipmentOut]
    created_at: datetime


class AdminOrderListOut(CamelModel):
    orders: list[AdminOrderOut]
    pagination: AdminPaginationOut


class AdminShipmentRowOut(CamelModel):
    id: str
    code: str
    order_id: str
    order_code: str
    seller_id: str
    seller_name: str
    status: str
    driver_id: str | None
    driver_name: str | None
    late: bool
    delivered_at: datetime | None
    review_ends: datetime | None
    created_at: datetime


class AdminShipmentListOut(CamelModel):
    shipments: list[AdminShipmentRowOut]
    pagination: AdminPaginationOut


class AdminOrderDetailOrderOut(CamelModel):
    id: str
    code: str
    stage: str
    cancelled: bool
    payment_method: str
    payment_label: str
    created_at: datetime
    updated_at: datetime


class AdminOrderDetailCustomerOut(CamelModel):
    id: str
    name: str
    email: str


class AdminOrderMoneyOut(CamelModel):
    item_value: str
    discount: str
    delivery_fee: str
    tax_amount: str
    gross_total: str


class AdminOrderLineOut(CamelModel):
    id: str
    name: str
    unit: str
    unit_price: str
    qty: int
    line_value: str
    seller_id: str
    seller_name: str


class AdminShipmentEventOut(CamelModel):
    id: str
    actor: str
    message: str
    at: datetime


class AdminOrderShipmentDetailOut(CamelModel):
    id: str
    code: str
    seller_id: str
    seller_name: str
    status: str
    slot: str | None
    late: bool
    delivered_at: datetime | None
    delivered_qty: int | None
    review_ends: datetime | None
    created_at: datetime
    updated_at: datetime
    events: list[AdminShipmentEventOut]


class AdminOrderFinancialOut(CamelModel):
    id: str
    type: str
    amount: str
    created_at: datetime
    seller_id: str | None
    seller_name: str | None
    shipment_id: str | None


class AdminOrderDetailOut(CamelModel):
    order: AdminOrderDetailOrderOut
    customer: AdminOrderDetailCustomerOut
    money: AdminOrderMoneyOut
    lines: list[AdminOrderLineOut]
    shipments: list[AdminOrderShipmentDetailOut]
    financial_records: list[AdminOrderFinancialOut]


class AdminOrderExistsOut(CamelModel):
    exists: bool


class AdminOverviewWindows(CamelModel):
    last30_days_start: datetime
    daily_start: datetime


class AdminOverviewTotals(CamelModel):
    users: int
    sellers: int
    orders: int
    cancelled_orders: int


class AdminOverviewLast30(CamelModel):
    users: int
    sellers: int
    orders: int


class AdminOrderStageCount(CamelModel):
    stage: str
    count: int


class AdminShipmentStatusCount(CamelModel):
    status: str
    count: int


class AdminOrderDayCount(CamelModel):
    date: str
    count: int


class AdminEscrowTypeOut(CamelModel):
    type: str
    entries: int
    amount: str


class AdminKycPendingOut(CamelModel):
    gst: int
    pan: int
    cheque: int


class AdminAuditActorOption(CamelModel):
    id: str
    name: str


class AdminAuditFilterOptionsOut(CamelModel):
    actions: list[str]
    actors: list[AdminAuditActorOption]


class AdminOverviewOut(CamelModel):
    generated_at: datetime
    windows: AdminOverviewWindows
    totals: AdminOverviewTotals
    last30_days: AdminOverviewLast30
    order_stages: list[AdminOrderStageCount]
    shipments_by_status: list[AdminShipmentStatusCount]
    orders_per_day: list[AdminOrderDayCount]
    escrow_by_type: list[AdminEscrowTypeOut]
    kyc_pending: AdminKycPendingOut
