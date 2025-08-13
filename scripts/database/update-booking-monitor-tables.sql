-- Добавляем новую таблицу для отслеживания состояний записей
CREATE TABLE IF NOT EXISTS booking_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    yclients_record_id TEXT NOT NULL UNIQUE,
    company_id INTEGER NOT NULL,
    
    -- Текущее состояние записи
    attendance INTEGER DEFAULT 0, -- 2=подтверждена, 1=пришел, 0=ожидание, -1=не пришел
    datetime TIMESTAMP NOT NULL,
    
    -- Основные данные для отслеживания изменений
    services JSONB,
    staff_id INTEGER,
    staff_name TEXT,
    client_phone TEXT,
    client_name TEXT,
    price DECIMAL(10,2),
    
    -- История изменений
    last_attendance INTEGER, -- Предыдущий статус attendance
    last_datetime TIMESTAMP, -- Предыдущее время
    last_services JSONB, -- Предыдущие услуги
    last_staff_id INTEGER, -- Предыдущий мастер
    
    -- Метаданные
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_checked_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_booking_states_record_id ON booking_states(yclients_record_id);
CREATE INDEX IF NOT EXISTS idx_booking_states_company ON booking_states(company_id);
CREATE INDEX IF NOT EXISTS idx_booking_states_datetime ON booking_states(datetime);
CREATE INDEX IF NOT EXISTS idx_booking_states_attendance ON booking_states(attendance);

-- Обновляем таблицу booking_notifications для новых типов уведомлений
ALTER TABLE booking_notifications 
ADD COLUMN IF NOT EXISTS notification_type_new TEXT CHECK (notification_type_new IN (
    'booking_created',      -- Новая запись создана
    'booking_cancelled',    -- Запись отменена (attendance = -1)
    'booking_time_changed', -- Изменено время записи
    'booking_service_changed', -- Изменены услуги
    'booking_staff_changed',   -- Изменен мастер
    'booking_reminder'         -- Напоминание (на будущее)
));

-- Миграция старого поля notification_type
UPDATE booking_notifications 
SET notification_type_new = notification_type 
WHERE notification_type_new IS NULL;

-- Комментарии
COMMENT ON TABLE booking_states IS 'Отслеживание состояний записей для определения изменений';
COMMENT ON COLUMN booking_states.attendance IS '2=подтверждена, 1=пришел, 0=ожидание, -1=не пришел';
COMMENT ON COLUMN booking_states.last_attendance IS 'Предыдущий статус для определения изменений';