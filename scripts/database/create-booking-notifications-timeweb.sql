-- Migration: Create booking_notifications table
-- Database: Timeweb PostgreSQL
-- Date: 2025-11-25
-- Purpose: Track sent notifications to prevent duplicate reminders

CREATE TABLE IF NOT EXISTS booking_notifications (
    id SERIAL PRIMARY KEY,

    -- Identifiers
    yclients_record_id INTEGER NOT NULL,
    company_id INTEGER NOT NULL,
    phone VARCHAR(20) NOT NULL,

    -- Notification data
    notification_type VARCHAR(50) NOT NULL,
    message TEXT,

    -- Status
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'sent',
    error_message TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRITICAL: Composite UNIQUE to prevent duplicates at DB level
-- One notification of each type per record per company per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_bn_unique_notification
  ON booking_notifications(yclients_record_id, notification_type, company_id, DATE(sent_at));

-- Index for duplicate checking (main use case)
CREATE INDEX IF NOT EXISTS idx_bn_duplicate_check
  ON booking_notifications(yclients_record_id, notification_type, sent_at DESC);

-- Helper indexes
CREATE INDEX IF NOT EXISTS idx_bn_company ON booking_notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_bn_phone ON booking_notifications(phone);
CREATE INDEX IF NOT EXISTS idx_bn_sent_at ON booking_notifications(sent_at DESC);

-- Partial index for recent records (optimization)
CREATE INDEX IF NOT EXISTS idx_bn_recent_by_record
  ON booking_notifications(yclients_record_id, notification_type, sent_at DESC)
  WHERE sent_at > NOW() - INTERVAL '7 days';

-- Verify creation
SELECT 'Table booking_notifications created successfully' AS status;
