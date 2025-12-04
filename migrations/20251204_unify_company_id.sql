-- Migration: Unify company_id format in WhatsApp tables
-- Date: 2025-12-04
-- Updated: 2025-12-04 (Added transaction wrapper and automated verification)
-- Purpose: Ensure all company_id values use prefixed format "company_{salon_id}"
--
-- Background:
-- - Marketplace onboarding uses "company_962302" format
-- - Baileys standalone service was using "962302" format
-- - This caused duplicate credentials in whatsapp_auth and whatsapp_keys
--
-- Solution:
-- 1. Convert all numeric company_ids to prefixed format
-- 2. Remove duplicates (keep the newer record)
--
-- IMPORTANT: This migration runs in a transaction for atomicity
-- If any step fails, ALL changes are rolled back automatically

-- ============================================
-- BEGIN TRANSACTION
-- ============================================
BEGIN;

-- ============================================
-- STEP 1: Enforce backup exists (safety check)
-- ============================================
DO $$
BEGIN
  -- Check if backups exist (they should be created manually before running)
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'whatsapp_auth_backup_20251204') THEN
    -- Auto-create backup if not exists
    EXECUTE 'CREATE TABLE whatsapp_auth_backup_20251204 AS SELECT * FROM whatsapp_auth';
    RAISE NOTICE 'Auto-created backup: whatsapp_auth_backup_20251204';
  ELSE
    RAISE NOTICE 'Backup exists: whatsapp_auth_backup_20251204';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'whatsapp_keys_backup_20251204') THEN
    -- Auto-create backup if not exists
    EXECUTE 'CREATE TABLE whatsapp_keys_backup_20251204 AS SELECT * FROM whatsapp_keys';
    RAISE NOTICE 'Auto-created backup: whatsapp_keys_backup_20251204';
  ELSE
    RAISE NOTICE 'Backup exists: whatsapp_keys_backup_20251204';
  END IF;
END $$;

-- ============================================
-- STEP 2: Check current state (diagnostic - logged only)
-- ============================================
DO $$
DECLARE
  auth_count INTEGER;
  keys_count INTEGER;
  numeric_auth INTEGER;
  numeric_keys INTEGER;
BEGIN
  SELECT COUNT(*) INTO auth_count FROM whatsapp_auth;
  SELECT COUNT(*) INTO keys_count FROM whatsapp_keys;
  SELECT COUNT(*) INTO numeric_auth FROM whatsapp_auth WHERE company_id ~ '^[0-9]+$';
  SELECT COUNT(*) INTO numeric_keys FROM whatsapp_keys WHERE company_id ~ '^[0-9]+$';

  RAISE NOTICE 'PRE-MIGRATION STATE:';
  RAISE NOTICE '  whatsapp_auth: % total, % numeric format', auth_count, numeric_auth;
  RAISE NOTICE '  whatsapp_keys: % total, % numeric format', keys_count, numeric_keys;
END $$;

-- ============================================
-- STEP 3: For whatsapp_auth - identify and remove duplicates
-- ============================================
-- Duplicates exist when we have both "962302" and "company_962302"
-- Strategy: Delete the OLDER numeric format record if prefixed exists

-- Delete numeric format records where prefixed version exists (keep prefixed)
DELETE FROM whatsapp_auth
WHERE company_id NOT LIKE 'company_%'
  AND company_id ~ '^[0-9]+$'
  AND EXISTS (
    SELECT 1 FROM whatsapp_auth wa2
    WHERE wa2.company_id = CONCAT('company_', whatsapp_auth.company_id)
  );

-- Convert remaining numeric-only company_ids to prefixed format
UPDATE whatsapp_auth
SET company_id = CONCAT('company_', company_id)
WHERE company_id NOT LIKE 'company_%'
  AND company_id ~ '^[0-9]+$';

-- ============================================
-- STEP 4: For whatsapp_keys - handle duplicates
-- ============================================
-- Similar strategy: delete numeric format if prefixed exists

DELETE FROM whatsapp_keys
WHERE company_id NOT LIKE 'company_%'
  AND company_id ~ '^[0-9]+$'
  AND EXISTS (
    SELECT 1 FROM whatsapp_keys wk2
    WHERE wk2.company_id = CONCAT('company_', whatsapp_keys.company_id)
      AND wk2.key_id = whatsapp_keys.key_id
  );

-- Convert remaining numeric-only company_ids to prefixed format
UPDATE whatsapp_keys
SET company_id = CONCAT('company_', company_id)
WHERE company_id NOT LIKE 'company_%'
  AND company_id ~ '^[0-9]+$';

-- ============================================
-- STEP 5: Automated verification (FAILS transaction if invalid)
-- ============================================
DO $$
DECLARE
  numeric_auth_count INTEGER;
  numeric_keys_count INTEGER;
  duplicate_auth_count INTEGER;
  duplicate_keys_count INTEGER;
  final_auth_count INTEGER;
  final_keys_count INTEGER;
BEGIN
  -- Check for remaining numeric format IDs
  SELECT COUNT(*) INTO numeric_auth_count
  FROM whatsapp_auth
  WHERE company_id ~ '^[0-9]+$';

  SELECT COUNT(*) INTO numeric_keys_count
  FROM whatsapp_keys
  WHERE company_id ~ '^[0-9]+$';

  -- Check for duplicates (multiple records per company_id)
  SELECT COUNT(*) INTO duplicate_auth_count
  FROM (
    SELECT company_id
    FROM whatsapp_auth
    GROUP BY company_id
    HAVING COUNT(*) > 1
  ) AS dups;

  SELECT COUNT(*) INTO duplicate_keys_count
  FROM (
    SELECT company_id, key_id
    FROM whatsapp_keys
    GROUP BY company_id, key_id
    HAVING COUNT(*) > 1
  ) AS dups;

  -- Final counts
  SELECT COUNT(*) INTO final_auth_count FROM whatsapp_auth;
  SELECT COUNT(*) INTO final_keys_count FROM whatsapp_keys;

  -- Report final state
  RAISE NOTICE 'POST-MIGRATION STATE:';
  RAISE NOTICE '  whatsapp_auth: % total', final_auth_count;
  RAISE NOTICE '  whatsapp_keys: % total', final_keys_count;

  -- FAIL if migration is incomplete
  IF numeric_auth_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION FAILED: % numeric company_ids remain in whatsapp_auth', numeric_auth_count;
  END IF;

  IF numeric_keys_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION FAILED: % numeric company_ids remain in whatsapp_keys', numeric_keys_count;
  END IF;

  IF duplicate_auth_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION FAILED: % duplicate company_ids in whatsapp_auth', duplicate_auth_count;
  END IF;

  IF duplicate_keys_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION FAILED: % duplicate (company_id, key_id) pairs in whatsapp_keys', duplicate_keys_count;
  END IF;

  RAISE NOTICE '✅ MIGRATION VERIFIED: All company_ids prefixed, no duplicates';
END $$;

-- ============================================
-- COMMIT TRANSACTION
-- ============================================
COMMIT;

-- ============================================
-- POST-MIGRATION VERIFICATION (manual, after commit)
-- ============================================
-- Run these queries to verify the migration worked:
--
-- SELECT company_id, COUNT(*) as count FROM whatsapp_auth GROUP BY company_id;
-- SELECT company_id, COUNT(*) as count FROM whatsapp_keys GROUP BY company_id;
--
-- Expected: All company_ids should start with "company_" and no duplicates

-- ============================================
-- ROLLBACK (if needed - run manually)
-- ============================================
-- If migration succeeded but you need to rollback:
--
-- DROP TABLE IF EXISTS whatsapp_auth;
-- ALTER TABLE whatsapp_auth_backup_20251204 RENAME TO whatsapp_auth;
--
-- DROP TABLE IF EXISTS whatsapp_keys;
-- ALTER TABLE whatsapp_keys_backup_20251204 RENAME TO whatsapp_keys;
