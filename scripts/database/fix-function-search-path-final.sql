-- Fix Function Search Path Security Warnings (FINAL VERSION)
-- This script uses the correct function signatures from your database

-- =====================================================
-- ALTER FUNCTIONS WITH CORRECT SIGNATURES
-- =====================================================

-- Functions without parameters
ALTER FUNCTION public.cleanup_old_webhook_events() 
SET search_path = public, pg_catalog;

ALTER FUNCTION public.update_appointments_cache_updated_at() 
SET search_path = public, pg_catalog;

ALTER FUNCTION public.update_services_updated_at() 
SET search_path = public, pg_catalog;

ALTER FUNCTION public.update_staff_schedules_updated_at() 
SET search_path = public, pg_catalog;

ALTER FUNCTION public.update_staff_updated_at() 
SET search_path = public, pg_catalog;

ALTER FUNCTION public.update_updated_at_column() 
SET search_path = public, pg_catalog;

-- Functions with parameters (using correct parameter names)
ALTER FUNCTION public.get_ai_analytics(input_company_id bigint) 
SET search_path = public, pg_catalog;

ALTER FUNCTION public.get_ai_client_segments(input_company_id bigint) 
SET search_path = public, pg_catalog;

ALTER FUNCTION public.get_service_categories_with_count(input_company_id bigint) 
SET search_path = public, pg_catalog;

ALTER FUNCTION public.get_top_ai_clients(input_company_id bigint, limit_count integer) 
SET search_path = public, pg_catalog;

-- =====================================================
-- VERIFICATION
-- =====================================================

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
    AND p.prokind = 'f'
    AND p.proname IN (
        'cleanup_old_webhook_events',
        'get_ai_analytics',
        'get_ai_client_segments',
        'get_service_categories_with_count',
        'get_top_ai_clients',
        'update_appointments_cache_updated_at',
        'update_services_updated_at',
        'update_staff_schedules_updated_at',
        'update_staff_updated_at',
        'update_updated_at_column'
    )
ORDER BY p.proname;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
SELECT 
    '✅ All 10 functions should now have search_path set!' as result,
    'This fixes all Function Search Path warnings in Supabase Linter' as note;