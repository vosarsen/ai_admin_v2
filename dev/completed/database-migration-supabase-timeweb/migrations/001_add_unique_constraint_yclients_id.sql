-- Migration: Add UNIQUE constraint to clients.yclients_id
-- Date: 2025-11-11
-- Reason: Enable upsert operations with ON CONFLICT (yclients_id) clause
--         Required for BaseRepository.upsert() and BaseRepository.bulkUpsert()
--
-- Pre-migration verification:
-- - Checked for NULL values: 0 found ✅
-- - Checked for duplicates: 0 found ✅
-- - Total clients: 1304
-- - All yclients_id values are unique
--
-- Impact: Low risk - no data changes, only adds constraint
-- Rollback: DROP INDEX idx_clients_yclients_id; CREATE INDEX idx_clients_yclients_id ON clients (yclients_id);

BEGIN;

-- Drop the old regular index
DROP INDEX IF EXISTS idx_clients_yclients_id;

-- Create UNIQUE index (this also serves as a constraint)
CREATE UNIQUE INDEX idx_clients_yclients_id ON clients (yclients_id);

-- Verify the index is UNIQUE
DO $$
DECLARE
  is_unique BOOLEAN;
BEGIN
  SELECT indisunique INTO is_unique
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  WHERE c.relname = 'idx_clients_yclients_id';

  IF NOT is_unique THEN
    RAISE EXCEPTION 'Index idx_clients_yclients_id is not UNIQUE!';
  END IF;

  RAISE NOTICE 'UNIQUE constraint verified successfully ✅';
END $$;

COMMIT;

-- Post-migration verification queries:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'clients' AND indexname = 'idx_clients_yclients_id';
-- Expected: CREATE UNIQUE INDEX idx_clients_yclients_id ON public.clients USING btree (yclients_id)
