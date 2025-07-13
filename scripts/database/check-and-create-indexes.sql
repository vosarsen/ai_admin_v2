-- AI Admin v2 - Проверка структуры таблиц и создание индексов
-- Сначала проверим, какие колонки существуют в таблицах

-- =====================================================
-- ПРОВЕРКА СТРУКТУРЫ ТАБЛИЦ
-- =====================================================

-- Проверяем структуру dialog_contexts
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'dialog_contexts'
ORDER BY ordinal_position;

-- Проверяем существующие индексы
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename = 'dialog_contexts';

-- =====================================================
-- СОЗДАНИЕ ИНДЕКСОВ С ПРОВЕРКОЙ
-- =====================================================

-- 1. SERVICES - Поиск активных услуг компании
CREATE INDEX IF NOT EXISTS idx_services_company_active 
ON services(company_id, is_active) 
WHERE is_active = true;

-- 2. SERVICES - Сортировка по популярности
CREATE INDEX IF NOT EXISTS idx_services_company_weight 
ON services(company_id, weight DESC, is_active) 
WHERE is_active = true;

-- 3. STAFF - Поиск активных мастеров компании
CREATE INDEX IF NOT EXISTS idx_staff_company_active 
ON staff(company_id, is_active) 
WHERE is_active = true;

-- 4. STAFF - Сортировка по рейтингу
CREATE INDEX IF NOT EXISTS idx_staff_company_rating 
ON staff(company_id, rating DESC NULLS LAST, is_active) 
WHERE is_active = true;

-- 5. STAFF_SCHEDULES - Поиск расписания на дату
CREATE INDEX IF NOT EXISTS idx_staff_schedules_lookup 
ON staff_schedules(company_id, date, staff_id) 
WHERE is_working = true;

-- 6. STAFF_SCHEDULES - Поиск по имени мастера
CREATE INDEX IF NOT EXISTS idx_staff_schedules_name_date 
ON staff_schedules(staff_name, date) 
WHERE is_working = true;

-- 7. CLIENTS - Поиск по телефону
CREATE INDEX IF NOT EXISTS idx_clients_phone_company 
ON clients(phone, company_id);

-- 8. CLIENTS - Поиск по имени
CREATE INDEX IF NOT EXISTS idx_clients_name_company 
ON clients(name, company_id);

-- 9. DIALOG_CONTEXTS - Поиск контекста пользователя (уникальный индекс)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'dialog_contexts' 
        AND indexname = 'idx_dialog_contexts_user'
    ) THEN
        CREATE UNIQUE INDEX idx_dialog_contexts_user 
        ON dialog_contexts(user_id);
    END IF;
END $$;

-- 10. DIALOG_CONTEXTS - Фильтрация по компании
-- Проверяем существование колонки company_id перед созданием индекса
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'dialog_contexts' 
        AND column_name = 'company_id'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_dialog_contexts_company 
                 ON dialog_contexts(company_id, last_activity DESC)';
    ELSE
        RAISE NOTICE 'Column company_id does not exist in dialog_contexts table';
    END IF;
END $$;

-- 11. APPOINTMENTS_CACHE - История клиента
CREATE INDEX IF NOT EXISTS idx_appointments_client_history 
ON appointments_cache(client_id, appointment_datetime DESC)
WHERE is_cancelled = false;

-- 12. APPOINTMENTS_CACHE - Предстоящие записи
CREATE INDEX IF NOT EXISTS idx_appointments_upcoming 
ON appointments_cache(company_id, appointment_datetime)
WHERE appointment_datetime > CURRENT_TIMESTAMP AND is_cancelled = false;

-- 13. CLIENTS - Сортировка по количеству визитов
CREATE INDEX IF NOT EXISTS idx_clients_visit_count 
ON clients(company_id, visit_count DESC)
WHERE blacklisted = false;

-- 14. STAFF_SCHEDULES - Поиск по дате и компании (для v2)
CREATE INDEX IF NOT EXISTS idx_staff_schedules_company_date
ON staff_schedules(company_id, date)
WHERE is_working = true;

-- 15. SERVICES - Поиск по категории
CREATE INDEX IF NOT EXISTS idx_services_category
ON services(company_id, category_id, is_active)
WHERE is_active = true;

-- =====================================================
-- ОБНОВЛЕНИЕ СТАТИСТИКИ
-- =====================================================

ANALYZE services;
ANALYZE staff;
ANALYZE staff_schedules;
ANALYZE clients;
ANALYZE dialog_contexts;
ANALYZE appointments_cache;

-- =====================================================
-- ФИНАЛЬНАЯ ПРОВЕРКА
-- =====================================================

SELECT 
    'Созданные индексы:' as info;

SELECT 
    tablename as "Таблица",
    indexname as "Индекс",
    pg_size_pretty(pg_relation_size(indexrelid)) as "Размер"
FROM pg_indexes 
JOIN pg_stat_user_indexes USING (schemaname, tablename, indexname)
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;