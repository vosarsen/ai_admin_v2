-- Создание таблицы для хранения webhook событий
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  company_id INTEGER NOT NULL,
  record_id INTEGER,
  payload JSONB NOT NULL,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_company_id ON webhook_events(company_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);

-- Создание таблицы для истории уведомлений
CREATE TABLE IF NOT EXISTS booking_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yclients_record_id INTEGER,
  phone VARCHAR(20) NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  whatsapp_message_id VARCHAR(255),
  sent_at TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  error TEXT,
  company_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для таблицы уведомлений
CREATE INDEX IF NOT EXISTS idx_booking_notifications_record_id ON booking_notifications(yclients_record_id);
CREATE INDEX IF NOT EXISTS idx_booking_notifications_phone ON booking_notifications(phone);
CREATE INDEX IF NOT EXISTS idx_booking_notifications_sent_at ON booking_notifications(sent_at);

-- Комментарии к таблицам
COMMENT ON TABLE webhook_events IS 'История всех webhook событий от YClients';
COMMENT ON COLUMN webhook_events.event_id IS 'Уникальный ID события (для дедупликации)';
COMMENT ON COLUMN webhook_events.event_type IS 'Тип события: record.created, record.updated, record.deleted';
COMMENT ON COLUMN webhook_events.payload IS 'Полные данные события в JSON';
COMMENT ON COLUMN webhook_events.processed_at IS 'Время обработки события';

COMMENT ON TABLE booking_notifications IS 'История отправленных уведомлений в WhatsApp';
COMMENT ON COLUMN booking_notifications.notification_type IS 'Тип уведомления: booking_created, booking_updated, booking_cancelled';
COMMENT ON COLUMN booking_notifications.whatsapp_message_id IS 'ID сообщения в WhatsApp для отслеживания доставки';