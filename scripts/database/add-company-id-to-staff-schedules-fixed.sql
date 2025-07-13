-- AI Admin v2 - Добавление company_id в таблицу staff_schedules (ИСПРАВЛЕННАЯ ВЕРСИЯ)
-- Обрабатывает случаи, когда staff_id не найден в таблице staff

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

-- 2. Проверяем количество записей и потенциальные проблемы
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT staff_id) as unique_staff
FROM staff_schedules;

-- 3. ВАЖНО: Проверяем записи без соответствия в таблице staff
SELECT 
    COUNT(*) as unmatched_records,
    array_agg(DISTINCT ss.staff_id) as unmatched_staff_ids
FROM staff_schedules ss
LEFT JOIN staff s ON ss.staff_id = s.yclients_id
WHERE s.yclients_id IS NULL;

-- =====================================================
-- ДОБАВЛЕНИЕ КОЛОНКИ company_id
-- =====================================================

-- 1. Добавляем колонку company_id (если еще не существует)
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

-- 4. Обрабатываем записи с NULL company_id
-- Вариант А: Если есть записи без company_id, найдем дефолтную компанию
DO $$
DECLARE
    default_company_id bigint;
    null_count integer;
BEGIN
    -- Проверяем, есть ли NULL значения
    SELECT COUNT(*) INTO null_count
    FROM staff_schedules
    WHERE company_id IS NULL;
    
    IF null_count > 0 THEN
        -- Находим наиболее часто используемую компанию
        SELECT company_id INTO default_company_id
        FROM staff_schedules
        WHERE company_id IS NOT NULL
        GROUP BY company_id
        ORDER BY COUNT(*) DESC
        LIMIT 1;
        
        -- Если не нашли, берем первую доступную компанию
        IF default_company_id IS NULL THEN
            SELECT company_id INTO default_company_id
            FROM companies
            LIMIT 1;
        END IF;
        
        -- Обновляем NULL значения
        IF default_company_id IS NOT NULL THEN
            UPDATE staff_schedules
            SET company_id = default_company_id
            WHERE company_id IS NULL;
            
            RAISE NOTICE 'Updated % records with default company_id: %', null_count, default_company_id;
        ELSE
            RAISE WARNING 'No companies found in database. Cannot set default company_id';
        END IF;
    END IF;
END $$;

-- 5. Финальная проверка
SELECT 
    COUNT(*) as total_records,
    COUNT(company_id) as filled_company_ids,
    COUNT(*) FILTER (WHERE company_id IS NULL) as null_company_ids
FROM staff_schedules;

-- 6. Делаем колонку NOT NULL только если все значения заполнены
DO $$
DECLARE
    null_count integer;
BEGIN
    SELECT COUNT(*) INTO null_count
    FROM staff_schedules
    WHERE company_id IS NULL;
    
    IF null_count = 0 THEN
        ALTER TABLE staff_schedules 
        ALTER COLUMN company_id SET NOT NULL;
        RAISE NOTICE 'Successfully set company_id to NOT NULL';
    ELSE
        RAISE WARNING 'Cannot set company_id to NOT NULL: % records still have NULL values', null_count;
    END IF;
END $$;

-- =====================================================
-- СОЗДАНИЕ ИНДЕКСОВ
-- =====================================================

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
-- ФИНАЛЬНАЯ ПРОВЕРКА И ОТЧЕТ
-- =====================================================

-- Показываем финальную структуру
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'staff_schedules'
AND column_name = 'company_id';

-- Показываем созданные индексы
SELECT 
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_indexes
JOIN pg_stat_user_indexes USING (schemaname, tablename, indexname)
WHERE schemaname = 'public'
AND tablename = 'staff_schedules'
AND indexname LIKE 'idx_%'
ORDER BY indexname;

-- Отчет о миграции
SELECT 
    'Migration completed' as status,
    COUNT(DISTINCT company_id) as unique_companies,
    COUNT(*) as total_records
FROM staff_schedules;