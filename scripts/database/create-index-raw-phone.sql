-- Создание индекса на raw_phone для быстрого поиска клиентов
-- Этот индекс ускорит поиск клиентов по номеру телефона с +

-- Создаем индекс на raw_phone
CREATE INDEX IF NOT EXISTS idx_clients_raw_phone_company 
ON clients(raw_phone, company_id)
WHERE raw_phone IS NOT NULL;

-- Анализируем таблицу для обновления статистики
ANALYZE clients;

-- Проверяем созданный индекс
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'clients'
AND indexname = 'idx_clients_raw_phone_company';