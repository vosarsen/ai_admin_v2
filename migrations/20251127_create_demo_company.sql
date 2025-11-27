-- Migration: Create Demo Company for Website Demo
-- Date: 2025-11-27
-- Purpose: Create isolated demo company (ID 999999) for website demo chat

-- Create demo company
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
)
ON CONFLICT (company_id) DO UPDATE SET
  title = EXCLUDED.title,
  raw_data = EXCLUDED.raw_data,
  status = EXCLUDED.status,
  updated_at = NOW();

-- Verify creation
SELECT company_id, title, status, raw_data
FROM companies
WHERE company_id = 999999;
