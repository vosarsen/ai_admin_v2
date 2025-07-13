-- AI Admin v2 - Добавление company_id в таблицу staff_schedules
-- Это улучшит производительность запросов и упростит фильтрацию по компании

-- =====================================================
-- АНАЛИЗ ТЕКУЩЕЙ СИТУАЦИИ
-- =====================================================

-- 1. Проверяем текущую структуру таблицы
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'staff_schedules'
ORDER BY ordinal_position;

-- 2. Проверяем количество записей для оценки времени миграции
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT staff_id) as unique_staff
FROM staff_schedules;

-- =====================================================
-- ДОБАВЛЕНИЕ КОЛОНКИ company_id
-- =====================================================

-- 1. Добавляем колонку company_id
ALTER TABLE staff_schedules 
ADD COLUMN IF NOT EXISTS company_id bigint;

-- 2. Заполняем company_id из таблицы staff
UPDATE staff_schedules ss
SET company_id = s.company_id
FROM staff s
WHERE ss.staff_id = s.yclients_id;

-- 3. Проверяем результат
SELECT 
    COUNT(*) as total_records,
    COUNT(company_id) as filled_company_ids,
    COUNT(*) FILTER (WHERE company_id IS NULL) as null_company_ids
FROM staff_schedules;

-- 4. Делаем колонку NOT NULL (если все значения заполнены)
-- Выполните эту команду только если null_company_ids = 0
ALTER TABLE staff_schedules 
ALTER COLUMN company_id SET NOT NULL;

-- =====================================================
-- СОЗДАНИЕ ИНДЕКСОВ
-- =====================================================

-- Теперь можем создать эффективные индексы с company_id

-- 1. Основной индекс для поиска расписания
CREATE INDEX IF NOT EXISTS idx_staff_schedules_lookup 
ON staff_schedules(company_id, date, staff_id) 
WHERE is_working = true;

-- 2. Индекс для поиска по дате и компании
CREATE INDEX IF NOT EXISTS idx_staff_schedules_company_date
ON staff_schedules(company_id, date)
WHERE is_working = true;

-- 3. Сохраняем индекс по имени мастера
CREATE INDEX IF NOT EXISTS idx_staff_schedules_name_date 
ON staff_schedules(staff_name, date) 
WHERE is_working = true;

-- =====================================================
-- ОБНОВЛЕНИЕ СТАТИСТИКИ
-- =====================================================

ANALYZE staff_schedules;

-- =====================================================
-- ФИНАЛЬНАЯ ПРОВЕРКА
-- =====================================================

-- Проверяем новую структуру
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'staff_schedules'
AND column_name = 'company_id';

-- Проверяем созданные индексы
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename = 'staff_schedules'
ORDER BY indexname;