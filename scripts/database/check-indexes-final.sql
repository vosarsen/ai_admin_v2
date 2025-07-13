-- Проверка созданных индексов и их производительности (ФИНАЛЬНАЯ ВЕРСИЯ)

-- =====================================================
-- 1. СПИСОК ВСЕХ СОЗДАННЫХ ИНДЕКСОВ
-- =====================================================
SELECT 
    tablename as "Таблица",
    indexname as "Индекс"
FROM pg_indexes
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- =====================================================
-- 2. РАЗМЕРЫ ИНДЕКСОВ
-- =====================================================
SELECT 
    c.relname as "Таблица",
    i.relname as "Индекс",
    pg_size_pretty(pg_relation_size(i.oid)) as "Размер"
FROM pg_index idx
JOIN pg_class i ON i.oid = idx.indexrelid
JOIN pg_class c ON c.oid = idx.indrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND i.relname LIKE 'idx_%'
ORDER BY pg_relation_size(i.oid) DESC;

-- =====================================================
-- 3. ТЕСТИРОВАНИЕ ПРОИЗВОДИТЕЛЬНОСТИ
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

-- =====================================================
-- 4. СТАТИСТИКА ИСПОЛЬЗОВАНИЯ ИНДЕКСОВ
-- =====================================================
SELECT 
    schemaname as "Схема",
    relname as "Таблица",
    indexrelname as "Индекс",
    idx_scan as "Сканирований",
    idx_tup_read as "Прочитано строк"
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND indexrelname LIKE 'idx_%'
ORDER BY idx_scan DESC;

-- =====================================================
-- 5. РАЗМЕР ТАБЛИЦ
-- =====================================================
SELECT
    tablename as "Таблица",
    pg_size_pretty(pg_total_relation_size(quote_ident(tablename)::regclass)) as "Общий размер"
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('services', 'staff', 'staff_schedules', 'clients', 'appointments_cache', 'dialog_contexts')
ORDER BY pg_total_relation_size(quote_ident(tablename)::regclass) DESC;

-- =====================================================
-- 6. ИТОГОВАЯ СТАТИСТИКА
-- =====================================================

-- Количество созданных индексов
SELECT 
    COUNT(*) as "Всего индексов idx_*"
FROM pg_indexes
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%';

-- Основные индексы и их статус
SELECT 
    CASE 
        WHEN indexname IS NOT NULL THEN '✅ ' || indexname
        ELSE '❌ Индекс не найден'
    END as "Статус индекса"
FROM (
    VALUES 
        ('idx_services_company_active'),
        ('idx_staff_company_active'),
        ('idx_clients_phone_company'),
        ('idx_dialog_contexts_user')
) AS required(index_name)
LEFT JOIN pg_indexes ON indexname = index_name AND schemaname = 'public';