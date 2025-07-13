-- AI Admin v2 - Миграция типа company_id в dialog_contexts
-- Меняем тип с text на bigint для консистентности с другими таблицами

-- =====================================================
-- ПРЕДВАРИТЕЛЬНАЯ ПРОВЕРКА
-- =====================================================

-- 1. Проверяем текущие данные
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT company_id) as unique_companies,
    COUNT(*) FILTER (WHERE company_id IS NULL) as null_companies,
    COUNT(*) FILTER (WHERE company_id !~ '^\d+$') as non_numeric_companies
FROM dialog_contexts;

-- 2. Показываем примеры данных
SELECT 
    id,
    user_id,
    company_id,
    created_at
FROM dialog_contexts
LIMIT 10;

-- 3. Проверяем, есть ли не-числовые значения
SELECT DISTINCT company_id
FROM dialog_contexts
WHERE company_id IS NOT NULL 
AND company_id !~ '^\d+$'
LIMIT 10;

-- =====================================================
-- МИГРАЦИЯ (выполнять по одной команде)
-- =====================================================

-- 1. Создаем временную колонку
ALTER TABLE dialog_contexts 
ADD COLUMN IF NOT EXISTS company_id_new bigint;

-- 2. Копируем данные с преобразованием типа
UPDATE dialog_contexts 
SET company_id_new = company_id::bigint
WHERE company_id IS NOT NULL 
AND company_id ~ '^\d+$';

-- 3. Проверяем результат
SELECT 
    COUNT(*) as migrated_records,
    COUNT(*) FILTER (WHERE company_id_new IS NULL AND company_id IS NOT NULL) as failed_migrations
FROM dialog_contexts;

-- 4. Удаляем старую колонку
ALTER TABLE dialog_contexts DROP COLUMN company_id;

-- 5. Переименовываем новую колонку
ALTER TABLE dialog_contexts RENAME COLUMN company_id_new TO company_id;

-- 6. Создаем индексы после миграции
CREATE INDEX IF NOT EXISTS idx_dialog_contexts_company 
ON dialog_contexts(company_id, last_activity DESC);

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
AND table_name = 'dialog_contexts'
AND column_name = 'company_id';

-- Проверяем консистентность типов
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name = 'company_id'
ORDER BY table_name;