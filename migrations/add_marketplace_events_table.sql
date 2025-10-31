-- Migration: Add marketplace_events table
-- Date: 2025-10-03
-- Purpose: Track YClients Marketplace integration events

-- Create marketplace_events table
CREATE TABLE IF NOT EXISTS marketplace_events (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
  salon_id INTEGER NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketplace_events_company_id ON marketplace_events(company_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_events_salon_id ON marketplace_events(salon_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_events_type ON marketplace_events(event_type);
CREATE INDEX IF NOT EXISTS idx_marketplace_events_created_at ON marketplace_events(created_at DESC);

-- Add comments
COMMENT ON TABLE marketplace_events IS 'Tracks all events from YClients Marketplace integration';
COMMENT ON COLUMN marketplace_events.company_id IS 'Reference to companies table';
COMMENT ON COLUMN marketplace_events.salon_id IS 'YClients salon ID';
COMMENT ON COLUMN marketplace_events.event_type IS 'Type of event: registration_started, integration_activated, uninstall, freeze, payment';
COMMENT ON COLUMN marketplace_events.event_data IS 'JSON data associated with the event';
