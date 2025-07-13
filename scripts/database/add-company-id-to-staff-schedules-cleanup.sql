-- AI Admin v2 - Добавление company_id в таблицу staff_schedules (ВАРИАНТ С ОЧИСТКОЙ)
-- Удаляет записи без соответствующего staff_id

-- =====================================================
-- АНАЛИЗ И ОЧИСТКА ДАННЫХ
-- =====================================================

-- 1. Показываем записи, которые будут удалены
SELECT 
    ss.id,
    ss.staff_id,
    ss.staff_name,
    ss.date,
    'Will be deleted - no matching staff' as reason
FROM staff_schedules ss
LEFT JOIN staff s ON ss.staff_id = s.yclients_id
WHERE s.yclients_id IS NULL
LIMIT 20;

-- 2. Подсчитываем количество записей для удаления
SELECT 
    COUNT(*) as records_to_delete
FROM staff_schedules ss
LEFT JOIN staff s ON ss.staff_id = s.yclients_id
WHERE s.yclients_id IS NULL;

-- 3. Удаляем записи без соответствующего staff
DELETE FROM staff_schedules ss
WHERE NOT EXISTS (
    SELECT 1 FROM staff s 
    WHERE s.yclients_id = ss.staff_id
);

-- =====================================================
-- ДОБАВЛЕНИЕ КОЛОНКИ company_id
-- =====================================================

-- 1. Добавляем колонку company_id
ALTER TABLE staff_schedules 
ADD COLUMN IF NOT EXISTS company_id bigint;

-- 2. Заполняем company_id из таблицы staff (теперь все должны найтись)
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

-- 4. Делаем колонку NOT NULL
ALTER TABLE staff_schedules 
ALTER COLUMN company_id SET NOT NULL;

-- =====================================================
-- СОЗДАНИЕ ИНДЕКСОВ
-- =====================================================

-- Такие же индексы, как в предыдущем скрипте
CREATE INDEX IF NOT EXISTS idx_staff_schedules_lookup 
ON staff_schedules(company_id, date, staff_id) 
WHERE is_working = true;

CREATE INDEX IF NOT EXISTS idx_staff_schedules_company_date
ON staff_schedules(company_id, date)
WHERE is_working = true;

CREATE INDEX IF NOT EXISTS idx_staff_schedules_name_date 
ON staff_schedules(staff_name, date) 
WHERE is_working = true;

ANALYZE staff_schedules;

-- Финальная проверка
SELECT 
    'Cleanup migration completed' as status,
    COUNT(*) as remaining_records,
    COUNT(DISTINCT company_id) as unique_companies
FROM staff_schedules;