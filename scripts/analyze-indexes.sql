-- AI Admin v2 Database Index Analysis Script
-- Purpose: Analyze existing indexes and provide optimization recommendations
-- Author: AI Assistant
-- Date: 2025-07-11
--
-- Run with: psql -U your_user -d your_database -f analyze-indexes.sql

\echo '=========================================='
\echo 'AI Admin v2 Index Analysis Report'
\echo '=========================================='
\echo ''

-- 1. Show all existing indexes with their sizes
\echo '1. EXISTING INDEXES AND SIZES:'
\echo '------------------------------'
SELECT 
    n.nspname AS schema_name,
    t.relname AS table_name,
    i.relname AS index_name,
    am.amname AS index_type,
    pg_size_pretty(pg_relation_size(i.oid)) AS index_size,
    idx.indisunique AS is_unique,
    idx.indisprimary AS is_primary
FROM pg_index idx
JOIN pg_class i ON i.oid = idx.indexrelid
JOIN pg_class t ON t.oid = idx.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_am am ON am.oid = i.relam
WHERE n.nspname = 'public'
    AND t.relkind = 'r'
ORDER BY pg_relation_size(i.oid) DESC;

\echo ''
\echo '2. INDEX USAGE STATISTICS:'
\echo '--------------------------'
-- Show which indexes are being used
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED - Consider dropping'
        WHEN idx_scan < 100 THEN 'LOW usage'
        WHEN idx_scan < 1000 THEN 'MODERATE usage'
        ELSE 'HIGH usage'
    END as usage_level
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;

\echo ''
\echo '3. MISSING INDEXES REPORT:'
\echo '--------------------------'
-- Identify potential missing indexes based on table scans
WITH table_scans AS (
    SELECT 
        schemaname,
        tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        n_live_tup,
        CASE 
            WHEN idx_scan > 0 THEN seq_scan::numeric / idx_scan::numeric
            ELSE seq_scan::numeric
        END as scan_ratio
    FROM pg_stat_user_tables
    WHERE schemaname = 'public' AND n_live_tup > 1000
)
SELECT 
    schemaname,
    tablename,
    seq_scan as sequential_scans,
    idx_scan as index_scans,
    n_live_tup as table_rows,
    round(scan_ratio, 2) as seq_to_idx_ratio,
    CASE 
        WHEN scan_ratio > 100 AND seq_scan > 1000 THEN 'CRITICAL - Add indexes'
        WHEN scan_ratio > 10 AND seq_scan > 100 THEN 'HIGH - Consider indexes'
        WHEN scan_ratio > 1 THEN 'MODERATE - Monitor'
        ELSE 'OK'
    END as recommendation
FROM table_scans
WHERE seq_scan > 0
ORDER BY scan_ratio DESC;

\echo ''
\echo '4. DUPLICATE INDEXES:'
\echo '---------------------'
-- Find duplicate indexes
WITH index_data AS (
    SELECT 
        indrelid,
        indexrelid,
        indkey,
        indisunique,
        indisprimary
    FROM pg_index
),
index_comparison AS (
    SELECT 
        a.indexrelid AS index1,
        b.indexrelid AS index2,
        a.indrelid AS table_oid,
        a.indkey AS keys1,
        b.indkey AS keys2
    FROM index_data a
    JOIN index_data b ON a.indrelid = b.indrelid 
        AND a.indexrelid < b.indexrelid
        AND a.indkey[0] = b.indkey[0]
        AND (
            a.indkey = b.indkey 
            OR a.indkey @> b.indkey 
            OR b.indkey @> a.indkey
        )
)
SELECT 
    t.relname AS table_name,
    i1.relname AS index1,
    i2.relname AS index2,
    pg_size_pretty(pg_relation_size(ic.index1)) AS index1_size,
    pg_size_pretty(pg_relation_size(ic.index2)) AS index2_size,
    CASE 
        WHEN ic.keys1 = ic.keys2 THEN 'EXACT duplicate'
        WHEN ic.keys1 @> ic.keys2 THEN i1.relname || ' contains ' || i2.relname
        ELSE i2.relname || ' contains ' || i1.relname
    END as relationship
FROM index_comparison ic
JOIN pg_class i1 ON i1.oid = ic.index1
JOIN pg_class i2 ON i2.oid = ic.index2
JOIN pg_class t ON t.oid = ic.table_oid;

\echo ''
\echo '5. INDEX BLOAT ANALYSIS:'
\echo '------------------------'
-- Estimate index bloat
WITH btree_index_atts AS (
    SELECT 
        nspname,
        relname AS table_name,
        indexrelname AS index_name,
        reltuples,
        relpages,
        indrelid,
        indexrelid,
        (
            SELECT string_agg(pg_get_indexdef(indexrelid, k, true), ',')
            FROM generate_subscripts(indkey, 1) AS k
        ) AS key_columns
    FROM pg_stat_user_indexes
    JOIN pg_index USING (indexrelid)
    JOIN pg_class c ON c.oid = indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE relam = 403 -- btree
        AND relpages > 0
        AND nspname = 'public'
),
index_bloat AS (
    SELECT
        nspname,
        table_name,
        index_name,
        reltuples::bigint AS num_rows,
        relpages::bigint AS num_pages,
        round(
            CASE WHEN relpages > 0 THEN
                100.0 * (relpages - ceil(reltuples / ((2048 - 24) / 30)))::numeric / relpages
            ELSE 0
            END, 2
        ) AS bloat_percentage,
        pg_size_pretty((relpages - ceil(reltuples / ((2048 - 24) / 30)))::bigint * 8192) AS wasted_space
    FROM btree_index_atts
)
SELECT 
    table_name,
    index_name,
    num_rows,
    num_pages,
    bloat_percentage || '%' AS bloat_pct,
    wasted_space,
    CASE 
        WHEN bloat_percentage > 50 THEN 'REINDEX recommended'
        WHEN bloat_percentage > 30 THEN 'Monitor closely'
        ELSE 'Acceptable'
    END AS recommendation
FROM index_bloat
WHERE bloat_percentage > 10
ORDER BY bloat_percentage DESC;

\echo ''
\echo '6. TABLE STATISTICS:'
\echo '--------------------'
-- Show table maintenance statistics
SELECT 
    schemaname,
    tablename,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    round(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    CASE 
        WHEN n_dead_tup > n_live_tup * 0.2 THEN 'VACUUM recommended'
        WHEN last_analyze < CURRENT_DATE - INTERVAL '7 days' THEN 'ANALYZE recommended'
        ELSE 'OK'
    END AS maintenance_recommendation
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC;

\echo ''
\echo '7. RECOMMENDED ACTIONS SUMMARY:'
\echo '-------------------------------'

-- Summary of recommended actions
SELECT 'DROP UNUSED INDEXES' AS action, COUNT(*) AS count
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND idx_scan = 0
UNION ALL
SELECT 'ADD MISSING INDEXES', COUNT(*)
FROM pg_stat_user_tables
WHERE schemaname = 'public' 
    AND seq_scan > 1000 
    AND (idx_scan = 0 OR seq_scan::numeric / NULLIF(idx_scan, 0) > 100)
UNION ALL
SELECT 'REINDEX BLOATED', COUNT(*)
FROM (
    SELECT indexrelid
    FROM pg_stat_user_indexes
    JOIN pg_class ON pg_class.oid = indexrelid
    WHERE schemaname = 'public' AND relpages > 10
) sub
UNION ALL
SELECT 'VACUUM TABLES', COUNT(*)
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND n_dead_tup > n_live_tup * 0.2;

\echo ''
\echo '=========================================='
\echo 'End of Index Analysis Report'
\echo '==========================================';