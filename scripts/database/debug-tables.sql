-- Проверяем структуру таблиц в базе данных

-- 1. Проверяем, существует ли таблица dialog_contexts
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'dialog_contexts'
) as "dialog_contexts существует?";

-- 2. Если таблица существует, смотрим её структуру
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'dialog_contexts'
ORDER BY ordinal_position;

-- 3. Проверяем все таблицы в схеме public
SELECT 
    table_name,
    COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;

-- 4. Ищем колонку company_id во всех таблицах
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name = 'company_id'
ORDER BY table_name;