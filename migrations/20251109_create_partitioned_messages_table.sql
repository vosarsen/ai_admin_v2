-- =============================================================================
-- Migration: Phase 0.8.3 - Create Partitioned Messages Table
-- Date: 2025-11-09
-- Purpose: Create partitioned messages table for high-volume WhatsApp messages
--
-- Partitioning Strategy:
-- - Partition by created_at (RANGE partitioning by month)
-- - Monthly partitions for better query performance
-- - Automatic partition creation via function
-- - 6-month retention policy
-- =============================================================================

-- =============================================================================
-- 1. MESSAGES - Parent table (partitioned)
-- =============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL NOT NULL,
  company_id INTEGER NOT NULL,

  -- Message details
  phone VARCHAR(20) NOT NULL,
  message TEXT,
  direction VARCHAR(10) NOT NULL, -- 'inbound' | 'outbound'

  -- Message metadata
  message_id VARCHAR(255), -- WhatsApp message ID
  from_me BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(50), -- sent, delivered, read, failed

  -- Processing
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  ai_response TEXT,
  processing_time_ms INTEGER,

  -- Context
  context_id INTEGER, -- References dialog_contexts.id
  intent VARCHAR(50), -- booking, query, cancellation, etc.

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (direction IN ('inbound', 'outbound')),
  CHECK (status IN ('sent', 'delivered', 'read', 'failed', NULL)),

  -- Primary key includes partition key for partition pruning
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Comments
COMMENT ON TABLE messages IS 'WhatsApp messages (partitioned by month for performance)';
COMMENT ON COLUMN messages.direction IS 'inbound = from client, outbound = to client';
COMMENT ON COLUMN messages.message_id IS 'WhatsApp message ID from Baileys';
COMMENT ON COLUMN messages.from_me IS 'True if message sent by bot';

-- =============================================================================
-- 2. CREATE INITIAL PARTITIONS (6 months: current + 5 future)
-- =============================================================================

-- Function to create a partition for a given month
CREATE OR REPLACE FUNCTION create_messages_partition(partition_date DATE)
RETURNS TEXT AS $$
DECLARE
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  -- Calculate partition boundaries
  start_date := DATE_TRUNC('month', partition_date);
  end_date := start_date + INTERVAL '1 month';

  -- Generate partition name: messages_YYYY_MM
  partition_name := 'messages_' || TO_CHAR(start_date, 'YYYY_MM');

  -- Check if partition already exists
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = partition_name
      AND n.nspname = 'public'
      AND c.relkind = 'r'
  ) THEN
    RAISE NOTICE 'Partition % already exists', partition_name;
    RETURN partition_name || ' (already exists)';
  END IF;

  -- Create partition
  EXECUTE format(
    'CREATE TABLE %I PARTITION OF messages
     FOR VALUES FROM (%L) TO (%L)',
    partition_name,
    start_date,
    end_date
  );

  RAISE NOTICE '✅ Created partition % for range [%, %)',
    partition_name, start_date, end_date;

  RETURN partition_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_messages_partition(DATE) IS
  'Creates a monthly partition for messages table';

-- Create partitions for current month + 5 future months
DO $$
DECLARE
  i INTEGER;
  partition_date DATE;
  result TEXT;
BEGIN
  RAISE NOTICE 'Creating initial message partitions...';

  FOR i IN 0..5 LOOP
    partition_date := DATE_TRUNC('month', CURRENT_DATE) + (i || ' months')::INTERVAL;
    result := create_messages_partition(partition_date);
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Initial partitions created successfully';
END $$;

-- =============================================================================
-- 3. INDEXES ON PARTITIONED TABLE
-- =============================================================================

-- Note: Indexes are created on the parent table and automatically propagate to partitions

-- Company + phone for user message history
CREATE INDEX IF NOT EXISTS idx_messages_company_phone
  ON messages(company_id, phone, created_at DESC);

-- Direction for filtering inbound/outbound
CREATE INDEX IF NOT EXISTS idx_messages_direction
  ON messages(direction, created_at DESC);

-- Processing status for querying unprocessed messages
CREATE INDEX IF NOT EXISTS idx_messages_processed
  ON messages(processed, created_at) WHERE processed = false;

-- Message ID for idempotency checks
CREATE INDEX IF NOT EXISTS idx_messages_message_id
  ON messages(message_id) WHERE message_id IS NOT NULL;

-- Intent for analytics
CREATE INDEX IF NOT EXISTS idx_messages_intent
  ON messages(intent, created_at DESC) WHERE intent IS NOT NULL;

-- Phone for quick user lookup
CREATE INDEX IF NOT EXISTS idx_messages_phone
  ON messages(phone);

-- Company for company-wide queries
CREATE INDEX IF NOT EXISTS idx_messages_company
  ON messages(company_id, created_at DESC);

-- Status for delivery tracking
CREATE INDEX IF NOT EXISTS idx_messages_status
  ON messages(status, created_at DESC) WHERE status IS NOT NULL;

-- =============================================================================
-- 4. AUTOMATIC PARTITION MAINTENANCE
-- =============================================================================

-- Function to automatically create next month's partition (if not exists)
CREATE OR REPLACE FUNCTION maintain_messages_partitions()
RETURNS TABLE(action TEXT, partition_name TEXT) AS $$
DECLARE
  next_month DATE;
  created_partition TEXT;
  deleted_count INTEGER;
BEGIN
  -- 1. Create next month's partition (if doesn't exist)
  next_month := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';
  created_partition := create_messages_partition(next_month);

  IF created_partition NOT LIKE '%already exists%' THEN
    RETURN QUERY SELECT 'created'::TEXT, created_partition;
  END IF;

  -- 2. Drop old partitions (older than 6 months)
  -- This is optional - comment out if you want to keep all data
  FOR created_partition IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname LIKE 'messages_20%'
      AND n.nspname = 'public'
      AND c.relkind = 'r'
      AND TO_DATE(SUBSTRING(c.relname FROM 10), 'YYYY_MM') <
          DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '6 months'
  LOOP
    -- Get row count before dropping
    EXECUTE format('SELECT COUNT(*) FROM %I', created_partition) INTO deleted_count;

    -- Drop partition
    EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', created_partition);

    RAISE NOTICE 'Dropped old partition % (% rows)',
      created_partition, deleted_count;

    RETURN QUERY SELECT 'dropped'::TEXT, created_partition;
  END LOOP;

  IF NOT FOUND THEN
    RAISE NOTICE 'No maintenance actions required';
  END IF;

  RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION maintain_messages_partitions() IS
  'Maintains message partitions: creates next month, optionally drops old (>6 months)';

-- =============================================================================
-- 5. STATISTICS FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION get_messages_stats()
RETURNS TABLE(
  partition_name TEXT,
  partition_start DATE,
  partition_end DATE,
  row_count BIGINT,
  table_size TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.relname::TEXT AS partition_name,
    TO_DATE(SUBSTRING(c.relname FROM 10), 'YYYY_MM') AS partition_start,
    (TO_DATE(SUBSTRING(c.relname FROM 10), 'YYYY_MM') + INTERVAL '1 month')::DATE AS partition_end,
    COALESCE(s.n_tup_ins - s.n_tup_del, 0) AS row_count,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS table_size
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_stat_user_tables s ON s.relname = c.relname
  WHERE c.relname LIKE 'messages_20%'
    AND n.nspname = 'public'
    AND c.relkind = 'r'
  ORDER BY partition_start DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_messages_stats() IS
  'Returns statistics for all message partitions';

-- =============================================================================
-- 6. HELPER FUNCTIONS FOR QUERYING
-- =============================================================================

-- Get recent messages for a phone number
CREATE OR REPLACE FUNCTION get_recent_messages(
  p_phone VARCHAR,
  p_company_id INTEGER,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  id BIGINT,
  direction VARCHAR,
  message TEXT,
  created_at TIMESTAMPTZ,
  processed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.direction,
    m.message,
    m.created_at,
    m.processed
  FROM messages m
  WHERE m.phone = p_phone
    AND m.company_id = p_company_id
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_recent_messages(VARCHAR, INTEGER, INTEGER) IS
  'Get recent messages for a phone number (optimized with partition pruning)';

-- =============================================================================
-- 7. AUTOMATED MAINTENANCE SETUP (Optional - using pg_cron)
-- =============================================================================

-- NOTE: Requires pg_cron extension
-- To enable: CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule monthly partition maintenance (runs on 1st of each month)
-- Uncomment if pg_cron is available:

/*
SELECT cron.schedule(
  'maintain-messages-partitions',
  '0 2 1 * *',  -- At 02:00 on 1st day of month
  $$SELECT maintain_messages_partitions()$$
);
*/

-- Alternative: Call maintain_messages_partitions() from application cron job
-- Example: scripts/maintain-partitions.sh (run via PM2 or system cron)

-- =============================================================================
-- 8. EXAMPLE QUERIES
-- =============================================================================

-- Example: Insert message
/*
INSERT INTO messages (company_id, phone, message, direction, from_me)
VALUES (962302, '79001234567', 'Hello!', 'inbound', false);
*/

-- Example: Get recent conversation
/*
SELECT * FROM get_recent_messages('79001234567', 962302, 50);
*/

-- Example: Count messages by direction
/*
SELECT direction, COUNT(*) as count
FROM messages
WHERE company_id = 962302
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY direction;
*/

-- Example: Get unprocessed messages
/*
SELECT id, phone, message, created_at
FROM messages
WHERE processed = false
  AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at ASC
LIMIT 100;
*/

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  parent_exists BOOLEAN;
  partition_count INTEGER;
BEGIN
  -- Check parent table
  SELECT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'messages'
  ) INTO parent_exists;

  IF parent_exists THEN
    RAISE NOTICE '✅ Parent table "messages" created successfully';
  ELSE
    RAISE WARNING '❌ Parent table "messages" NOT created';
    RETURN;
  END IF;

  -- Count partitions
  SELECT COUNT(*)
  INTO partition_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname LIKE 'messages_20%'
    AND n.nspname = 'public'
    AND c.relkind = 'r';

  RAISE NOTICE '✅ Created % message partitions', partition_count;

  -- Show partition details
  RAISE NOTICE '';
  RAISE NOTICE 'Partition Details:';

  FOR i IN
    SELECT
      c.relname AS partition_name,
      TO_DATE(SUBSTRING(c.relname FROM 10), 'YYYY_MM') AS start_date,
      (TO_DATE(SUBSTRING(c.relname FROM 10), 'YYYY_MM') + INTERVAL '1 month')::DATE AS end_date
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname LIKE 'messages_20%'
      AND n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY start_date ASC
  LOOP
    RAISE NOTICE '  - % covers [%, %)',
      i.partition_name, i.start_date, i.end_date;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Phase 0.8.3 Complete! Partitioned messages table ready.';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Set up automated partition maintenance (pg_cron or app-level)';
  RAISE NOTICE '2. Test message insertion and querying';
  RAISE NOTICE '3. Monitor partition sizes with: SELECT * FROM get_messages_stats();';
END $$;
