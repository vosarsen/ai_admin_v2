-- Migration: Create Demo Company for Website Demo
-- Date: 2025-11-27
-- Purpose: Create isolated demo company (ID 999999) for website demo chat

-- Create demo company (upsert based on company_id check)
DO $$
BEGIN
  -- Check if demo company already exists
  IF NOT EXISTS (SELECT 1 FROM companies WHERE company_id = 999999) THEN
    INSERT INTO companies (
      company_id,
      yclients_id,
      title,
      phone,
      email,
      timezone,
      raw_data,
      status,
      created_at,
      updated_at
    ) VALUES (
      999999,
      999999,
      'Demo Beauty Salon',
      '+79001234567',
      'demo@ai-admin.app',
      'Europe/Moscow',
      '{"demo_mode": true, "allow_bookings": false}'::jsonb,
      'demo',
      NOW(),
      NOW()
    );
  ELSE
    -- Update existing demo company
    UPDATE companies SET
      title = 'Demo Beauty Salon',
      raw_data = '{"demo_mode": true, "allow_bookings": false}'::jsonb,
      status = 'demo',
      updated_at = NOW()
    WHERE company_id = 999999;
  END IF;
END $$;

-- Verify creation
SELECT company_id, title, status, raw_data
FROM companies
WHERE company_id = 999999;
