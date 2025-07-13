-- AI Admin v2 Database Performance Optimization Script
-- Purpose: Create critical indexes based on query patterns analysis
-- Author: AI Assistant
-- Date: 2025-07-11
-- 
-- IMPORTANT: This script checks for existing indexes before creating to avoid errors
-- Run with: psql -U your_user -d your_database -f create-indexes.sql

-- ========================================================================
-- HIGH PRIORITY INDEXES (Critical for performance)
-- ========================================================================

-- 1. SERVICES table indexes
-- Most queries filter by company_id and is_active
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_company_active') THEN
        CREATE INDEX CONCURRENTLY idx_services_company_active 
        ON services(company_id, is_active) 
        WHERE is_active = true;
        RAISE NOTICE 'Created index: idx_services_company_active';
    ELSE
        RAISE NOTICE 'Index already exists: idx_services_company_active';
    END IF;
END $$;

-- Service lookups by yclients_id and company_id (unique constraint likely exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_yclients_company') THEN
        CREATE INDEX CONCURRENTLY idx_services_yclients_company 
        ON services(yclients_id, company_id);
        RAISE NOTICE 'Created index: idx_services_yclients_company';
    ELSE
        RAISE NOTICE 'Index already exists: idx_services_yclients_company';
    END IF;
END $$;

-- Service ordering by weight and title
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_company_weight_title') THEN
        CREATE INDEX CONCURRENTLY idx_services_company_weight_title 
        ON services(company_id, weight DESC, title);
        RAISE NOTICE 'Created index: idx_services_company_weight_title';
    ELSE
        RAISE NOTICE 'Index already exists: idx_services_company_weight_title';
    END IF;
END $$;

-- 2. STAFF table indexes
-- Staff queries by company and active status
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_staff_company_active') THEN
        CREATE INDEX CONCURRENTLY idx_staff_company_active 
        ON staff(company_id, is_active) 
        WHERE is_active = true;
        RAISE NOTICE 'Created index: idx_staff_company_active';
    ELSE
        RAISE NOTICE 'Index already exists: idx_staff_company_active';
    END IF;
END $$;

-- Staff lookups by yclients_id and company_id
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_staff_yclients_company') THEN
        CREATE INDEX CONCURRENTLY idx_staff_yclients_company 
        ON staff(yclients_id, company_id);
        RAISE NOTICE 'Created index: idx_staff_yclients_company';
    ELSE
        RAISE NOTICE 'Index already exists: idx_staff_yclients_company';
    END IF;
END $$;

-- Staff ordering by rating (for popular staff queries)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_staff_company_rating') THEN
        CREATE INDEX CONCURRENTLY idx_staff_company_rating 
        ON staff(company_id, rating DESC NULLS LAST)
        WHERE is_active = true;
        RAISE NOTICE 'Created index: idx_staff_company_rating';
    ELSE
        RAISE NOTICE 'Index already exists: idx_staff_company_rating';
    END IF;
END $$;

-- 3. STAFF_SCHEDULES table indexes
-- Primary lookup pattern: company_id, date range, staff_id
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_staff_schedules_company_date') THEN
        CREATE INDEX CONCURRENTLY idx_staff_schedules_company_date 
        ON staff_schedules(company_id, date, staff_id);
        RAISE NOTICE 'Created index: idx_staff_schedules_company_date';
    ELSE
        RAISE NOTICE 'Index already exists: idx_staff_schedules_company_date';
    END IF;
END $$;

-- Schedule lookups by staff_id and date (unique constraint likely exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_staff_schedules_staff_date') THEN
        CREATE INDEX CONCURRENTLY idx_staff_schedules_staff_date 
        ON staff_schedules(staff_id, date);
        RAISE NOTICE 'Created index: idx_staff_schedules_staff_date';
    ELSE
        RAISE NOTICE 'Index already exists: idx_staff_schedules_staff_date';
    END IF;
END $$;

-- Schedule searches by staff name
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_staff_schedules_staff_name') THEN
        CREATE INDEX CONCURRENTLY idx_staff_schedules_staff_name 
        ON staff_schedules(staff_name varchar_pattern_ops);
        RAISE NOTICE 'Created index: idx_staff_schedules_staff_name';
    ELSE
        RAISE NOTICE 'Index already exists: idx_staff_schedules_staff_name';
    END IF;
END $$;

-- 4. CLIENTS table indexes
-- Phone lookups (normalized phone)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_clients_phone') THEN
        CREATE INDEX CONCURRENTLY idx_clients_phone 
        ON clients(phone);
        RAISE NOTICE 'Created index: idx_clients_phone';
    ELSE
        RAISE NOTICE 'Index already exists: idx_clients_phone';
    END IF;
END $$;

-- Client lookups by yclients_id and company_id
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_clients_yclients_company') THEN
        CREATE INDEX CONCURRENTLY idx_clients_yclients_company 
        ON clients(yclients_id, company_id);
        RAISE NOTICE 'Created index: idx_clients_yclients_company';
    ELSE
        RAISE NOTICE 'Index already exists: idx_clients_yclients_company';
    END IF;
END $$;

-- Client searches by name within company
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_clients_company_name') THEN
        CREATE INDEX CONCURRENTLY idx_clients_company_name 
        ON clients(company_id, name varchar_pattern_ops);
        RAISE NOTICE 'Created index: idx_clients_company_name';
    ELSE
        RAISE NOTICE 'Index already exists: idx_clients_company_name';
    END IF;
END $$;

-- Client ordering by visit metrics
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_clients_company_last_visit') THEN
        CREATE INDEX CONCURRENTLY idx_clients_company_last_visit 
        ON clients(company_id, last_visit_date DESC NULLS LAST, visit_count DESC);
        RAISE NOTICE 'Created index: idx_clients_company_last_visit';
    ELSE
        RAISE NOTICE 'Index already exists: idx_clients_company_last_visit';
    END IF;
END $$;

-- 5. DIALOG_CONTEXTS table indexes
-- Primary lookup by user_id
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_dialog_contexts_user_id') THEN
        CREATE UNIQUE INDEX CONCURRENTLY idx_dialog_contexts_user_id 
        ON dialog_contexts(user_id);
        RAISE NOTICE 'Created index: idx_dialog_contexts_user_id';
    ELSE
        RAISE NOTICE 'Index already exists: idx_dialog_contexts_user_id';
    END IF;
END $$;

-- Dialog context by company
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_dialog_contexts_company_id') THEN
        CREATE INDEX CONCURRENTLY idx_dialog_contexts_company_id 
        ON dialog_contexts(company_id)
        WHERE company_id IS NOT NULL;
        RAISE NOTICE 'Created index: idx_dialog_contexts_company_id';
    ELSE
        RAISE NOTICE 'Index already exists: idx_dialog_contexts_company_id';
    END IF;
END $$;

-- 6. APPOINTMENTS_CACHE table indexes
-- Appointments by client and company
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_appointments_client_company') THEN
        CREATE INDEX CONCURRENTLY idx_appointments_client_company 
        ON appointments_cache(client_id, company_id, appointment_datetime DESC);
        RAISE NOTICE 'Created index: idx_appointments_client_company';
    ELSE
        RAISE NOTICE 'Index already exists: idx_appointments_client_company';
    END IF;
END $$;

-- Upcoming appointments (date range queries)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_appointments_upcoming') THEN
        CREATE INDEX CONCURRENTLY idx_appointments_upcoming 
        ON appointments_cache(company_id, appointment_datetime)
        WHERE status != 'cancelled';
        RAISE NOTICE 'Created index: idx_appointments_upcoming';
    ELSE
        RAISE NOTICE 'Index already exists: idx_appointments_upcoming';
    END IF;
END $$;

-- ========================================================================
-- MEDIUM PRIORITY INDEXES (Improve specific queries)
-- ========================================================================

-- 7. Category-based service searches
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_category') THEN
        CREATE INDEX CONCURRENTLY idx_services_category 
        ON services(company_id, category_id)
        WHERE is_active = true;
        RAISE NOTICE 'Created index: idx_services_category';
    ELSE
        RAISE NOTICE 'Index already exists: idx_services_category';
    END IF;
END $$;

-- 8. Staff service associations (array column)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_staff_service_ids') THEN
        CREATE INDEX CONCURRENTLY idx_staff_service_ids 
        ON staff USING GIN(service_ids);
        RAISE NOTICE 'Created index: idx_staff_service_ids';
    ELSE
        RAISE NOTICE 'Index already exists: idx_staff_service_ids';
    END IF;
END $$;

-- 9. Working schedules lookup
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_staff_schedules_working') THEN
        CREATE INDEX CONCURRENTLY idx_staff_schedules_working 
        ON staff_schedules(date, is_working)
        WHERE is_working = true;
        RAISE NOTICE 'Created index: idx_staff_schedules_working';
    ELSE
        RAISE NOTICE 'Index already exists: idx_staff_schedules_working';
    END IF;
END $$;

-- 10. Companies lookup
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_companies_company_id') THEN
        CREATE UNIQUE INDEX CONCURRENTLY idx_companies_company_id 
        ON companies(company_id);
        RAISE NOTICE 'Created index: idx_companies_company_id';
    ELSE
        RAISE NOTICE 'Index already exists: idx_companies_company_id';
    END IF;
END $$;

-- ========================================================================
-- LOW PRIORITY INDEXES (Nice to have, specific use cases)
-- ========================================================================

-- 11. Client AI interaction tracking
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_clients_ai_interaction') THEN
        CREATE INDEX CONCURRENTLY idx_clients_ai_interaction 
        ON clients(company_id, last_ai_interaction DESC NULLS LAST)
        WHERE created_by_ai = true;
        RAISE NOTICE 'Created index: idx_clients_ai_interaction';
    ELSE
        RAISE NOTICE 'Index already exists: idx_clients_ai_interaction';
    END IF;
END $$;

-- 12. Sync status monitoring
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sync_status_lookup') THEN
        CREATE INDEX CONCURRENTLY idx_sync_status_lookup 
        ON sync_status(table_name, company_id, last_sync_at DESC);
        RAISE NOTICE 'Created index: idx_sync_status_lookup';
    ELSE
        RAISE NOTICE 'Index already exists: idx_sync_status_lookup';
    END IF;
END $$;

-- 13. Reminders by appointment time
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_reminders_appointment') THEN
        CREATE INDEX CONCURRENTLY idx_reminders_appointment 
        ON reminders(appointment_datetime, status)
        WHERE status = 'pending';
        RAISE NOTICE 'Created index: idx_reminders_appointment';
    ELSE
        RAISE NOTICE 'Index already exists: idx_reminders_appointment';
    END IF;
END $$;

-- ========================================================================
-- PERFORMANCE TUNING RECOMMENDATIONS
-- ========================================================================

-- Analyze tables after index creation
ANALYZE services;
ANALYZE staff;
ANALYZE staff_schedules;
ANALYZE clients;
ANALYZE dialog_contexts;
ANALYZE appointments_cache;
ANALYZE companies;
ANALYZE sync_status;
ANALYZE reminders;

-- Show index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Show table statistics
SELECT 
    schemaname,
    tablename,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

RAISE NOTICE 'Index creation completed. Review the statistics above.';