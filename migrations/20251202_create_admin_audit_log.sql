-- Migration: Create admin_audit_log table
-- Purpose: Track all admin actions for security and compliance
-- Date: 2025-12-02
-- Project: marketplace-code-improvements (Task 2.1)

-- ============================
-- CREATE TABLE
-- ============================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id SERIAL PRIMARY KEY,

  -- Admin identification
  admin_id VARCHAR(255),           -- Admin user ID (from JWT or 'api_key' for API key auth)
  admin_role VARCHAR(50),          -- Role: admin, superadmin, marketplace_admin
  admin_email VARCHAR(255),        -- Admin email for reference
  auth_method VARCHAR(20),         -- jwt, api_key, basic

  -- Action details
  action VARCHAR(100) NOT NULL,    -- e.g., 'disconnect_salon', 'generate_payment_link'
  resource_type VARCHAR(50),       -- e.g., 'salon', 'company', 'payment'
  resource_id VARCHAR(255),        -- e.g., salon_id, company_id

  -- Request context
  ip_address VARCHAR(45),          -- IPv4 or IPv6
  user_agent TEXT,
  request_path VARCHAR(500),
  request_method VARCHAR(10),
  request_body JSONB,              -- Sanitized (no passwords, tokens, api_keys)

  -- Response info
  response_status INTEGER,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================
-- INDEXES
-- ============================

-- Composite index for common lookup queries:
-- "Show me all actions by admin X on resource Y"
CREATE INDEX idx_admin_audit_lookup
  ON admin_audit_log (admin_id, action, created_at DESC);

-- Index for resource-based queries:
-- "Show me all actions on salon 997441"
CREATE INDEX idx_admin_audit_resource
  ON admin_audit_log (resource_type, resource_id, created_at DESC);

-- Index for cleanup job (delete old records):
-- "Delete all records older than 90 days"
CREATE INDEX idx_admin_audit_cleanup
  ON admin_audit_log (created_at);

-- ============================
-- COMMENTS
-- ============================
COMMENT ON TABLE admin_audit_log IS 'Tracks all admin actions for security audit and compliance';
COMMENT ON COLUMN admin_audit_log.admin_id IS 'Admin user ID from JWT, or "api_key" for API key auth';
COMMENT ON COLUMN admin_audit_log.request_body IS 'Sanitized request body (sensitive fields removed)';
COMMENT ON COLUMN admin_audit_log.created_at IS 'Timestamp of the action (used for 90-day retention)';

-- ============================
-- ROLLBACK SQL (keep in comments for reference)
-- ============================
-- DROP INDEX IF EXISTS idx_admin_audit_cleanup;
-- DROP INDEX IF EXISTS idx_admin_audit_resource;
-- DROP INDEX IF EXISTS idx_admin_audit_lookup;
-- DROP TABLE IF EXISTS admin_audit_log;
