-- Fix Function Search Path Security Warnings
-- This script sets explicit search_path for all functions to prevent security issues

-- =====================================================
-- ALTER EXISTING FUNCTIONS TO SET SEARCH PATH
-- =====================================================
-- Setting search_path to 'public' ensures functions always use the correct schema

-- 1. update_updated_at_column
ALTER FUNCTION public.update_updated_at_column() 
SET search_path = public, pg_catalog;

-- 2. get_service_categories_with_count
ALTER FUNCTION public.get_service_categories_with_count(p_company_id bigint) 
SET search_path = public, pg_catalog;

-- 3. cleanup_old_webhook_events
ALTER FUNCTION public.cleanup_old_webhook_events() 
SET search_path = public, pg_catalog;

-- 4. get_ai_analytics
ALTER FUNCTION public.get_ai_analytics(p_company_id bigint, p_from_date timestamp with time zone, p_to_date timestamp with time zone) 
SET search_path = public, pg_catalog;

-- 5. get_top_ai_clients  
ALTER FUNCTION public.get_top_ai_clients(p_company_id bigint, p_limit integer) 
SET search_path = public, pg_catalog;

-- 6. get_ai_client_segments
ALTER FUNCTION public.get_ai_client_segments(p_company_id bigint) 
SET search_path = public, pg_catalog;

-- 7. update_services_updated_at
ALTER FUNCTION public.update_services_updated_at() 
SET search_path = public, pg_catalog;

-- 8. update_staff_updated_at
ALTER FUNCTION public.update_staff_updated_at() 
SET search_path = public, pg_catalog;

-- 9. update_appointments_cache_updated_at
ALTER FUNCTION public.update_appointments_cache_updated_at() 
SET search_path = public, pg_catalog;

-- 10. update_staff_schedules_updated_at
ALTER FUNCTION public.update_staff_schedules_updated_at() 
SET search_path = public, pg_catalog;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Check that all functions now have search_path set

SELECT 
    n.nspname AS schema,
    p.proname AS function_name,
    CASE 
        WHEN p.proconfig IS NULL OR NOT (p.proconfig::text[] @> ARRAY['search_path=public, pg_catalog']) 
        THEN 'NOT SET ❌'
        ELSE 'SET ✅'
    END AS search_path_status,
    p.proconfig AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
    AND p.proname IN (
        'update_updated_at_column',
        'get_service_categories_with_count',
        'cleanup_old_webhook_events',
        'get_ai_analytics',
        'get_top_ai_clients',
        'get_ai_client_segments',
        'update_services_updated_at',
        'update_staff_updated_at',
        'update_appointments_cache_updated_at',
        'update_staff_schedules_updated_at'
    )
ORDER BY p.proname;

-- =====================================================
-- EXPLANATION
-- =====================================================
-- Setting search_path = public, pg_catalog ensures:
-- 1. Functions always use the 'public' schema first
-- 2. Then fall back to 'pg_catalog' for system functions
-- 3. Prevents SQL injection via manipulated search_path
-- 4. Improves security by making behavior predictable
--
-- This is a security best practice recommended by PostgreSQL
-- and required by Supabase security linter.