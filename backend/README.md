# FastAPI backend (catalogue, auth, health)

Python/FastAPI service that will become the authoritative backend for Constro Well.
This task covers the foundation only: configuration, PostgreSQL connectivity,
SQLAlchemy session management, structured logging, the shared error envelope and
health checks. Authentication, catalogue and business endpoints are migrated in
later tasks — see `docs/architecture-assessment-2026-11-10/`.

**Schema authority: Prisma.** Nothing here creates or migrates tables, and
Alembic is not initialised. Prisma (`app/prisma/`) remains the single migration
authority until an explicit, separately-decided cutover.

## Requirements

- Python 3.12 (`py -3.12 --version`)
- PostgreSQL reachable via the existing `app/.env` `DATABASE_URL`

## Setup (Windows PowerShell)

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

Configuration is read from `backend/.env`, then `../app/.env` (same keys as the
Next.js app: `DATABASE_URL`, plus optional `CORS_ORIGINS`, `LOG_LEVEL`,
`ENVIRONMENT`). Secrets are never logged or printed.

## Run locally

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn fastapi_app.main:app --reload --port 8000
```

- `GET http://127.0.0.1:8000/health` — liveness
- `GET http://127.0.0.1:8000/health/db` — proves PostgreSQL connectivity (`503` when unreachable)
- `GET http://127.0.0.1:8000/api/auth/me` — current session user (`401` when unauthenticated)
- `/docs` — Swagger UI
- `/openapi.json` — OpenAPI document

### Catalogue (read side)

Public routes ported 1:1 from Next.js — same paths, query parameters and envelopes:

- `GET /api/categories` → `{categories:[{id,name,slug,productCount}]}`
- `GET /api/products?q&category&sort&page&pageSize` → `{products:[…],pagination:{page,pageSize,total,totalPages}}` (unwrapped, as today)
  - `sort`: `relevance` (default, name asc) · `price_asc` · `price_desc` · `name_asc` · `newest`
  - `page` 1–10000, `pageSize` 1–50 (default 12); invalid input → `400 validation_error`
- `GET /api/products/{id}` → `{product:{…,available,offers}}`; lookup by id **or** code; `404 product_not_found`
- `GET /api/products/{id}/offers` → `{product, offers}` (offers duplicated at both levels, preserved)
- `GET /api/products/{id}/reviews` → `{reviews:[{name,stars,title,body,postedOn}]}` (newest first)
- `GET /api/products/{id}/rating` → `{histogram:[5★,4★,3★,2★,1★]}` integer percentages

**Reviews note:** these two routes are new FastAPI surfaces — the Next.js app had no HTTP route for reviews/histogram (its Server Components called the Prisma service directly). The preserved contract is the existing service DTO consumed by `ProductReviews`; equivalence was verified against that implementation, not against a legacy HTTP endpoint. Review *writes* remain out of scope.

Offers expose only public seller fields with exact 2-decimal money strings. Summaries include the cheapest purchasable offer (`offerId`, `stock`, `minOrderQty`, `purchasable`). Contract-equivalence tests compare against a running Next.js API (`NEXT_API_URL`, default `http://127.0.0.1:3000`) and skip when unreachable.

### Admin (first vertical slice)

`GET /api/admin/users?page=1&pageSize=20` — paginated user overview. Requires an
admin session (`cw_session`); unauthenticated → `401 unauthenticated`, non-admin
→ `403 forbidden`. Response:

```json
{"users": [{"id": "...", "email": "...", "name": "...", "phone": null, "role": "customer", "createdAt": "..."}],
 "pagination": {"page": 1, "pageSize": 20, "total": 123, "totalPages": 7}}
```

`page` 1–10000, `pageSize` 1–50 (default 20); invalid values → `400 validation_error`.
Ordering is deterministic (`createdAt DESC, id DESC`). Never returns password
hashes, sessions or tokens.

Each successful read writes one append-only `AuditEvent` (`action = admin.users.list`,
`targetType = User`, metadata `{page, pageSize, total}`) using the authenticated
admin's ID. The read and the audit insert share one transaction: if the audit
write fails, the request rolls back and returns `500 internal_error` — an
unaudited success is impossible. Append-only triggers reject UPDATE/DELETE/TRUNCATE.

This is the first Admin vertical slice, not a complete Admin portal.

Consumed by the Next.js admin console at `/admin/users` (server-side only; the
`cw_session` cookie is forwarded, and the page renders honest unauthorized /
unavailable states instead of mock users).

`GET /api/admin/audit-events?page=1&pageSize=20` — append-only activity log,
newest first (`createdAt DESC, id DESC`). Optional filters (all applied in SQL):

- `action` — exact stored action code (e.g. `admin.users.list`).
- `actorId` — exact administrator user id.
- `from` / `to` — ISO 8601 instants; `from` inclusive, `to` exclusive. Naive
  values are treated as UTC. `from >= to` → `400 validation_error`.
- `page` / `pageSize` — 1–10000 / 1–50 (default 20).

`GET /api/admin/audit-events/filters` — bounded distinct action codes and
actors that actually appear in audit rows (`{actions, actors:[{id,name}]}`).
This is a UI helper and writes no audit row; the filtered list read still writes
exactly one `admin.audit_events.list` event per successful request. Response:

```json
{"events": [{"id": "...", "action": "admin.users.list",
             "actor": {"id": "...", "name": "..."},
             "targetType": "User", "targetId": null,
             "metadata": {"page": 1, "pageSize": 20, "total": 91},
             "createdAt": "..."}],
 "pagination": {"page": 1, "pageSize": 20, "total": 14, "totalPages": 1}}
```

Metadata is whitelisted to non-sensitive keys (`page`, `pageSize`, `total`);
actor passwords, emails, tokens and arbitrary rows are never exposed. Reading
the log writes one `admin.audit_events.list` row in the same transaction, so an
unaudited read cannot succeed. Consumed by `/admin/activity`.

`GET /api/admin/sellers?page=1&pageSize=20` — paginated seller accounts with
stored KYC flags, newest first (`createdAt DESC, id DESC`). Response:

```json
{"sellers": [{"id": "...", "storeName": "...", "ownerUserId": "...", "ownerName": "...",
              "city": "...", "vacationMode": false,
              "kycGst": "verified", "kycPan": "pending", "kycCheque": "pending",
              "createdAt": "..."}],
 "pagination": {"page": 1, "pageSize": 20, "total": 37, "totalPages": 2}}
```

KYC values are the stored PostgreSQL enum values (`verified`/`pending`). GSTIN,
bank references, pickup addresses, documents and credentials are never
returned. Every successful read writes one `admin.sellers.list` audit row in the
same transaction (fail-closed). Consumed by `/admin/sellers`.

`GET /api/admin/sellers/{seller_id}` — read-only detail. Returns:

```json
{"seller": {"id": "...", "storeName": "...", "city": "...", "phone": "...",
            "vacationMode": false, "kycGst": "verified", "kycPan": "pending",
            "kycCheque": "pending", "createdAt": "..."},
 "owner": {"id": "...", "name": "...", "email": "...", "createdAt": "..."},
 "auditHistory": [{"id": "...", "action": "admin.sellers.detail",
                   "actor": {"id": "...", "name": "..."}, "createdAt": "..."}]}
```

`404 seller_not_found` (no audit row written), `401`/`403` per the shared
envelope. The read writes one `admin.sellers.detail` row
(`targetType="Seller"`, `targetId=seller_id`) in the same transaction. The
bounded history (last 5) only shows audit rows that carry a seller target — it
is explicitly **not** a complete business history (list views are not
seller-scoped and older activity predates this feature). GSTIN, bank details,
pickup address and documents are never returned. Consumed by
`/admin/sellers/[id]`.

`GET /api/admin/sellers/{seller_id}/exists` — internal (not in OpenAPI) existence
check used by the Next.js Proxy to return a real HTTP 404 for unknown sellers
before the streamed shell is committed. Returns `{exists:true}` or `404
seller_not_found`; it writes no audit row (the page's detail read is the audited
one).

`GET /api/admin/orders?page=1&pageSize=20` — read-only order monitoring, newest
first (`createdAt DESC, id DESC`):

```json
{"orders": [{"id": "...", "code": "BG-50204",
             "customer": {"id": "...", "name": "..."},
             "stage": "delivered", "cancelled": false,
             "grossTotal": "91250.00", "lineCount": 1, "shipmentCount": 1,
             "shipments": [{"code": "BG-...", "sellerName": "...", "status": "settled"}],
             "createdAt": "..."}],
 "pagination": {"page": 1, "pageSize": 20, "total": 16, "totalPages": 1}}
```

`stage` is the stored `OrderStage` plus the stored `cancelled` flag; shipment
statuses are the raw per-seller `ShipmentStatus` values — no unified status is
inferred. Money stays `Decimal → exact 2-decimal string`. Address snapshots,
phones, payments and credentials are never returned. The read writes one
`admin.orders.list` event in the same transaction. Consumed by `/admin/orders`.

`GET /api/admin/orders/{order_id}` — read-only detail:

```json
{"order":  {"id","code","stage","cancelled","paymentMethod","paymentLabel","createdAt","updatedAt"},
 "customer": {"id","name","email"},
 "money":  {"itemValue","discount","deliveryFee","taxAmount","grossTotal"},
 "lines":  [{"id","name","unit","unitPrice","qty","lineValue","sellerId","sellerName"}],
 "shipments": [{"id","code","sellerId","sellerName","status","slot","late",
                "deliveredAt","deliveredQty","reviewEnds","createdAt","updatedAt",
                "events":[{"id","actor","message","at"}]}],
 "financialRecords": [{"id","type","amount","createdAt","sellerId","sellerName","shipmentId"}]}
```

All money is exact 2-decimal strings taken from the stored order/escrow snapshots.
Order lines use their stored name/unit/price snapshots (never current product
prices). Shipments are listed per seller with their own status and true event
history (`at` ascending); missing history is not reconstructed and delivery does
not imply escrow settlement. Address snapshots, payment credentials, sessions and
bank details are never returned. `404 order_not_found` writes no audit; the read
writes one `admin.orders.detail` row in the same transaction. Consumed by
`/admin/orders/[id]`.

`GET /api/admin/orders/{order_id}/exists` — internal existence check for the
Next.js Proxy (real 404 status); no audit row.

`GET /api/admin/shipments?page=1&pageSize=20&status=failed` — read-only
cross-seller shipment monitoring, newest first (`createdAt DESC, id DESC`),
optional `status` filter (exact match against the real `ShipmentStatus`
vocabulary; an unknown value is `400 validation_error`). Complements the
per-order detail above — this is the only place an admin can find every
shipment in one state (e.g. all `failed`/`disputed`/`missed` shipments) across
every seller without opening each order individually:

```json
{"shipments": [{"id": "...", "code": "BG-...-1", "orderId": "...", "orderCode": "BG-50204",
                "sellerId": "...", "sellerName": "...", "status": "failed",
                "driverId": null, "driverName": null, "late": false,
                "deliveredAt": null, "reviewEnds": null, "createdAt": "..."}],
 "pagination": {"page": 1, "pageSize": 20, "total": 1, "totalPages": 1}}
```

The read writes one `admin.shipments.list` event in the same transaction.
Consumed by `/admin/shipments` ("Deliveries" in the admin nav). Note: the
`Shipment.status` SQLAlchemy column had to be mapped as a native
`postgresql.ENUM(..., create_type=False)` (not plain `Text`) for this filter to
work — Postgres' `=` operator rejects a native enum column against a bound
`VARCHAR` parameter (`asyncpg.exceptions.UndefinedFunctionError`); the same
fix `models/finance.py` already documents for its own enum columns.

`GET /api/admin/overview` — read-only aggregate dashboard (7 SELECT queries):

```json
{"generatedAt": "...",
 "windows": {"last30DaysStart": "...", "dailyStart": "..."},
 "totals": {"users": 91, "sellers": 37, "orders": 16, "cancelledOrders": 0},
 "last30Days": {"users": 0, "sellers": 0, "orders": 0},
 "orderStages": [{"stage": "ordered", "count": 3}],
 "shipmentsByStatus": [{"status": "new", "count": 2}],
 "ordersPerDay": [{"date": "2026-10-13", "count": 1}],
 "escrowByType": [{"type": "held", "entries": 16, "amount": "937400.00"}],
 "kycPending": {"gst": 0, "pan": 0, "cheque": 0}}
```

Definitions: totals and distributions are current-state counts from stored rows;
`last30Days` is a rolling 30×24-hour UTC window; `ordersPerDay` is 30 UTC
calendar buckets ending today; escrow amounts are exact `SUM(Decimal)` strings
(all-time, grouped by the stored `EscrowEntry.type`); `kycPending` counts each
stored KYC flag independently (no overall approval status exists). No revenue,
GMV, active-user, conversion, payout or dispute metric is produced. The read
writes one `admin.overview.read` row (`targetType="AdminOverview"`) in the same
transaction. Consumed by `/admin`.

### Finance (seller-collected COD)

Seller-collected COD finance domain (WP-1). The customer pays the seller directly;
Constro-Well never custodies COD proceeds. Money is exact 2-decimal strings; commission
is policy-driven and fails closed. All financial writes are audited via the append-only
`AuditEvent`. Tables are owned by Prisma migration
`20261110222135_add_seller_collected_cod_finance`.

- Seller (`require_seller`): `GET /api/seller/finance/statement` (collections, commission,
  remittances, adjustments, legacy escrow), `GET/POST /api/seller/finance/collections` +
  `.../collections/{shipment_id}/confirm`, `GET/POST /api/seller/finance/remittances`,
  `GET/POST /api/seller/finance/adjustments`.
- Driver (seller's agent, `require_driver`): `POST /api/driver/finance/collections/{shipment_id}/confirm`.
- Admin (`require_admin`): `GET /api/admin/finance/collections/discrepancies`,
  `POST .../collections/{id}/dispute`, `POST .../assessments/{shipment_id}`,
  `POST .../assessments/{id}/waive`, `POST .../remittances/{id}/verify|fail|return`,
  `POST .../remittances/{id}/allocations`, `GET .../remittances/{id}/allocations`,
  `POST .../allocations/{id}/reverse`, `POST .../adjustments/{id}/apply|reverse`,
  `POST .../policies`, `GET .../sellers/{seller_id}/statement`.

Accounting identities (all Decimal): `outstandingCommission = assessed − netAllocated +
netAdjustments`; `unallocatedRemittance = verifiedRemittances − netAllocations`. A
remittance is platform cash only after `received` (admin-verified), never on `initiated`.

### Authentication (read side)

`GET /api/auth/me` returns `{"user": {id, email, name, phone, role}}` — the same
contract as the Next.js route — and validates the existing `cw_session` cookie
against the shared `Session` table (SHA-256 token digest, strict expiry, UTC-safe).
Password hashes are bcrypt and verify unchanged. Login, registration and logout
remain in Next.js; this service does not issue or revoke sessions yet.

Reusable dependencies in `fastapi_app/core/security.py`: `require_user`,
`require_customer`, `require_seller` → `(user, seller)`, `require_driver` →
`(user, driver)`, `require_admin`, `require_role(*roles)`. They reproduce
`src/server/auth/current.ts`: `401 unauthenticated`, `403 forbidden`,
`403 seller_profile_missing` / `driver_profile_missing`.

## Tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

`test_db_health.py` runs against the real local PostgreSQL and is skipped when
`DATABASE_URL` is not set.

## Conventions

- Error responses match the existing Next.js envelope: `{"error": {"code", "message", "field"?}}`.
- Logs are single-line JSON and include a per-request `x-request-id`.
- CORS allows the Next.js frontend origin(s) from `CORS_ORIGINS`.
