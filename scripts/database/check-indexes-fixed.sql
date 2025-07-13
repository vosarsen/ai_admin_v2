-- Проверка созданных индексов и их производительности (ИСПРАВЛЕННАЯ ВЕРСИЯ)

-- =====================================================
-- 1. СПИСОК ВСЕХ СОЗДАННЫХ ИНДЕКСОВ
-- =====================================================
SELECT 
    tablename as "Таблица",
    indexname as "Индекс",
    pg_size_pretty(pg_relation_size(('public.' || indexname)::regclass)) as "Размер"
FROM pg_indexes
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Альтернативный способ с более детальной информацией
SELECT 
    c.relname as "Таблица",
    i.relname as "Индекс",
    pg_size_pretty(pg_relation_size(i.oid)) as "Размер",
    idx.indisunique as "Уникальный",
    idx.indisprimary as "Первичный"
FROM pg_index idx
JOIN pg_class i ON i.oid = idx.indexrelid
JOIN pg_class c ON c.oid = idx.indrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND i.relname LIKE 'idx_%'
ORDER BY c.relname, i.relname;

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
LIMIT 20;

-- =====================================================
-- 3. ПРОВЕРКА ИСПОЛЬЗОВАНИЯ ИНДЕКСОВ
-- =====================================================

-- Статистика использования индексов
SELECT 
    schemaname as "Схема",
    tablename as "Таблица",
    indexrelname as "Индекс",
    idx_scan as "Сканирований",
    idx_tup_read as "Прочитано",
    idx_tup_fetch as "Извлечено"
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND indexrelname LIKE 'idx_%'
ORDER BY idx_scan DESC;

-- =====================================================
-- 4. РАЗМЕР ТАБЛИЦ И ИНДЕКСОВ (УПРОЩЕННЫЙ)
-- =====================================================

WITH table_sizes AS (
    SELECT
        tablename,
        pg_relation_size(tablename::regclass) as table_size,
        pg_total_relation_size(tablename::regclass) as total_size
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('services', 'staff', 'staff_schedules', 'clients', 'appointments_cache', 'dialog_contexts')
)
SELECT
    tablename as "Таблица",
    pg_size_pretty(total_size) as "Общий размер",
    pg_size_pretty(table_size) as "Размер данных",
    pg_size_pretty(total_size - table_size) as "Размер индексов",
    ROUND(100.0 * (total_size - table_size) / NULLIF(total_size, 0), 1) as "% индексов"
FROM table_sizes
ORDER BY total_size DESC;

-- =====================================================
-- 5. ИТОГОВАЯ СТАТИСТИКА
-- =====================================================

-- Количество созданных индексов
SELECT 
    COUNT(*) as "Всего индексов idx_*",
    COUNT(DISTINCT tablename) as "Таблиц с индексами"
FROM pg_indexes
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%';

-- Проверка наличия критически важных индексов
WITH required_indexes AS (
    SELECT unnest(ARRAY[
        'idx_services_company_active',
        'idx_staff_company_active',
        'idx_clients_phone_company',
        'idx_dialog_contexts_user'
    ]) as index_name
)
SELECT 
    ri.index_name as "Требуемый индекс",
    CASE WHEN pi.indexname IS NOT NULL THEN '✅ Создан' ELSE '❌ Отсутствует' END as "Статус"
FROM required_indexes ri
LEFT JOIN pg_indexes pi ON pi.indexname = ri.index_name AND pi.schemaname = 'public'
ORDER BY ri.index_name;