-- Fix RLS policies to work with anon key
-- The application uses anon key, not service_role

-- Drop existing service_role only policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN (
            'reminders', 'visits', 'clients', 'dialog_contexts', 
            'services', 'staff_schedules', 'appointments_cache', 
            'sync_status', 'staff', 'webhook_events', 
            'booking_notifications', 'companies', 'bookings'
        )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "service_role_all" ON public.%I', r.tablename);
    END LOOP;
END $$;

-- Create new policies that allow both anon and service_role
-- This allows the application (using anon key) to work

-- Companies table
CREATE POLICY "allow_all_access" ON public.companies
    FOR ALL 
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Services table
CREATE POLICY "allow_all_access" ON public.services
    FOR ALL 
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Staff table
CREATE POLICY "allow_all_access" ON public.staff
    FOR ALL 
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Staff schedules table
CREATE POLICY "allow_all_access" ON public.staff_schedules
    FOR ALL 
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Clients table
CREATE POLICY "allow_all_access" ON public.clients
    FOR ALL 
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Dialog contexts table
CREATE POLICY "allow_all_access" ON public.dialog_contexts
    FOR ALL 
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Bookings table
CREATE POLICY "allow_all_access" ON public.bookings
    FOR ALL 
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Appointments cache table
CREATE POLICY "allow_all_access" ON public.appointments_cache
    FOR ALL 
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Visits table
CREATE POLICY "allow_all_access" ON public.visits
    FOR ALL 
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Reminders table
CREATE POLICY "allow_all_access" ON public.reminders
    FOR ALL 
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Sync status table
CREATE POLICY "allow_all_access" ON public.sync_status
    FOR ALL 
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Webhook events table
CREATE POLICY "allow_all_access" ON public.webhook_events
    FOR ALL 
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Booking notifications table
CREATE POLICY "allow_all_access" ON public.booking_notifications
    FOR ALL 
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Verify policies are created
SELECT 
    tablename,
    policyname,
    roles
FROM pg_policies
WHERE schemaname = 'public'
    AND policyname = 'allow_all_access'
ORDER BY tablename;

-- Note: This configuration allows full access for anon, authenticated, and service_role
-- This is suitable for a backend-only application where all access is controlled
-- at the application level, not at the database level.
-- 
-- For production with public-facing apps, you would want more restrictive policies.