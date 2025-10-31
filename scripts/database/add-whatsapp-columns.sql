-- Добавление колонок для WhatsApp интеграции в таблицу companies
-- Выполнить в Supabase SQL Editor

-- Добавляем колонку для статуса подключения WhatsApp
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS whatsapp_connected BOOLEAN DEFAULT FALSE;

-- Добавляем колонку для номера WhatsApp
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(20);

-- Добавляем колонку для времени подключения
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS whatsapp_connected_at TIMESTAMPTZ;

-- Добавляем колонку для статуса интеграции
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS integration_status VARCHAR(50) DEFAULT 'pending';

-- Добавляем колонку для времени подключения (общее)
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;

-- Создаем индекс для быстрого поиска подключенных компаний
CREATE INDEX IF NOT EXISTS idx_companies_whatsapp_connected
ON companies(whatsapp_connected)
WHERE whatsapp_connected = true;

-- Создаем индекс для поиска по номеру WhatsApp
CREATE INDEX IF NOT EXISTS idx_companies_whatsapp_phone
ON companies(whatsapp_phone)
WHERE whatsapp_phone IS NOT NULL;

-- Комментарии к колонкам для документации
COMMENT ON COLUMN companies.whatsapp_connected IS 'Статус подключения WhatsApp (true = подключен)';
COMMENT ON COLUMN companies.whatsapp_phone IS 'Номер телефона WhatsApp бота компании';
COMMENT ON COLUMN companies.whatsapp_connected_at IS 'Время последнего подключения WhatsApp';
COMMENT ON COLUMN companies.integration_status IS 'Статус интеграции: pending, active, inactive, error';
COMMENT ON COLUMN companies.connected_at IS 'Время первого подключения к системе';

-- Проверяем результат
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'companies'
AND column_name IN (
    'whatsapp_connected',
    'whatsapp_phone',
    'whatsapp_connected_at',
    'integration_status',
    'connected_at'
)
ORDER BY ordinal_position;