-- Быстрая проверка индексов AI Admin v2

-- 1. Список созданных индексов
SELECT 
    tablename as "Таблица",
    indexname as "Индекс"
FROM pg_indexes
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- 2. Общее количество
SELECT 
    'Создано индексов:' as "Результат", 
    COUNT(*) as "Количество"
FROM pg_indexes
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%';

-- 3. Быстрый тест производительности на услугах
EXPLAIN (ANALYZE, TIMING) 
SELECT COUNT(*) FROM services 
WHERE company_id = 962302 
AND is_active = true;

-- 4. Быстрый тест на клиентах
EXPLAIN (ANALYZE, TIMING)
SELECT COUNT(*) FROM clients 
WHERE company_id = 962302;

-- 5. Сравнение с полным сканированием таблицы
-- Этот запрос НЕ будет использовать индекс (для сравнения)
EXPLAIN (ANALYZE, TIMING)
SELECT COUNT(*) FROM services 
WHERE is_active = true;

-- Если вы видите:
-- "Index Scan" или "Bitmap Index Scan" - индекс используется ✅
-- "Seq Scan" - последовательное сканирование (медленно) ❌
-- 
-- Время выполнения:
-- С индексом: обычно < 1ms
-- Без индекса: может быть 10-100ms+