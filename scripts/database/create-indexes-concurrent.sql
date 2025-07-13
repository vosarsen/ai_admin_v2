-- AI Admin v2 - Database Performance Optimization Indexes (CONCURRENT VERSION)
-- Используйте этот скрипт для production, чтобы создавать индексы без блокировки таблиц
-- ВАЖНО: Выполняйте каждую команду CREATE INDEX CONCURRENTLY отдельно!

-- =====================================================
-- ИНСТРУКЦИЯ ПО ПРИМЕНЕНИЮ
-- =====================================================
-- 1. Подключитесь к базе через psql или pgAdmin
-- 2. Выполняйте каждую команду CREATE INDEX CONCURRENTLY отдельно
-- 3. Дождитесь завершения каждой команды перед выполнением следующей
-- 4. CONCURRENTLY позволяет создавать индексы без блокировки таблиц

-- =====================================================
-- ВЫСОКИЙ ПРИОРИТЕТ - Критичные для производительности
-- =====================================================

-- 1. SERVICES - Поиск активных услуг компании
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_company_active 
ON services(company_id, is_active) 
WHERE is_active = true;

-- 2. SERVICES - Сортировка по популярности
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_company_weight 
ON services(company_id, weight DESC, is_active) 
WHERE is_active = true;

-- 3. STAFF - Поиск активных мастеров компании
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staff_company_active 
ON staff(company_id, is_active) 
WHERE is_active = true;

-- 4. STAFF - Сортировка по рейтингу
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staff_company_rating 
ON staff(company_id, rating DESC NULLS LAST, is_active) 
WHERE is_active = true;

-- 5. STAFF_SCHEDULES - Поиск расписания на дату
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staff_schedules_lookup 
ON staff_schedules(company_id, date, staff_id) 
WHERE is_working = true;

-- 6. STAFF_SCHEDULES - Поиск по имени мастера
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staff_schedules_name_date 
ON staff_schedules(staff_name, date) 
WHERE is_working = true;

-- 7. CLIENTS - Поиск по телефону
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_phone_company 
ON clients(phone, company_id);

-- 8. CLIENTS - Поиск по имени
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_name_company 
ON clients(name, company_id);

-- 9. DIALOG_CONTEXTS - Уникальный индекс по user_id
-- Проверка существования:
-- SELECT * FROM pg_indexes WHERE indexname = 'idx_dialog_contexts_user';
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_dialog_contexts_user 
ON dialog_contexts(user_id);

-- 10. DIALOG_CONTEXTS - Фильтрация по компании
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dialog_contexts_company 
ON dialog_contexts(company_id, last_activity DESC);

-- =====================================================
-- СРЕДНИЙ ПРИОРИТЕТ - Важные для аналитики
-- =====================================================

-- 11. APPOINTMENTS_CACHE - История клиента
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_client_history 
ON appointments_cache(client_id, appointment_datetime DESC)
WHERE is_cancelled = false;

-- 12. APPOINTMENTS_CACHE - Предстоящие записи
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_upcoming 
ON appointments_cache(company_id, appointment_datetime)
WHERE appointment_datetime > CURRENT_TIMESTAMP AND is_cancelled = false;

-- 13. CLIENTS - Сортировка по количеству визитов
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_visit_count 
ON clients(company_id, visit_count DESC)
WHERE blacklisted = false;

-- 14. STAFF_SCHEDULES - Поиск по дате и компании
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staff_schedules_company_date
ON staff_schedules(company_id, date)
WHERE is_working = true;

-- 15. SERVICES - Поиск по категории
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_category
ON services(company_id, category_id, is_active)
WHERE is_active = true;

-- =====================================================
-- ФИНАЛЬНЫЕ ДЕЙСТВИЯ
-- =====================================================

-- После создания всех индексов выполните:
ANALYZE services;
ANALYZE staff;
ANALYZE staff_schedules;
ANALYZE clients;
ANALYZE dialog_contexts;
ANALYZE appointments_cache;

-- Проверка созданных индексов:
SELECT 
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_indexes 
JOIN pg_stat_user_indexes USING (schemaname, tablename, indexname)
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;