# AuditEvent — append-only administrative audit trail

**Status: prepared and design-approved (TASK 9.6). Nothing has been applied.**
Prisma remains the sole schema-migration authority; no Alembic is involved.

## Approved owner decisions

1. Append-only is enforced by PostgreSQL triggers, accepting that a database
   owner/superuser can still disable them.
2. The three original indexes are retained.
3. A standalone `createdAt` index is added for chronological audit history.
4. Action identifiers follow `admin.<resource>.<verb>` (e.g. `admin.users.list`).
5. The actor foreign key is `ON DELETE RESTRICT ON UPDATE RESTRICT`.

## Why

The Task 9.6 admin slice must record administrative activity, and a failed
audit write must not silently produce an unaudited success. No audit model
existed (`ShipmentEvent` is shipment-scoped and has no admin actor), so the
owner approved adding this table via a Prisma migration.

## Model

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` (cuid) | primary key |
| `actorUserId` | `TEXT` | FK → `User.id`; `ON DELETE RESTRICT ON UPDATE RESTRICT` (audit history outlives the actor row and blocks deleting an actor with history) |
| `action` | `TEXT` | machine-readable, e.g. `admin.users.list` |
| `targetType` | `TEXT` | resource type, e.g. `User` |
| `targetId` | `TEXT NULL` | optional affected record |
| `metadata` | `JSONB NULL` | small, non-sensitive context only — never credentials, tokens, request bodies or unnecessary personal data |
| `createdAt` | `TIMESTAMP(3)` default `CURRENT_TIMESTAMP` | matches every other table's timestamp convention |

Indexes: `(actorUserId, createdAt)`, `(action, createdAt)`,
`(targetType, targetId, createdAt)`, `(createdAt)`.

## Immutability strategy

Enforced in PostgreSQL, not by convention:

- `INSERT`: allowed (no trigger on insert).
- `UPDATE` / `DELETE`: rejected by a `BEFORE ... FOR EACH ROW` trigger that
  raises `insufficient_privilege`.
- `TRUNCATE`: rejected by a `BEFORE TRUNCATE ... FOR EACH STATEMENT` trigger
  (row triggers do not fire on TRUNCATE).

Raising an exception aborts the surrounding transaction, so it composes with
normal rollback: a failed admin operation leaves neither a business change nor
an audit row.

## Limits — read before relying on this

1. **Superuser/owner can still disable or drop the trigger** (`ALTER TABLE ...
   DISABLE TRIGGER`, `DROP TRIGGER`, `DROP TABLE`). No in-database mechanism can
   prevent a privileged operator; this is a guardrail, not cryptographic proof.
2. `prisma migrate reset` recreates the schema from migration history and
   **would include** this trigger (it is part of the migration SQL), but
   `prisma db push` diffs the schema and would **not** recreate it. The project
   already uses `migrate dev`/`migrate deploy` only — do not introduce `db push`.
3. Prisma Client cannot see triggers; deleting/updating via Prisma will fail at
   runtime with a PostgreSQL error. That is intended.
4. `metadata` is `JSONB` and unvalidated at the database level; the writing
   service must keep it minimal. No PII beyond IDs.
5. No retention/purge policy exists. Because DELETE is blocked, retention (if
   ever required) needs a deliberate, separately-approved procedure (e.g. a
   partition-drop or a reviewed migration), not an application delete.

## Application-side contract (when Task 9.6 resumes)

- Insert the audit row in the **same transaction** as the admin operation, or
  perform the audit insert first and fail closed if it errors.
- Action identifiers follow the approved `admin.<resource>.<verb>` convention
  (e.g. `admin.users.list`, `admin.sellers.list`).
- Actor is always `require_admin()`'s user id — never a client-supplied value.

## Review checklist

- [x] Columns/indexes/FK semantics approved by the owner.
- [x] Trigger-based append-only enforcement approved (limits above acknowledged).
- [x] Migration timestamp/name ordering accepted.
- [x] Operational rule: `db push` is never used; migrations are authoritative.
- [ ] Apply the migration (`npx prisma migrate dev` locally, or
      `migrate deploy` in the target environment) — **not done; awaiting the
      explicit apply approval for Task 9.6 implementation.**
