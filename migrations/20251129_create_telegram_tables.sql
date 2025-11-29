-- Migration: Create Telegram Business Connection tables
-- Date: 2025-11-29
-- Purpose: Support Telegram Business Bot integration for AI Admin v2

-- Table: telegram_business_connections
-- Stores Telegram Business Bot connections for each company/salon
-- When salon owner connects their Telegram account via Business Mode,
-- we store the connection details here

CREATE TABLE IF NOT EXISTS telegram_business_connections (
  id SERIAL PRIMARY KEY,

  -- Company reference
  company_id INTEGER NOT NULL,

  -- Telegram Business Connection data
  business_connection_id VARCHAR(255) UNIQUE NOT NULL,
  telegram_user_id BIGINT NOT NULL,
  telegram_username VARCHAR(255),
  telegram_first_name VARCHAR(255),

  -- Connection status
  can_reply BOOLEAN DEFAULT false,  -- Whether bot can reply in this connection
  is_active BOOLEAN DEFAULT true,   -- Whether connection is currently active

  -- Timestamps
  connected_at TIMESTAMP DEFAULT NOW(),
  disconnected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Foreign key to companies table (references id, not company_id)
  -- Note: companies.id is the PK, companies.company_id is the YClients company ID
  CONSTRAINT fk_telegram_company
    FOREIGN KEY (company_id)
    REFERENCES companies(id)
    ON DELETE CASCADE
);

-- Index for fast company lookup
CREATE INDEX IF NOT EXISTS idx_telegram_company_id
  ON telegram_business_connections(company_id);

-- Index for fast connection lookup
CREATE INDEX IF NOT EXISTS idx_telegram_business_connection
  ON telegram_business_connections(business_connection_id);

-- Index for Telegram user lookup
CREATE INDEX IF NOT EXISTS idx_telegram_user_id
  ON telegram_business_connections(telegram_user_id);

-- Index for active connections only
CREATE INDEX IF NOT EXISTS idx_telegram_active
  ON telegram_business_connections(is_active)
  WHERE is_active = true;

-- Compound index for common queries
CREATE INDEX IF NOT EXISTS idx_telegram_company_active
  ON telegram_business_connections(company_id, is_active)
  WHERE is_active = true;

-- Add platform column to messages table if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'messages'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'messages' AND column_name = 'platform'
    ) THEN
      ALTER TABLE messages ADD COLUMN platform VARCHAR(20) DEFAULT 'whatsapp';
      CREATE INDEX idx_messages_platform ON messages(platform);
    END IF;
  END IF;
END
$$;

-- Add Telegram fields to companies table
DO $$
BEGIN
  -- Add telegram_enabled flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'telegram_enabled'
  ) THEN
    ALTER TABLE companies ADD COLUMN telegram_enabled BOOLEAN DEFAULT false;
  END IF;

  -- Add telegram_premium_until for tracking Premium subscription
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'telegram_premium_until'
  ) THEN
    ALTER TABLE companies ADD COLUMN telegram_premium_until TIMESTAMP;
  END IF;
END
$$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_telegram_connection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_telegram_connection_updated ON telegram_business_connections;
CREATE TRIGGER trigger_telegram_connection_updated
  BEFORE UPDATE ON telegram_business_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_telegram_connection_timestamp();

-- Add comment to table
COMMENT ON TABLE telegram_business_connections IS 'Stores Telegram Business Bot connections for salon accounts';
COMMENT ON COLUMN telegram_business_connections.business_connection_id IS 'Unique ID from Telegram Business API';
COMMENT ON COLUMN telegram_business_connections.can_reply IS 'Whether bot has permission to reply in this connection';
COMMENT ON COLUMN telegram_business_connections.is_active IS 'Whether the connection is currently active (not disconnected)';
