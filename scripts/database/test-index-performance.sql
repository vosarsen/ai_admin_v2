-- AI Admin v2 - Тестирование производительности индексов
-- Выполните этот скрипт ДО и ПОСЛЕ создания индексов для сравнения

-- =====================================================
-- ТЕСТ 1: Поиск услуг компании
-- =====================================================
EXPLAIN (ANALYZE, BUFFERS, TIMING) 
SELECT * FROM services 
WHERE company_id = 123 
AND is_active = true 
ORDER BY weight DESC 
LIMIT 20;

-- =====================================================
-- ТЕСТ 2: Поиск клиента по телефону
-- =====================================================
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT * FROM clients 
WHERE phone = '79001234567' 
AND company_id = 123;

-- =====================================================
-- ТЕСТ 3: Поиск мастеров с высоким рейтингом
-- =====================================================
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT * FROM staff 
WHERE company_id = 123 
AND is_active = true 
ORDER BY rating DESC 
LIMIT 10;

-- =====================================================
-- ТЕСТ 4: Проверка расписания на завтра
-- =====================================================
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT * FROM staff_schedules 
WHERE company_id = 123 
AND date = CURRENT_DATE + 1
AND is_working = true;

-- =====================================================
-- ТЕСТ 5: История записей клиента
-- =====================================================
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT * FROM appointments_cache
WHERE client_id = 456
AND is_cancelled = false
ORDER BY appointment_datetime DESC
LIMIT 10;

-- =====================================================
-- ОБЩАЯ СТАТИСТИКА
-- =====================================================
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    seq_scan as sequential_scans,
    seq_tup_read as seq_tuples_read,
    idx_scan as index_scans,
    idx_tup_fetch as index_tuples_fetched,
    CASE 
        WHEN seq_scan + idx_scan > 0 
        THEN round(100.0 * idx_scan / (seq_scan + idx_scan), 2)
        ELSE 0 
    END as index_usage_percent
FROM pg_stat_user_tables
WHERE schemaname = 'public'
AND tablename IN ('services', 'staff', 'staff_schedules', 'clients', 'appointments_cache')
ORDER BY tablename;