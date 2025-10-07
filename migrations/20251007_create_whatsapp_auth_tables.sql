-- Migration: Create WhatsApp Auth State tables for Baileys
-- Date: 2025-10-07
-- Purpose: Replace useMultiFileAuthState with database-backed storage

-- =============================================================================
-- 1. whatsapp_auth - Stores authentication credentials (creds.json)
-- =============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_auth (
  company_id TEXT PRIMARY KEY,
  creds JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_auth_company
  ON whatsapp_auth(company_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_whatsapp_auth_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_whatsapp_auth_updated_at
  BEFORE UPDATE ON whatsapp_auth
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_auth_updated_at();

-- Comment
COMMENT ON TABLE whatsapp_auth IS 'WhatsApp authentication credentials for Baileys sessions';
COMMENT ON COLUMN whatsapp_auth.company_id IS 'Company ID (e.g., 962302)';
COMMENT ON COLUMN whatsapp_auth.creds IS 'Baileys credentials object (creds.json content)';

-- =============================================================================
-- 2. whatsapp_keys - Stores all keys (app-state-sync, lid-mapping, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_keys (
  company_id TEXT NOT NULL,
  key_type TEXT NOT NULL,      -- 'app-state-sync-key', 'lid-mapping', 'session', etc.
  key_id TEXT NOT NULL,         -- 'AAAAAK6J', '79265686288', etc.
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,       -- For automatic cleanup (TTL)

  PRIMARY KEY (company_id, key_type, key_id)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_keys_company
  ON whatsapp_keys(company_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_keys_type
  ON whatsapp_keys(key_type);

CREATE INDEX IF NOT EXISTS idx_whatsapp_keys_expires
  ON whatsapp_keys(expires_at)
  WHERE expires_at IS NOT NULL;

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_whatsapp_keys_company_type
  ON whatsapp_keys(company_id, key_type);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_whatsapp_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_whatsapp_keys_updated_at
  BEFORE UPDATE ON whatsapp_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_keys_updated_at();

-- Comments
COMMENT ON TABLE whatsapp_keys IS 'WhatsApp session keys including Signal Protocol keys and LID mappings';
COMMENT ON COLUMN whatsapp_keys.company_id IS 'Company ID';
COMMENT ON COLUMN whatsapp_keys.key_type IS 'Type of key (app-state-sync-key, lid-mapping, session, etc.)';
COMMENT ON COLUMN whatsapp_keys.key_id IS 'Unique identifier for this key';
COMMENT ON COLUMN whatsapp_keys.value IS 'Key value (JSONB)';
COMMENT ON COLUMN whatsapp_keys.expires_at IS 'TTL expiration timestamp (NULL = never expires)';

-- =============================================================================
-- 3. Automatic cleanup function for expired keys
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_whatsapp_keys()
RETURNS TABLE(deleted_count BIGINT) AS $$
DECLARE
  result_count BIGINT;
BEGIN
  -- Delete expired keys
  WITH deleted AS (
    DELETE FROM whatsapp_keys
    WHERE expires_at IS NOT NULL
      AND expires_at < NOW()
    RETURNING *
  )
  SELECT COUNT(*) INTO result_count FROM deleted;

  -- Return count for logging
  RETURN QUERY SELECT result_count;

  -- Log to postgres logs
  RAISE NOTICE 'Cleaned up % expired WhatsApp keys', result_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_whatsapp_keys() IS 'Deletes expired keys from whatsapp_keys table';

-- =============================================================================
-- 4. Optional: pg_cron job for automatic cleanup (if available)
-- =============================================================================

-- NOTE: This requires pg_cron extension to be enabled in Supabase
-- If pg_cron is not available, use application-level cleanup instead
-- See: src/services/whatsapp/database-cleanup.js

-- Uncomment if pg_cron is available:
-- SELECT cron.schedule(
--   'cleanup-whatsapp-keys',
--   '0 */6 * * *',  -- Every 6 hours
--   $$SELECT cleanup_expired_whatsapp_keys()$$
-- );

-- =============================================================================
-- 5. Helper function: Get database statistics
-- =============================================================================

CREATE OR REPLACE FUNCTION get_whatsapp_auth_stats()
RETURNS TABLE(
  total_companies BIGINT,
  total_keys BIGINT,
  expired_keys BIGINT,
  active_keys BIGINT,
  db_size_bytes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM whatsapp_auth),
    (SELECT COUNT(*) FROM whatsapp_keys),
    (SELECT COUNT(*) FROM whatsapp_keys WHERE expires_at IS NOT NULL AND expires_at < NOW()),
    (SELECT COUNT(*) FROM whatsapp_keys WHERE expires_at IS NULL OR expires_at >= NOW()),
    pg_total_relation_size('whatsapp_auth') + pg_total_relation_size('whatsapp_keys');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_whatsapp_auth_stats() IS 'Returns statistics about WhatsApp auth state storage';

-- =============================================================================
-- 6. Row Level Security (RLS) - Optional but recommended
-- =============================================================================

-- Enable RLS
ALTER TABLE whatsapp_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for service role (backend)
-- Adjust these policies based on your security requirements
CREATE POLICY "Allow service role full access to whatsapp_auth"
  ON whatsapp_auth
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to whatsapp_keys"
  ON whatsapp_keys
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- Migration complete!
-- =============================================================================

-- Verify tables created
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'whatsapp_auth') THEN
    RAISE NOTICE '✅ Table whatsapp_auth created successfully';
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'whatsapp_keys') THEN
    RAISE NOTICE '✅ Table whatsapp_keys created successfully';
  END IF;

  RAISE NOTICE '✅ Migration completed successfully!';
END $$;
