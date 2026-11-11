"""Admin dispute/refund resolution DTOs (camelCase, exact decimal strings)."""

from datetime import datetime
from typing import Literal

from pydantic import Field

from fastapi_app.schemas.admin import AdminPaginationOut
from fastapi_app.schemas.finance import CamelModel, Money


class DisputeRowOut(CamelModel):
    shipment_id: str
    shipment_code: str
    shipment_status: str
    order_id: str
    order_code: str
    seller_id: str
    seller_name: str
    customer_name: str
    issue_type: str
    issue_note: str
    claim: str | None
    auto: bool
    cod_status: str | None
    expected_amount: str
    collected_amount: str | None
    created_at: datetime


class DisputeLineOut(CamelModel):
    name: str
    unit: str
    qty: int
    unit_price: str
    line_value: str


class DisputeEventOut(CamelModel):
    actor: str
    message: str
    at: datetime


class RefundRequestOut(CamelModel):
    id: str
    amount: str
    reason: str
    evidence_ref: str | None
    status: str
    created_at: datetime


class DisputeDetailOut(DisputeRowOut):
    customer_email: str
    shipment_created_at: datetime
    delivered_qty: int | None
    commission_rate: str | None
    commission_source: str  # assessment | policy | none
    max_refund: str | None
    refund_request: RefundRequestOut | None
    lines: list[DisputeLineOut]
    events: list[DisputeEventOut]


class DisputeListOut(CamelModel):
    disputes: list[DisputeRowOut]
    pagination: AdminPaginationOut


class DisputeResolveIn(CamelModel):
    decision: Literal["approve", "reject"]
    approved_amount: Money | None = None
    reason: str = Field(min_length=3, max_length=500)
    evidence_ref: str | None = Field(default=None, min_length=3, max_length=200)


class DisputeResolveOut(CamelModel):
    shipment_id: str
    shipment_status: str
    decision: str
    refund_amount: str
    commission_reduction: str
    commission_rate: str
    refund_adjustment_id: str | None
    commission_credit_id: str | None
    message: str
