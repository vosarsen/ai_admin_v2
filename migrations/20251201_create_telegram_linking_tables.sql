-- Migration: Create Telegram Linking Tables
-- Date: 2025-12-01
-- Purpose: Enable multi-tenant Telegram linking via deep links
--
-- This migration creates tables for:
-- 1. telegram_linking_codes - Audit table for generated deep link codes
-- 2. telegram_user_company_links - Permanent user-to-company associations
--
-- Flow:
-- 1. Admin generates deep link code → stored in Redis (15 min TTL) + DB audit
-- 2. Salon owner clicks link → confirms in bot → permanent link created
-- 3. Telegram Business connection event → Manager looks up company by user_id

-- Table: telegram_linking_codes
-- Stores generated linking codes for audit/tracking
-- Primary storage is Redis (15 min TTL), this is for history/debugging
CREATE TABLE IF NOT EXISTS telegram_linking_codes (
  id SERIAL PRIMARY KEY,

  -- The unique code (base64url, ~14 chars)
  code VARCHAR(20) UNIQUE NOT NULL,

  -- Company this code links to
  company_id INTEGER NOT NULL,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending',  -- pending, used, expired, revoked

  -- Expiration
  expires_at TIMESTAMPTZ NOT NULL,

  -- Usage tracking (filled when consumed)
  used_at TIMESTAMPTZ,
  used_by_telegram_id BIGINT,
  used_by_username VARCHAR(255),

  -- Audit
  created_by VARCHAR(255) DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign key to companies table
  CONSTRAINT fk_linking_codes_company
    FOREIGN KEY (company_id)
    REFERENCES companies(id)
    ON DELETE CASCADE
);

-- Table: telegram_user_company_links
-- Permanent mapping between Telegram user and company
-- Used to resolve company_id when handling business_connection events
CREATE TABLE IF NOT EXISTS telegram_user_company_links (
  id SERIAL PRIMARY KEY,

  -- Telegram user identity
  telegram_user_id BIGINT UNIQUE NOT NULL,
  telegram_username VARCHAR(255),

  -- Linked company
  company_id INTEGER NOT NULL,

  -- Link metadata
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  linked_via_code VARCHAR(20),  -- Reference to the code used

  -- Status (for soft deactivation during re-linking)
  is_active BOOLEAN DEFAULT true,

  -- Standard timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign key to companies table
  CONSTRAINT fk_user_links_company
    FOREIGN KEY (company_id)
    REFERENCES companies(id)
    ON DELETE CASCADE
);

-- Index for fast code lookup (primary use case)
CREATE INDEX IF NOT EXISTS idx_linking_codes_code
  ON telegram_linking_codes(code);

-- Index for finding pending codes by company
CREATE INDEX IF NOT EXISTS idx_linking_codes_company_pending
  ON telegram_linking_codes(company_id)
  WHERE status = 'pending';

-- Index for company lookup (to check if code exists)
CREATE INDEX IF NOT EXISTS idx_linking_codes_company
  ON telegram_linking_codes(company_id);

-- Index for Telegram user lookup (the main query path)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_links_telegram_id
  ON telegram_user_company_links(telegram_user_id);

-- Index for company lookup in user links
CREATE INDEX IF NOT EXISTS idx_user_links_company
  ON telegram_user_company_links(company_id);

-- Index for active links only
CREATE INDEX IF NOT EXISTS idx_user_links_active
  ON telegram_user_company_links(is_active)
  WHERE is_active = true;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_telegram_linking_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at on user links
DROP TRIGGER IF EXISTS trigger_user_links_updated ON telegram_user_company_links;
CREATE TRIGGER trigger_user_links_updated
  BEFORE UPDATE ON telegram_user_company_links
  FOR EACH ROW
  EXECUTE FUNCTION update_telegram_linking_timestamp();

-- Comments for documentation
COMMENT ON TABLE telegram_linking_codes IS 'Audit table for Telegram deep link codes (primary storage in Redis)';
COMMENT ON COLUMN telegram_linking_codes.code IS 'Base64url encoded code from crypto.randomBytes(10)';
COMMENT ON COLUMN telegram_linking_codes.status IS 'pending=active, used=consumed, expired=TTL exceeded, revoked=manually cancelled';

COMMENT ON TABLE telegram_user_company_links IS 'Permanent Telegram user to company mappings for multi-tenant support';
COMMENT ON COLUMN telegram_user_company_links.telegram_user_id IS 'Telegram user ID (from ctx.from.id)';
COMMENT ON COLUMN telegram_user_company_links.is_active IS 'Allows soft deactivation when user re-links to different company';
