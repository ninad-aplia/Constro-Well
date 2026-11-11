-- WP-1B finance hardening.
--
-- The partial unique index on (remittanceId, assessmentId) WHERE kind='allocation'
-- (added in migration 20261110222135_add_seller_collected_cod_finance) was too
-- strict: it blocked legitimate repeated *partial* allocations of one remittance
-- against one assessment. Correctness is now enforced by the allocation
-- transaction's row locks (`SELECT ... FOR UPDATE` on the remittance and the
-- assessment) plus its balance re-checks, so the uniqueness index is redundant
-- and harmful. Dropping it is non-destructive (an index is derived data) and
-- preserves every existing row.
--
-- Reversals are unaffected: each reversal still references the specific
-- allocation row it compensates (`reversesId`), so repeated partial allocations
-- and their individual reversals coexist safely.

DROP INDEX IF EXISTS "RemittanceAllocation_one_open_per_pair";
