-- Migration: Create Robokassa Payments Table
-- Date: 2025-12-04
-- Description: Table for storing Robokassa payment transactions
-- Project: AI Admin v2 - Direct salon payments

-- =====================================================
-- Table: robokassa_payments
-- =====================================================
-- Stores all payment transactions from Robokassa gateway
-- for direct salon subscriptions to Admin AI

CREATE TABLE IF NOT EXISTS robokassa_payments (
  id SERIAL PRIMARY KEY,

  -- Invoice tracking (InvId from Robokassa)
  invoice_id BIGINT UNIQUE NOT NULL,

  -- Relationship to salon
  salon_id INTEGER NOT NULL,              -- YClients salon ID
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,

  -- Payment details
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
  description TEXT,

  -- Subscription period
  period_from DATE,
  period_to DATE,

  -- Status tracking
  -- pending: payment created, waiting for completion
  -- success: payment completed successfully
  -- failed: payment failed or rejected
  -- cancelled: payment cancelled by user
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Robokassa response data
  signature_value VARCHAR(64),            -- MD5 signature from Result URL
  out_sum_currency VARCHAR(3),            -- Currency returned by Robokassa
  payment_method VARCHAR(50),             -- PaymentMethod from Robokassa

  -- Optional: YClients marketplace notification
  yclients_notified BOOLEAN NOT NULL DEFAULT FALSE,
  yclients_payment_id INTEGER,            -- payment_id from YClients API response

  -- Client information
  client_email VARCHAR(255),
  client_phone VARCHAR(20),

  -- Fiscal data (54-FZ compliance)
  receipt_data JSONB,                     -- Full receipt JSON sent to Robokassa

  -- Raw response from Robokassa (for debugging)
  raw_response JSONB,

  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,               -- When payment was completed

  -- Constraints
  CONSTRAINT robokassa_payments_status_check
    CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
  CONSTRAINT robokassa_payments_amount_positive
    CHECK (amount > 0)
);

-- =====================================================
-- Indexes
-- =====================================================

-- Fast lookup by salon for payment history
CREATE INDEX idx_robokassa_payments_salon_id
  ON robokassa_payments(salon_id);

-- Fast filtering by status (pending payments, successful, etc.)
CREATE INDEX idx_robokassa_payments_status
  ON robokassa_payments(status);

-- Fast lookup by invoice ID (primary lookup for webhooks)
CREATE INDEX idx_robokassa_payments_invoice_id
  ON robokassa_payments(invoice_id);

-- Ordering by creation date (recent payments first)
CREATE INDEX idx_robokassa_payments_created_at
  ON robokassa_payments(created_at DESC);

-- Combined index for common query: recent successful payments for salon
CREATE INDEX idx_robokassa_payments_salon_status_date
  ON robokassa_payments(salon_id, status, created_at DESC);

-- =====================================================
-- Trigger: Auto-update updated_at
-- =====================================================

-- Check if the update function exists, create if not
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END;
$$;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_update_robokassa_payments_updated_at ON robokassa_payments;
CREATE TRIGGER trigger_update_robokassa_payments_updated_at
  BEFORE UPDATE ON robokassa_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE robokassa_payments IS
  'Robokassa payment transactions for direct salon subscriptions to Admin AI';

COMMENT ON COLUMN robokassa_payments.invoice_id IS
  'Unique InvId for Robokassa (auto-generated, format: timestamp+random)';

COMMENT ON COLUMN robokassa_payments.salon_id IS
  'YClients salon/company ID (NOT our internal company.id)';

COMMENT ON COLUMN robokassa_payments.status IS
  'Payment status: pending (waiting), success (completed), failed (rejected), cancelled (user cancelled)';

COMMENT ON COLUMN robokassa_payments.signature_value IS
  'MD5 signature from Robokassa Result URL callback for verification';

COMMENT ON COLUMN robokassa_payments.receipt_data IS
  'Full fiscal receipt data sent to Robokassa (54-FZ compliance)';

COMMENT ON COLUMN robokassa_payments.yclients_notified IS
  'Whether YClients marketplace was notified about this payment';

-- =====================================================
-- Verification
-- =====================================================

-- Verify table was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'robokassa_payments'
  ) THEN
    RAISE NOTICE 'SUCCESS: Table robokassa_payments created successfully';
  ELSE
    RAISE EXCEPTION 'ERROR: Table robokassa_payments was not created';
  END IF;
END;
$$;
