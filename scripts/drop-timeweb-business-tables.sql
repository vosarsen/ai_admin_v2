-- Drop Timeweb Business Tables (Keep Baileys)
-- Date: 2025-11-11
-- Purpose: Remove Phase 0.8 schema tables to make room for Supabase schema
-- Safety: Baileys tables (whatsapp_auth, whatsapp_keys) are NOT touched

-- WARNING: This will delete all data in these tables!
-- Baileys data has been backed up to /tmp/baileys_*.csv

-- Drop business tables (from Phase 0.8 schema)
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS staff_schedules CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS dialog_contexts CASCADE;

-- Drop message tables
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS messages_2025_11 CASCADE;
DROP TABLE IF EXISTS messages_2025_12 CASCADE;
DROP TABLE IF EXISTS messages_2026_01 CASCADE;
DROP TABLE IF EXISTS messages_2026_02 CASCADE;
DROP TABLE IF EXISTS messages_2026_03 CASCADE;
DROP TABLE IF EXISTS messages_2026_04 CASCADE;

-- Drop other tables
DROP TABLE IF EXISTS sync_status CASCADE;
DROP TABLE IF EXISTS reminders CASCADE;
DROP TABLE IF EXISTS appointments_cache CASCADE;
DROP TABLE IF EXISTS actions CASCADE;
DROP TABLE IF EXISTS company_sync_status CASCADE;

-- Verify Baileys tables still exist
SELECT 'Baileys tables check:' as status;
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('whatsapp_auth', 'whatsapp_keys')
ORDER BY tablename;

-- List remaining tables
SELECT 'Remaining tables:' as status;
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
