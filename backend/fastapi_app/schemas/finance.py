"""Seller-collected COD finance schemas (camelCase on the wire, matching the
existing Admin DTO conventions). All money is exact decimal strings; rates are
exact decimal strings at 6 decimal places. Never `float`."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Money = Annotated[Decimal, Field(gt=0, max_digits=14, decimal_places=2)]
Rate = Annotated[Decimal, Field(gt=0, le=1, max_digits=7, decimal_places=6)]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class CodCollectionOut(CamelModel):
    id: str
    shipment_id: str
    seller_id: str
    store_name: str | None = None
    expected_amount: str
    collected_amount: str | None
    collected_by: str | None
    status: str
    evidence_ref: str | None
    note: str | None
    confirmed_at: datetime | None
    created_at: datetime


class CommissionAssessmentOut(CamelModel):
    id: str
    seller_id: str
    store_name: str | None = None
    shipment_id: str
    basis: str
    basis_amount: str
    rate: str
    commission_amount: str
    status: str
    assessed_at: datetime
    created_at: datetime


class RemittanceOut(CamelModel):
    id: str
    seller_id: str
    store_name: str | None = None
    amount: str
    method: str
    reference: str
    status: str
    initiated_at: datetime
    received_at: datetime | None
    created_at: datetime


class RemittanceAllocationOut(CamelModel):
    id: str
    remittance_id: str
    assessment_id: str
    amount: str
    kind: str
    reverses_id: str | None
    created_at: datetime


class SellerAdjustmentOut(CamelModel):
    id: str
    seller_id: str
    store_name: str | None = None
    shipment_id: str | None
    order_id: str | None
    type: str
    amount: str
    reason: str
    evidence_ref: str | None
    status: str
    reverses_id: str | None
    applied_at: datetime | None
    created_at: datetime


class SellerStatementCollectionsOut(CamelModel):
    expected_cod: str
    confirmed_cod: str
    pending_count: int
    confirmed_count: int
    disputed_count: int
    discrepancy_count: int
    discrepancy_amount: str


class SellerStatementCommissionOut(CamelModel):
    assessed: str
    remitted: str
    outstanding: str
    credit_applied: str
    credit_balance: str


class SellerStatementRemittancesOut(CamelModel):
    received: str
    unallocated: str
    initiated: str


class SellerStatementAdjustmentsOut(CamelModel):
    net: str
    commission_credits: str


class SellerStatementLegacyEscrowOut(CamelModel):
    held: str
    commission: str
    penalty: str
    refund: str
    released: str
    withdrawn: str


class SellerStatementOut(CamelModel):
    seller_id: str
    generated_at: datetime
    collections: SellerStatementCollectionsOut
    commission: SellerStatementCommissionOut
    remittances: SellerStatementRemittancesOut
    adjustments: SellerStatementAdjustmentsOut
    legacy_escrow: SellerStatementLegacyEscrowOut


# --- Request bodies ---------------------------------------------------------


class ConfirmCollectionIn(CamelModel):
    collected_amount: Money
    evidence_ref: str | None = Field(None, max_length=200)
    note: str | None = Field(None, max_length=500)


class InitiateRemittanceIn(CamelModel):
    amount: Money
    method: str = Field(min_length=1, max_length=40)
    reference: str = Field(min_length=1, max_length=120)
    note: str | None = Field(None, max_length=500)


class NoteIn(CamelModel):
    note: str | None = Field(None, max_length=500)


class AllocateIn(CamelModel):
    assessment_id: str = Field(min_length=1, max_length=100)
    amount: Money


class CreatePolicyIn(CamelModel):
    basis: str = Field(pattern="^(order_value|collected_cod)$")
    rate: Rate


class CreateAdjustmentIn(CamelModel):
    type: str = Field(pattern="^(customer_refund|adjustment)$")
    amount: Money
    reason: str = Field(min_length=1, max_length=500)
    evidence_ref: str | None = Field(None, max_length=200)
    shipment_id: str | None = Field(None, max_length=100)
    order_id: str | None = Field(None, max_length=100)


class ReverseAdjustmentIn(CamelModel):
    reason: str = Field(min_length=1, max_length=500)


class AssessmentRunIn(CamelModel):
    # Bounded batch so one admin action cannot scan the whole history.
    limit: int = Field(200, ge=1, le=500)


class AssessmentRunFailureOut(CamelModel):
    shipment_id: str
    code: str


class AssessmentRunOut(CamelModel):
    policy_id: str
    basis: str
    rate: str
    attempted: int
    created: int
    skipped: int
    failed: list[AssessmentRunFailureOut]


class CollectionListOut(CamelModel):
    collections: list[CodCollectionOut]


class AssessmentListOut(CamelModel):
    assessments: list[CommissionAssessmentOut]


class RemittanceListOut(CamelModel):
    remittances: list[RemittanceOut]


class AdjustmentListOut(CamelModel):
    adjustments: list[SellerAdjustmentOut]
