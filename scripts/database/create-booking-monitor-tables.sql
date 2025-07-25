-- Таблица для хранения состояния мониторинга записей
CREATE TABLE IF NOT EXISTS booking_monitor_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    company_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Таблица для отслеживания отправленных уведомлений
CREATE TABLE IF NOT EXISTS booking_notifications (
    id SERIAL PRIMARY KEY,
    yclients_record_id INTEGER NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL,
    booking_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_booking_notifications_phone ON booking_notifications(phone);
CREATE INDEX IF NOT EXISTS idx_booking_notifications_sent_at ON booking_notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_booking_notifications_record_id ON booking_notifications(yclients_record_id);

-- Комментарии к таблицам
COMMENT ON TABLE booking_monitor_state IS 'Состояние мониторинга новых записей';
COMMENT ON TABLE booking_notifications IS 'История отправленных уведомлений о записях';

-- Инициализируем состояние мониторинга
INSERT INTO booking_monitor_state (id, last_checked_at, company_id)
VALUES (1, NOW() - INTERVAL '1 hour', 962302)
ON CONFLICT (id) DO NOTHING;