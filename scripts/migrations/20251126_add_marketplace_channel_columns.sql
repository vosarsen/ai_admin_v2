-- Migration: Add marketplace channel columns to companies table
-- Date: 2025-11-26
-- Phase 5 of yclients-marketplace-full-integration
-- These columns support notification channel management via YClients Marketplace API

-- Add subscription expiration tracking
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- Add channel status flags (default: whatsapp on, sms off)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_channel_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sms_channel_enabled BOOLEAN DEFAULT FALSE;

-- Add SMS sender names (array of approved short names)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sms_short_names TEXT[];

-- Add disconnected_at timestamp for tracking when companies disconnect
ALTER TABLE companies ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ;

-- Add status column for better state tracking
ALTER TABLE companies ADD COLUMN IF NOT EXISTS status VARCHAR(50);

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_subscription_expires ON companies(subscription_expires_at);

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'companies'
AND column_name IN ('subscription_expires_at', 'whatsapp_channel_enabled', 'sms_channel_enabled', 'sms_short_names', 'disconnected_at', 'status')
ORDER BY column_name;

-- =====================
-- ROLLBACK INSTRUCTIONS
-- =====================
-- To rollback this migration, run the following commands:
--
-- WARNING: This will permanently delete data in these columns!
-- Make sure to backup any important data before running rollback.
--
-- Step 1: Drop indexes
-- DROP INDEX IF EXISTS idx_companies_status;
-- DROP INDEX IF EXISTS idx_companies_subscription_expires;
--
-- Step 2: Drop columns (in reverse order of creation)
-- ALTER TABLE companies DROP COLUMN IF EXISTS status;
-- ALTER TABLE companies DROP COLUMN IF EXISTS disconnected_at;
-- ALTER TABLE companies DROP COLUMN IF EXISTS sms_short_names;
-- ALTER TABLE companies DROP COLUMN IF EXISTS sms_channel_enabled;
-- ALTER TABLE companies DROP COLUMN IF EXISTS whatsapp_channel_enabled;
-- ALTER TABLE companies DROP COLUMN IF EXISTS subscription_expires_at;
--
-- Step 3: Verify rollback (should return 0 rows)
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'companies'
-- AND column_name IN ('subscription_expires_at', 'whatsapp_channel_enabled',
--                     'sms_channel_enabled', 'sms_short_names',
--                     'disconnected_at', 'status');
--
-- =====================
-- END ROLLBACK SECTION
-- =====================
