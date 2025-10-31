-- Fix Supabase Security Issues
-- Generated: 2025-08-22
-- This script enables RLS on all public tables and creates appropriate policies

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

-- Enable RLS on all tables that currently have it disabled
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialog_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES FOR SERVICE ROLE
-- =====================================================
-- Service role (used by our backend) needs full access to all tables
-- These policies allow service role to bypass RLS while keeping data secure

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "service_role_all" ON public.reminders;
DROP POLICY IF EXISTS "service_role_all" ON public.visits;
DROP POLICY IF EXISTS "service_role_all" ON public.clients;
DROP POLICY IF EXISTS "service_role_all" ON public.dialog_contexts;
DROP POLICY IF EXISTS "service_role_all" ON public.services;
DROP POLICY IF EXISTS "service_role_all" ON public.staff_schedules;
DROP POLICY IF EXISTS "service_role_all" ON public.appointments_cache;
DROP POLICY IF EXISTS "service_role_all" ON public.sync_status;
DROP POLICY IF EXISTS "service_role_all" ON public.staff;
DROP POLICY IF EXISTS "service_role_all" ON public.webhook_events;
DROP POLICY IF EXISTS "service_role_all" ON public.booking_notifications;
DROP POLICY IF EXISTS "service_role_all" ON public.companies;
DROP POLICY IF EXISTS "service_role_all" ON public.bookings;

-- Create policies that allow service role full access
-- Service role is used by our backend with service_role key

-- Reminders table
CREATE POLICY "service_role_all" ON public.reminders
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Visits table
CREATE POLICY "service_role_all" ON public.visits
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Clients table
CREATE POLICY "service_role_all" ON public.clients
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Dialog contexts table
CREATE POLICY "service_role_all" ON public.dialog_contexts
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Services table
CREATE POLICY "service_role_all" ON public.services
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Staff schedules table
CREATE POLICY "service_role_all" ON public.staff_schedules
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Appointments cache table
CREATE POLICY "service_role_all" ON public.appointments_cache
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Sync status table
CREATE POLICY "service_role_all" ON public.sync_status
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Staff table
CREATE POLICY "service_role_all" ON public.staff
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Webhook events table
CREATE POLICY "service_role_all" ON public.webhook_events
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Booking notifications table
CREATE POLICY "service_role_all" ON public.booking_notifications
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Companies table
CREATE POLICY "service_role_all" ON public.companies
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Bookings table
CREATE POLICY "service_role_all" ON public.bookings
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- FIX SECURITY DEFINER VIEWS
-- =====================================================
-- Convert views from SECURITY DEFINER to SECURITY INVOKER
-- This ensures views use the permissions of the querying user

-- notification_stats_24h view
DROP VIEW IF EXISTS public.notification_stats_24h CASCADE;
CREATE OR REPLACE VIEW public.notification_stats_24h 
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

-- webhook_stats_24h view
DROP VIEW IF EXISTS public.webhook_stats_24h CASCADE;
CREATE OR REPLACE VIEW public.webhook_stats_24h 
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

-- =====================================================
-- ADD PUBLIC READ POLICIES FOR SOME TABLES
-- =====================================================
-- Some tables might need public read access for the app to work
-- Add these if needed based on your application requirements

-- Example: Allow public read access to companies table
-- CREATE POLICY "public_read" ON public.companies
--     FOR SELECT
--     TO anon, authenticated
--     USING (true);

-- Example: Allow public read access to services table
-- CREATE POLICY "public_read" ON public.services
--     FOR SELECT
--     TO anon, authenticated
--     USING (true);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify RLS is enabled and policies are created

-- Check RLS status for all tables
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check all policies
SELECT 
    schemaname,
    tablename,
    policyname,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check views security settings
SELECT 
    n.nspname AS schema,
    c.relname AS view_name,
    c.relkind,
    CASE 
        WHEN c.relkind = 'v' THEN 
            CASE 
                WHEN pg_get_viewdef(c.oid) LIKE '%SECURITY DEFINER%' THEN 'SECURITY DEFINER'
                ELSE 'SECURITY INVOKER'
            END
        ELSE NULL
    END AS security_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
    AND c.relkind = 'v'
ORDER BY c.relname;