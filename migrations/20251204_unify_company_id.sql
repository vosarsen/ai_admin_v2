-- Migration: Unify company_id format in WhatsApp tables
-- Date: 2025-12-04
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

-- ============================================
-- STEP 1: Backup (run manually if needed)
-- ============================================
-- CREATE TABLE whatsapp_auth_backup_20251204 AS SELECT * FROM whatsapp_auth;
-- CREATE TABLE whatsapp_keys_backup_20251204 AS SELECT * FROM whatsapp_keys;

-- ============================================
-- STEP 2: Check current state (diagnostic)
-- ============================================
-- SELECT company_id, created_at FROM whatsapp_auth ORDER BY company_id;
-- SELECT DISTINCT company_id FROM whatsapp_keys ORDER BY company_id;

-- ============================================
-- STEP 3: For whatsapp_auth - identify duplicates
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
-- STEP 5: Verify (run after migration)
-- ============================================
-- SELECT company_id, COUNT(*) as count FROM whatsapp_auth GROUP BY company_id;
-- SELECT company_id, COUNT(*) as count FROM whatsapp_keys GROUP BY company_id;
--
-- Expected: All company_ids should start with "company_" and no duplicates

-- ============================================
-- ROLLBACK (if needed)
-- ============================================
-- DROP TABLE whatsapp_auth;
-- ALTER TABLE whatsapp_auth_backup_20251204 RENAME TO whatsapp_auth;
--
-- DROP TABLE whatsapp_keys;
-- ALTER TABLE whatsapp_keys_backup_20251204 RENAME TO whatsapp_keys;
