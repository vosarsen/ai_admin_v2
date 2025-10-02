-- Таблицы для системы подписок и платежей AI Admin
-- Для использования с Supabase (PostgreSQL)

-- 1. Тарифные планы
CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10, 2) NOT NULL,
    price_yearly DECIMAL(10, 2),

    -- Лимиты
    messages_per_month INTEGER DEFAULT NULL, -- NULL = unlimited
    active_conversations INTEGER DEFAULT NULL,
    ai_requests_per_day INTEGER DEFAULT NULL,
    whatsapp_connections INTEGER DEFAULT 1,

    -- Функции
    features JSONB DEFAULT '{}', -- {booking: true, reminders: true, analytics: false}

    -- Метаданные
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Подписки компаний
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),

    -- Статусы: trialing, active, past_due, canceled, paused
    status VARCHAR(20) NOT NULL DEFAULT 'trialing',

    -- Даты
    trial_ends_at TIMESTAMP,
    started_at TIMESTAMP DEFAULT NOW(),
    current_period_start TIMESTAMP DEFAULT NOW(),
    current_period_end TIMESTAMP,
    canceled_at TIMESTAMP,
    ended_at TIMESTAMP,

    -- Биллинг
    billing_cycle VARCHAR(10) DEFAULT 'monthly', -- monthly, yearly
    next_payment_date DATE,
    auto_renew BOOLEAN DEFAULT true,

    -- T-Bank специфичные поля
    tbank_subscription_id VARCHAR(255),
    tbank_customer_id VARCHAR(255),

    -- Использование
    usage_data JSONB DEFAULT '{}', -- {messages_sent: 0, ai_requests: 0}

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(company_id, status) -- Только одна активная подписка на компанию
);

-- 3. Платежи
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,

    -- Суммы
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',

    -- Статусы: pending, processing, succeeded, failed, refunded
    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    -- Детали платежа
    payment_method VARCHAR(50), -- card, sbp, yoomoney
    payment_details JSONB DEFAULT '{}', -- {last4: "4242", brand: "visa"}

    -- T-Bank данные
    tbank_payment_id VARCHAR(255) UNIQUE,
    tbank_order_id VARCHAR(255),
    tbank_receipt_url TEXT,

    -- Фискализация
    fiscal_receipt_url TEXT,
    fiscal_status VARCHAR(20), -- pending, sent, delivered, failed

    -- Метаданные
    description TEXT,
    metadata JSONB DEFAULT '{}',

    -- Временные метки
    paid_at TIMESTAMP,
    failed_at TIMESTAMP,
    refunded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Счета (инвойсы)
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
    payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,

    invoice_number VARCHAR(50) UNIQUE,

    -- Суммы
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,

    -- Статусы: draft, open, paid, void, uncollectible
    status VARCHAR(20) DEFAULT 'draft',

    -- Даты
    due_date DATE,
    paid_at TIMESTAMP,

    -- Детали
    line_items JSONB NOT NULL DEFAULT '[]',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Webhook события от T-Bank
CREATE TABLE IF NOT EXISTS payment_webhooks (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE,
    event_type VARCHAR(100) NOT NULL, -- payment.succeeded, payment.failed, etc

    payment_id INTEGER REFERENCES payments(id),

    -- Сырые данные от T-Bank
    payload JSONB NOT NULL,

    -- Обработка
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP,
    error TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. История использования (для лимитов)
CREATE TABLE IF NOT EXISTS subscription_usage (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,

    -- Период
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Счетчики
    messages_sent INTEGER DEFAULT 0,
    ai_requests INTEGER DEFAULT 0,
    active_conversations INTEGER DEFAULT 0,

    -- Превышения
    overage_charges DECIMAL(10, 2) DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(subscription_id, period_start)
);

-- Индексы для производительности
CREATE INDEX idx_subscriptions_company_status ON subscriptions(company_id, status);
CREATE INDEX idx_subscriptions_next_payment ON subscriptions(next_payment_date) WHERE status = 'active';
CREATE INDEX idx_payments_company ON payments(company_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_tbank_id ON payments(tbank_payment_id);
CREATE INDEX idx_invoices_company ON invoices(company_id);
CREATE INDEX idx_webhooks_processed ON payment_webhooks(processed, created_at);
CREATE INDEX idx_usage_subscription_period ON subscription_usage(subscription_id, period_start);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Базовые тарифные планы
INSERT INTO subscription_plans (name, display_name, description, price_monthly, price_yearly, messages_per_month, active_conversations, ai_requests_per_day, features, sort_order) VALUES
('free', 'Бесплатный', 'Для знакомства с сервисом', 0, 0, 100, 10, 50, '{"booking": true, "reminders": false, "analytics": false, "custom_scenarios": false}', 1),
('starter', 'Старт', 'Для небольших салонов', 2990, 29900, 1000, 50, 500, '{"booking": true, "reminders": true, "analytics": false, "custom_scenarios": false}', 2),
('professional', 'Профессиональный', 'Для растущего бизнеса', 5990, 59900, 5000, 200, 2000, '{"booking": true, "reminders": true, "analytics": true, "custom_scenarios": true}', 3),
('unlimited', 'Безлимитный', 'Без ограничений', 9990, 99900, NULL, NULL, NULL, '{"booking": true, "reminders": true, "analytics": true, "custom_scenarios": true, "priority_support": true}', 4),
('pilot', 'Пилотный', 'Специальное предложение для первых клиентов', 990, 9900, 3000, 100, 1000, '{"booking": true, "reminders": true, "analytics": true, "custom_scenarios": false}', 0);

-- Добавляем поля подписки в таблицу companies (если их еще нет)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'inactive';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;

-- Комментарии для документации
COMMENT ON TABLE subscription_plans IS 'Тарифные планы для AI Admin';
COMMENT ON TABLE subscriptions IS 'Подписки компаний на тарифные планы';
COMMENT ON TABLE payments IS 'История платежей компаний';
COMMENT ON TABLE invoices IS 'Счета для компаний';
COMMENT ON TABLE payment_webhooks IS 'Webhook события от платежной системы T-Bank';
COMMENT ON TABLE subscription_usage IS 'История использования ресурсов по подпискам';

COMMENT ON COLUMN subscriptions.status IS 'trialing - пробный период, active - активна, past_due - просрочена, canceled - отменена, paused - приостановлена';
COMMENT ON COLUMN payments.status IS 'pending - ожидает, processing - обрабатывается, succeeded - успешно, failed - неудачно, refunded - возвращен';
COMMENT ON COLUMN invoices.status IS 'draft - черновик, open - выставлен, paid - оплачен, void - аннулирован, uncollectible - безнадежный';