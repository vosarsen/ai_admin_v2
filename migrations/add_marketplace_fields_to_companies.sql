-- Миграция для добавления полей YClients Marketplace в таблицу companies
-- Дата создания: 02.10.2025

-- Добавляем поля для интеграции с YClients Marketplace
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS integration_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS marketplace_user_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS marketplace_user_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS marketplace_user_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS marketplace_user_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS whatsapp_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS whatsapp_connected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS whatsapp_session_data TEXT,
ADD COLUMN IF NOT EXISTS api_key VARCHAR(255),
ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;

-- Создаем индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_companies_integration_status
ON companies(integration_status);

CREATE INDEX IF NOT EXISTS idx_companies_whatsapp_connected
ON companies(whatsapp_connected)
WHERE whatsapp_connected = true;

CREATE INDEX IF NOT EXISTS idx_companies_marketplace_user_id
ON companies(marketplace_user_id)
WHERE marketplace_user_id IS NOT NULL;

-- Добавляем комментарии к колонкам для документации
COMMENT ON COLUMN companies.integration_status IS 'Статус интеграции: pending, pending_whatsapp, active, frozen, uninstalled';
COMMENT ON COLUMN companies.marketplace_user_id IS 'ID пользователя, который подключил интеграцию в YClients';
COMMENT ON COLUMN companies.marketplace_user_name IS 'Имя пользователя из YClients';
COMMENT ON COLUMN companies.marketplace_user_phone IS 'Телефон пользователя из YClients';
COMMENT ON COLUMN companies.marketplace_user_email IS 'Email пользователя из YClients';
COMMENT ON COLUMN companies.whatsapp_connected IS 'Флаг успешного подключения WhatsApp';
COMMENT ON COLUMN companies.whatsapp_phone IS 'Номер WhatsApp салона';
COMMENT ON COLUMN companies.whatsapp_connected_at IS 'Дата и время подключения WhatsApp';
COMMENT ON COLUMN companies.whatsapp_session_data IS 'Зашифрованные данные сессии WhatsApp';
COMMENT ON COLUMN companies.api_key IS 'Внутренний API ключ для webhook авторизации';
COMMENT ON COLUMN companies.webhook_secret IS 'Секрет для проверки подписи webhook';
COMMENT ON COLUMN companies.last_payment_date IS 'Дата последней оплаты через маркетплейс';
COMMENT ON COLUMN companies.connected_at IS 'Дата первоначального подключения через маркетплейс';

-- Создаем таблицу для логирования событий маркетплейса
CREATE TABLE IF NOT EXISTS marketplace_events (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    salon_id INTEGER NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_events_company_id
ON marketplace_events(company_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_events_salon_id
ON marketplace_events(salon_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_events_event_type
ON marketplace_events(event_type);

CREATE INDEX IF NOT EXISTS idx_marketplace_events_created_at
ON marketplace_events(created_at DESC);

-- Создаем таблицу для хранения токенов интеграции
CREATE TABLE IF NOT EXISTS marketplace_tokens (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    salon_id INTEGER NOT NULL,
    token_type VARCHAR(50) NOT NULL, -- 'access', 'refresh'
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_tokens_unique
ON marketplace_tokens(company_id, token_type);

CREATE INDEX IF NOT EXISTS idx_marketplace_tokens_salon_id
ON marketplace_tokens(salon_id);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_marketplace_tokens_updated_at
BEFORE UPDATE ON marketplace_tokens
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Добавляем примеры статусов интеграции для справки
-- pending: Ожидание подключения WhatsApp
-- pending_whatsapp: QR-код отображен, ожидаем сканирования
-- active: Полностью подключено и работает
-- frozen: Заморожено (например, неоплата)
-- uninstalled: Удалено из маркетплейса

-- Rollback script (если нужно откатить миграцию)
-- ALTER TABLE companies
-- DROP COLUMN IF EXISTS integration_status,
-- DROP COLUMN IF EXISTS marketplace_user_id,
-- DROP COLUMN IF EXISTS marketplace_user_name,
-- DROP COLUMN IF EXISTS marketplace_user_phone,
-- DROP COLUMN IF EXISTS marketplace_user_email,
-- DROP COLUMN IF EXISTS whatsapp_connected,
-- DROP COLUMN IF EXISTS whatsapp_phone,
-- DROP COLUMN IF EXISTS whatsapp_connected_at,
-- DROP COLUMN IF EXISTS whatsapp_session_data,
-- DROP COLUMN IF EXISTS api_key,
-- DROP COLUMN IF EXISTS webhook_secret,
-- DROP COLUMN IF EXISTS last_payment_date,
-- DROP COLUMN IF EXISTS connected_at;

-- DROP TABLE IF EXISTS marketplace_events;
-- DROP TABLE IF EXISTS marketplace_tokens;