-- Append-only administrative audit trail (TASK 9.6).
--
-- Additive only: one new table, its foreign key and indexes. No existing table
-- or column is altered. Prisma remains the migration authority; this file is
-- prepared for owner review and MUST NOT be applied without explicit approval.
--
-- Immutability is enforced at the database level (not by convention):
--   * INSERT is allowed.
--   * UPDATE and DELETE are rejected per row.
--   * TRUNCATE is rejected per statement (row triggers do not fire on TRUNCATE).
-- Raising an exception aborts the surrounding transaction normally, so a
-- rolled-back transaction leaves no audit row and no partial change behind.

CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditEvent_actorUserId_createdAt_idx" ON "AuditEvent"("actorUserId", "createdAt");
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");
CREATE INDEX "AuditEvent_targetType_targetId_createdAt_idx" ON "AuditEvent"("targetType", "targetId", "createdAt");
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

ALTER TABLE "AuditEvent"
  ADD CONSTRAINT "AuditEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Append-only enforcement --------------------------------------------------
-- Shared by the row-level (UPDATE/DELETE) and statement-level (TRUNCATE)
-- triggers. DELETE is also blocked at the FK level from the User side
-- (ON DELETE RESTRICT), so audit rows survive actor deletion attempts.

CREATE OR REPLACE FUNCTION "AuditEvent_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'AuditEvent is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS "AuditEvent_append_only" ON "AuditEvent";
CREATE TRIGGER "AuditEvent_append_only"
  BEFORE UPDATE OR DELETE ON "AuditEvent"
  FOR EACH ROW EXECUTE FUNCTION "AuditEvent_append_only"();

DROP TRIGGER IF EXISTS "AuditEvent_no_truncate" ON "AuditEvent";
CREATE TRIGGER "AuditEvent_no_truncate"
  BEFORE TRUNCATE ON "AuditEvent"
  FOR EACH STATEMENT EXECUTE FUNCTION "AuditEvent_append_only"();
