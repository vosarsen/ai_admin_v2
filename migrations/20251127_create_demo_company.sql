-- Migration: Create Demo Company for Website Demo
-- Date: 2025-11-27
-- Purpose: Create isolated demo company (ID 999999) for website demo chat

-- Create demo company
INSERT INTO companies (
  id,
  name,
  yclients_company_id,
  phone,
  email,
  timezone,
  settings,
  is_active,
  subscription_status,
  created_at,
  updated_at
) VALUES (
  999999,
  'Demo Beauty Salon',
  999999,
  '+79001234567',
  'demo@ai-admin.app',
  'Europe/Moscow',
  '{"demo_mode": true, "allow_bookings": false}'::jsonb,
  true,
  'demo',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  settings = EXCLUDED.settings,
  subscription_status = EXCLUDED.subscription_status,
  updated_at = NOW();

-- Verify creation
SELECT id, name, subscription_status, settings
FROM companies
WHERE id = 999999;
