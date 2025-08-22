-- Add Missing Foreign Key Index
-- Fixes: Unindexed foreign key warning from Supabase Performance Advisor

-- Create index for foreign key constraint visits_client_id_fkey
CREATE INDEX IF NOT EXISTS idx_visits_client_id 
ON public.visits(client_id);

-- Verify the index was created
SELECT 
    'Index created successfully' as status,
    indexname,
    tablename,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
    AND tablename = 'visits'
    AND indexname = 'idx_visits_client_id';

-- Show all indexes on visits table
SELECT 
    'All indexes on visits table:' as info;

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
    AND tablename = 'visits'
ORDER BY indexname;