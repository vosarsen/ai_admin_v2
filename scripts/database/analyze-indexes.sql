-- AI Admin v2 - Анализ существующих индексов
-- Этот скрипт помогает проанализировать текущее состояние индексов

-- =====================================================
-- 1. ПОКАЗАТЬ ВСЕ СУЩЕСТВУЮЩИЕ ИНДЕКСЫ
-- =====================================================
SELECT 
    t.tablename,
    i.indexname,
    i.indexdef,
    pg_size_pretty(pg_relation_size(i.indexrelid)) as size,
    idx_stat.idx_scan as scans,
    idx_stat.idx_tup_read as tuples_read,
    idx_stat.idx_tup_fetch as tuples_fetched
FROM pg_indexes i
JOIN pg_stat_user_indexes idx_stat ON i.indexname = idx_stat.indexrelname
JOIN pg_tables t ON i.tablename = t.tablename
WHERE i.schemaname = 'public'
AND t.tablename IN ('services', 'staff', 'staff_schedules', 'clients', 'dialog_contexts', 'appointments_cache', 'companies')
ORDER BY t.tablename, i.indexname;

-- =====================================================
-- 2. НАЙТИ НЕИСПОЛЬЗУЕМЫЕ ИНДЕКСЫ
-- =====================================================
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size,
    idx_scan as scans
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND idx_scan = 0
AND indexrelname NOT LIKE 'pg_%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- =====================================================
-- 3. НАЙТИ ОТСУТСТВУЮЩИЕ ИНДЕКСЫ (по seq scan)
-- =====================================================
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    CASE 
        WHEN seq_scan > 0 THEN round((seq_tup_read::numeric / seq_scan), 2)
        ELSE 0
    END as avg_tuples_per_scan,
    n_tup_ins + n_tup_upd + n_tup_del as write_activity
FROM pg_stat_user_tables
WHERE schemaname = 'public'
AND seq_scan > 1000  -- Таблицы с большим количеством последовательных сканов
AND n_live_tup > 10000  -- И достаточным количеством строк
ORDER BY seq_scan DESC;

-- =====================================================
-- 4. НАЙТИ ДУБЛИРУЮЩИЕСЯ ИНДЕКСЫ
-- =====================================================
WITH index_columns AS (
    SELECT
        n.nspname as schema_name,
        t.relname as table_name,
        i.relname as index_name,
        array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE n.nspname = 'public'
    GROUP BY n.nspname, t.relname, i.relname, ix.indisunique, ix.indisprimary
)
SELECT 
    ic1.table_name,
    ic1.index_name as index1,
    ic2.index_name as index2,
    ic1.columns as columns
FROM index_columns ic1
JOIN index_columns ic2 ON ic1.table_name = ic2.table_name 
    AND ic1.columns = ic2.columns 
    AND ic1.index_name < ic2.index_name
ORDER BY ic1.table_name;

-- =====================================================
-- 5. ПРОВЕРИТЬ РАЗМЕР ИНДЕКСОВ И ТАБЛИЦ
-- =====================================================
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::regclass)) as total_size,
    pg_size_pretty(pg_relation_size(tablename::regclass)) as table_size,
    pg_size_pretty(pg_total_relation_size(tablename::regclass) - pg_relation_size(tablename::regclass)) as indexes_size,
    round(100.0 * (pg_total_relation_size(tablename::regclass) - pg_relation_size(tablename::regclass)) / pg_total_relation_size(tablename::regclass), 1) as index_ratio_percent
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('services', 'staff', 'staff_schedules', 'clients', 'dialog_contexts', 'appointments_cache', 'companies')
ORDER BY pg_total_relation_size(tablename::regclass) DESC;

-- =====================================================
-- 6. ПРОВЕРИТЬ BLOAT (раздутие) ИНДЕКСОВ
-- =====================================================
WITH btree_index_atts AS (
    SELECT 
        nspname,
        indexclass.relname as index_name,
        indexclass.reltuples,
        indexclass.relpages,
        tableclass.relname as tablename,
        (tableclass.relpages * 8192) as table_bytes,
        CASE WHEN indisunique THEN 1 ELSE 0 END AS is_unique
    FROM pg_index
    JOIN pg_class AS indexclass ON pg_index.indexrelid = indexclass.oid
    JOIN pg_class AS tableclass ON pg_index.indrelid = tableclass.oid
    JOIN pg_namespace ON pg_namespace.oid = indexclass.relnamespace
    WHERE pg_index.indisvalid
    AND indexclass.relpages > 0
    AND nspname = 'public'
)
SELECT
    tablename,
    index_name,
    pg_size_pretty((relpages * 8192)::bigint) as index_size,
    CASE WHEN relpages > 0 
        THEN round(100.0 * (relpages - (reltuples * 40 / 8192)) / relpages, 1)
        ELSE 0 
    END as bloat_percent
FROM btree_index_atts
WHERE (relpages - (reltuples * 40 / 8192)) > 10
ORDER BY relpages DESC;

-- =====================================================
-- 7. РЕКОМЕНДАЦИИ ПО ОБСЛУЖИВАНИЮ
-- =====================================================
SELECT 
    'VACUUM ANALYZE ' || tablename || ';' as maintenance_command,
    n_dead_tup as dead_tuples,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
AND tablename IN ('services', 'staff', 'staff_schedules', 'clients', 'dialog_contexts', 'appointments_cache', 'companies')
AND (n_dead_tup > 1000 OR last_analyze < CURRENT_DATE - INTERVAL '7 days')
ORDER BY n_dead_tup DESC;