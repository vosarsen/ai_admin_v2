-- Step 2: Create RLS policies for service role
-- Run this after Step 1 completes

-- Create policies that allow service role full access
-- Service role is used by our backend with service_role key

-- Reminders table
CREATE POLICY IF NOT EXISTS "service_role_all" ON public.reminders
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Visits table
CREATE POLICY IF NOT EXISTS "service_role_all" ON public.visits
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Clients table
CREATE POLICY IF NOT EXISTS "service_role_all" ON public.clients
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Dialog contexts table
CREATE POLICY IF NOT EXISTS "service_role_all" ON public.dialog_contexts
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Services table
CREATE POLICY IF NOT EXISTS "service_role_all" ON public.services
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Staff schedules table
CREATE POLICY IF NOT EXISTS "service_role_all" ON public.staff_schedules
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Appointments cache table
CREATE POLICY IF NOT EXISTS "service_role_all" ON public.appointments_cache
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Sync status table
CREATE POLICY IF NOT EXISTS "service_role_all" ON public.sync_status
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Staff table
CREATE POLICY IF NOT EXISTS "service_role_all" ON public.staff
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Webhook events table
CREATE POLICY IF NOT EXISTS "service_role_all" ON public.webhook_events
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Booking notifications table
CREATE POLICY IF NOT EXISTS "service_role_all" ON public.booking_notifications
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Companies table
CREATE POLICY IF NOT EXISTS "service_role_all" ON public.companies
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Bookings table
CREATE POLICY IF NOT EXISTS "service_role_all" ON public.bookings
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Verify policies are created
SELECT 
    tablename,
    policyname,
    roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;