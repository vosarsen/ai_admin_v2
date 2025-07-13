-- AI Admin v2 - Создание индексов (УПРОЩЕННАЯ ВЕРСИЯ)
-- Безопасная версия для выполнения в Supabase SQL Editor

-- =====================================================
-- СОЗДАНИЕ ИНДЕКСОВ
-- =====================================================

-- 1. SERVICES
CREATE INDEX IF NOT EXISTS idx_services_company_active 
ON services(company_id, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_services_company_weight 
ON services(company_id, weight DESC, is_active) 
WHERE is_active = true;

-- 2. STAFF
CREATE INDEX IF NOT EXISTS idx_staff_company_active 
ON staff(company_id, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_staff_company_rating 
ON staff(company_id, rating DESC NULLS LAST, is_active) 
WHERE is_active = true;

-- 3. STAFF_SCHEDULES (без company_id, если его еще нет)
CREATE INDEX IF NOT EXISTS idx_staff_schedules_date_staff
ON staff_schedules(date, staff_id) 
WHERE is_working = true;

CREATE INDEX IF NOT EXISTS idx_staff_schedules_name_date 
ON staff_schedules(staff_name, date) 
WHERE is_working = true;

-- 4. CLIENTS
CREATE INDEX IF NOT EXISTS idx_clients_phone_company 
ON clients(phone, company_id);

CREATE INDEX IF NOT EXISTS idx_clients_name_company 
ON clients(name, company_id);

-- 5. DIALOG_CONTEXTS
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

-- Индекс по company_id (если колонка существует)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'dialog_contexts' 
        AND column_name = 'company_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_dialog_contexts_company 
        ON dialog_contexts(company_id, last_activity DESC);
    END IF;
END $$;

-- 6. APPOINTMENTS_CACHE
CREATE INDEX IF NOT EXISTS idx_appointments_client_history 
ON appointments_cache(client_id, appointment_datetime DESC)
WHERE is_cancelled = false;

CREATE INDEX IF NOT EXISTS idx_appointments_upcoming 
ON appointments_cache(company_id, appointment_datetime)
WHERE appointment_datetime > CURRENT_TIMESTAMP AND is_cancelled = false;

-- 7. CLIENTS дополнительный
CREATE INDEX IF NOT EXISTS idx_clients_visit_count 
ON clients(company_id, visit_count DESC)
WHERE blacklisted = false;

-- 8. SERVICES дополнительный
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
-- ПРОВЕРКА РЕЗУЛЬТАТОВ
-- =====================================================

-- Список созданных индексов
SELECT 
    tablename as "Таблица",
    indexname as "Индекс",
    indexdef as "Определение"
FROM pg_indexes
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Подсчет индексов
SELECT 
    COUNT(*) as "Всего индексов idx_*"
FROM pg_indexes
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%';

-- =====================================================
-- ТЕСТОВЫЕ ЗАПРОСЫ
-- =====================================================

-- Проверка индекса services
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM services 
WHERE company_id = 962302 
AND is_active = true 
ORDER BY weight DESC 
LIMIT 20;

-- Проверка индекса clients
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM clients 
WHERE phone = '79001234567' 
AND company_id = 962302;