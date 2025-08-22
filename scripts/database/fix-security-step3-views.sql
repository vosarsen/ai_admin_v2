-- Step 3: Fix SECURITY DEFINER views
-- Run this after Step 2 completes

-- Check if views exist first
SELECT 
    n.nspname AS schema,
    c.relname AS view_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
    AND c.relkind = 'v'
    AND c.relname IN ('notification_stats_24h', 'webhook_stats_24h');

-- Only recreate views if they exist
-- notification_stats_24h view
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'notification_stats_24h') THEN
        DROP VIEW public.notification_stats_24h CASCADE;
        
        CREATE VIEW public.notification_stats_24h 
        WITH (security_invoker = true) AS
        SELECT 
            COUNT(*) AS total_notifications,
            COUNT(CASE WHEN sent_at IS NOT NULL THEN 1 END) AS sent_notifications,
            COUNT(CASE WHEN error IS NOT NULL THEN 1 END) AS failed_notifications,
            COUNT(DISTINCT booking_id) AS unique_bookings,
            MIN(created_at) AS earliest_notification,
            MAX(created_at) AS latest_notification
        FROM public.booking_notifications
        WHERE created_at >= (NOW() - INTERVAL '24 hours');
        
        RAISE NOTICE 'View notification_stats_24h recreated with SECURITY INVOKER';
    ELSE
        RAISE NOTICE 'View notification_stats_24h does not exist, skipping';
    END IF;
END $$;

-- webhook_stats_24h view
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'webhook_stats_24h') THEN
        DROP VIEW public.webhook_stats_24h CASCADE;
        
        CREATE VIEW public.webhook_stats_24h 
        WITH (security_invoker = true) AS
        SELECT 
            COUNT(*) AS total_webhooks,
            COUNT(CASE WHEN status = 'success' THEN 1 END) AS successful_webhooks,
            COUNT(CASE WHEN status = 'error' THEN 1 END) AS failed_webhooks,
            COUNT(DISTINCT event_type) AS unique_event_types,
            MIN(created_at) AS earliest_webhook,
            MAX(created_at) AS latest_webhook
        FROM public.webhook_events
        WHERE created_at >= (NOW() - INTERVAL '24 hours');
        
        RAISE NOTICE 'View webhook_stats_24h recreated with SECURITY INVOKER';
    ELSE
        RAISE NOTICE 'View webhook_stats_24h does not exist, skipping';
    END IF;
END $$;