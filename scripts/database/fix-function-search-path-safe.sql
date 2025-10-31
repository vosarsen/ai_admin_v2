-- Fix Function Search Path Security Warnings (SAFE VERSION)
-- This script checks if functions exist before altering them

-- =====================================================
-- CHECK AND ALTER FUNCTIONS
-- =====================================================

DO $$
DECLARE
    func_exists boolean;
BEGIN
    -- 1. update_updated_at_column
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
    ) INTO func_exists;
    
    IF func_exists THEN
        ALTER FUNCTION public.update_updated_at_column() 
        SET search_path = public, pg_catalog;
        RAISE NOTICE '✅ Fixed: update_updated_at_column';
    ELSE
        RAISE NOTICE '⏭️  Skipped: update_updated_at_column (does not exist)';
    END IF;

    -- 2. get_service_categories_with_count
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_service_categories_with_count'
    ) INTO func_exists;
    
    IF func_exists THEN
        ALTER FUNCTION public.get_service_categories_with_count(bigint) 
        SET search_path = public, pg_catalog;
        RAISE NOTICE '✅ Fixed: get_service_categories_with_count';
    ELSE
        RAISE NOTICE '⏭️  Skipped: get_service_categories_with_count (does not exist)';
    END IF;

    -- 3. cleanup_old_webhook_events
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'cleanup_old_webhook_events'
    ) INTO func_exists;
    
    IF func_exists THEN
        ALTER FUNCTION public.cleanup_old_webhook_events() 
        SET search_path = public, pg_catalog;
        RAISE NOTICE '✅ Fixed: cleanup_old_webhook_events';
    ELSE
        RAISE NOTICE '⏭️  Skipped: cleanup_old_webhook_events (does not exist)';
    END IF;

    -- 4. get_ai_analytics (might not exist)
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_ai_analytics'
    ) INTO func_exists;
    
    IF func_exists THEN
        -- Need to check the exact signature
        EXECUTE 'ALTER FUNCTION public.get_ai_analytics(bigint, timestamp with time zone, timestamp with time zone) 
                 SET search_path = public, pg_catalog';
        RAISE NOTICE '✅ Fixed: get_ai_analytics';
    ELSE
        RAISE NOTICE '⏭️  Skipped: get_ai_analytics (does not exist)';
    END IF;

    -- 5. get_top_ai_clients (might not exist)
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_top_ai_clients'
    ) INTO func_exists;
    
    IF func_exists THEN
        EXECUTE 'ALTER FUNCTION public.get_top_ai_clients(bigint, integer) 
                 SET search_path = public, pg_catalog';
        RAISE NOTICE '✅ Fixed: get_top_ai_clients';
    ELSE
        RAISE NOTICE '⏭️  Skipped: get_top_ai_clients (does not exist)';
    END IF;

    -- 6. get_ai_client_segments (might not exist)
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_ai_client_segments'
    ) INTO func_exists;
    
    IF func_exists THEN
        EXECUTE 'ALTER FUNCTION public.get_ai_client_segments(bigint) 
                 SET search_path = public, pg_catalog';
        RAISE NOTICE '✅ Fixed: get_ai_client_segments';
    ELSE
        RAISE NOTICE '⏭️  Skipped: get_ai_client_segments (does not exist)';
    END IF;

    -- 7. update_services_updated_at
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'update_services_updated_at'
    ) INTO func_exists;
    
    IF func_exists THEN
        ALTER FUNCTION public.update_services_updated_at() 
        SET search_path = public, pg_catalog;
        RAISE NOTICE '✅ Fixed: update_services_updated_at';
    ELSE
        RAISE NOTICE '⏭️  Skipped: update_services_updated_at (does not exist)';
    END IF;

    -- 8. update_staff_updated_at
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'update_staff_updated_at'
    ) INTO func_exists;
    
    IF func_exists THEN
        ALTER FUNCTION public.update_staff_updated_at() 
        SET search_path = public, pg_catalog;
        RAISE NOTICE '✅ Fixed: update_staff_updated_at';
    ELSE
        RAISE NOTICE '⏭️  Skipped: update_staff_updated_at (does not exist)';
    END IF;

    -- 9. update_appointments_cache_updated_at
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'update_appointments_cache_updated_at'
    ) INTO func_exists;
    
    IF func_exists THEN
        ALTER FUNCTION public.update_appointments_cache_updated_at() 
        SET search_path = public, pg_catalog;
        RAISE NOTICE '✅ Fixed: update_appointments_cache_updated_at';
    ELSE
        RAISE NOTICE '⏭️  Skipped: update_appointments_cache_updated_at (does not exist)';
    END IF;

    -- 10. update_staff_schedules_updated_at
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'update_staff_schedules_updated_at'
    ) INTO func_exists;
    
    IF func_exists THEN
        ALTER FUNCTION public.update_staff_schedules_updated_at() 
        SET search_path = public, pg_catalog;
        RAISE NOTICE '✅ Fixed: update_staff_schedules_updated_at';
    ELSE
        RAISE NOTICE '⏭️  Skipped: update_staff_schedules_updated_at (does not exist)';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error occurred: %', SQLERRM;
        RAISE NOTICE 'Some functions might have different signatures or not exist';
END $$;

-- =====================================================
-- LIST ALL EXISTING FUNCTIONS IN PUBLIC SCHEMA
-- =====================================================
SELECT 
    'Existing functions in public schema:' as info;

SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    CASE 
        WHEN p.proconfig IS NULL THEN 'NOT SET ❌'
        WHEN p.proconfig::text[] @> ARRAY['search_path=public, pg_catalog'] THEN 'SET ✅'
        ELSE 'PARTIAL 🟡'
    END AS search_path_status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
    AND p.prokind = 'f'  -- Only functions, not procedures
ORDER BY p.proname;

-- =====================================================
-- SHOW ONLY FUNCTIONS THAT NEED FIXING
-- =====================================================
SELECT 
    'Functions that still need search_path:' as info;

SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND (p.proconfig IS NULL OR NOT (p.proconfig::text[] @> ARRAY['search_path=public, pg_catalog']))
ORDER BY p.proname;