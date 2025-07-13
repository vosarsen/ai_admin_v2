-- Проверка созданных индексов и их производительности

-- =====================================================
-- 1. СПИСОК ВСЕХ СОЗДАННЫХ ИНДЕКСОВ
-- =====================================================
SELECT 
    tablename as "Таблица",
    indexname as "Индекс",
    pg_size_pretty(pg_relation_size(indexrelid::regclass)) as "Размер"
FROM pg_indexes
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- =====================================================
-- 2. ТЕСТИРОВАНИЕ ПРОИЗВОДИТЕЛЬНОСТИ
-- =====================================================

-- Тест 1: Поиск активных услуг компании
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM services 
WHERE company_id = 962302 
AND is_active = true 
ORDER BY weight DESC 
LIMIT 20;

-- Тест 2: Поиск клиента по телефону
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM clients 
WHERE phone = '79001234567' 
AND company_id = 962302
LIMIT 1;

-- Тест 3: Поиск активных мастеров
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM staff 
WHERE company_id = 962302 
AND is_active = true 
ORDER BY rating DESC NULLS LAST
LIMIT 10;

-- Тест 4: Расписание на сегодня
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM staff_schedules
WHERE date = CURRENT_DATE
AND is_working = true
ORDER BY staff_name;

-- Тест 5: История клиента
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM appointments_cache
WHERE client_id = 15031248
AND is_cancelled = false
ORDER BY appointment_datetime DESC
LIMIT 10;

-- =====================================================
-- 3. СТАТИСТИКА ИСПОЛЬЗОВАНИЯ ИНДЕКСОВ
-- =====================================================

-- Общая статистика по таблицам
SELECT 
    schemaname,
    tablename,
    n_live_tup as "Живых строк",
    n_dead_tup as "Мертвых строк",
    last_vacuum as "Последний VACUUM",
    last_analyze as "Последний ANALYZE"
FROM pg_stat_user_tables
WHERE schemaname = 'public'
AND tablename IN ('services', 'staff', 'staff_schedules', 'clients', 'appointments_cache')
ORDER BY tablename;

-- =====================================================
-- 4. РАЗМЕР ТАБЛИЦ И ИНДЕКСОВ
-- =====================================================

SELECT
    tablename as "Таблица",
    pg_size_pretty(pg_total_relation_size(tablename::regclass)) as "Общий размер",
    pg_size_pretty(pg_relation_size(tablename::regclass)) as "Размер таблицы",
    pg_size_pretty(pg_total_relation_size(tablename::regclass) - pg_relation_size(tablename::regclass)) as "Размер индексов"
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('services', 'staff', 'staff_schedules', 'clients', 'appointments_cache', 'dialog_contexts')
ORDER BY pg_total_relation_size(tablename::regclass) DESC;