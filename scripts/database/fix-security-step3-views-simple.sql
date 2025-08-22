-- Step 3: Remove SECURITY DEFINER views (SIMPLIFIED)
-- Since the views have incorrect column references, we'll just drop them

-- Drop the problematic views if they exist
DROP VIEW IF EXISTS public.notification_stats_24h CASCADE;
DROP VIEW IF EXISTS public.webhook_stats_24h CASCADE;

-- Verify views are removed
SELECT 
    n.nspname AS schema,
    c.relname AS view_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
    AND c.relkind = 'v'
    AND c.relname IN ('notification_stats_24h', 'webhook_stats_24h');

-- If no rows returned, the views have been successfully removed