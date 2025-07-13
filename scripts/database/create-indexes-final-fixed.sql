-- AI Admin v2 - Database Performance Optimization Indexes (FIXED)
-- Выполнять ПОСЛЕ добавления company_id в staff_schedules

-- =====================================================
-- ВЫСОКИЙ ПРИОРИТЕТ - Критичные для производительности
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

-- 5. STAFF_SCHEDULES - Поиск расписания на дату (с company_id)
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

-- 9. DIALOG_CONTEXTS - Поиск контекста пользователя
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
CREATE INDEX IF NOT EXISTS idx_dialog_contexts_company 
ON dialog_contexts(company_id, last_activity DESC);

-- =====================================================
-- СРЕДНИЙ ПРИОРИТЕТ - Важные для аналитики
-- =====================================================

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

-- 14. STAFF_SCHEDULES - Поиск по дате и компании
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
-- ПРОВЕРКА СОЗДАННЫХ ИНДЕКСОВ (ИСПРАВЛЕННАЯ ВЕРСИЯ)
-- =====================================================

-- Вариант 1: Простой список индексов
SELECT 
    i.tablename as "Таблица",
    i.indexname as "Индекс",
    pg_size_pretty(pg_relation_size(i.indexrelid::regclass)) as "Размер"
FROM pg_indexes i
WHERE i.schemaname = 'public' 
AND i.indexname LIKE 'idx_%'
AND i.tablename IN ('services', 'staff', 'staff_schedules', 'clients', 'dialog_contexts', 'appointments_cache')
ORDER BY i.tablename, i.indexname;

-- =====================================================
-- ДЕТАЛЬНАЯ СТАТИСТИКА ИНДЕКСОВ
-- =====================================================

-- Вариант 2: С использованием статистики (если доступна)
SELECT 
    n.nspname as "Схема",
    c.relname as "Таблица",
    i.relname as "Индекс",
    pg_size_pretty(pg_relation_size(i.oid)) as "Размер",
    idx_stat.idx_scan as "Использований",
    idx_stat.idx_tup_read as "Прочитано строк",
    idx_stat.idx_tup_fetch as "Извлечено строк"
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_index idx ON idx.indrelid = c.oid
JOIN pg_class i ON i.oid = idx.indexrelid
LEFT JOIN pg_stat_user_indexes idx_stat ON idx_stat.indexrelid = idx.indexrelid
WHERE n.nspname = 'public'
AND i.relname LIKE 'idx_%'
AND c.relname IN ('services', 'staff', 'staff_schedules', 'clients', 'dialog_contexts', 'appointments_cache')
ORDER BY c.relname, i.relname;

-- =====================================================
-- ИТОГОВАЯ СТАТИСТИКА (УПРОЩЕННАЯ)
-- =====================================================

SELECT 
    'Индексы успешно созданы!' as "Статус",
    COUNT(*) as "Всего индексов",
    pg_size_pretty(SUM(pg_relation_size(indexrelid::regclass))) as "Общий размер"
FROM pg_indexes
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%';

-- =====================================================
-- ПРОВЕРКА ИСПОЛЬЗОВАНИЯ ИНДЕКСОВ
-- =====================================================

-- Пример запроса для проверки использования индекса
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM services 
WHERE company_id = 962302 
AND is_active = true 
ORDER BY weight DESC 
LIMIT 20;

-- Пример запроса для staff_schedules
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM staff_schedules
WHERE company_id = 962302
AND date >= CURRENT_DATE
AND date <= CURRENT_DATE + INTERVAL '7 days'
AND is_working = true;