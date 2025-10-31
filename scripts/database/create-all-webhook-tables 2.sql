-- =====================================================
-- Создание всех таблиц для webhook уведомлений
-- =====================================================

-- 1. Таблица для хранения webhook событий
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

-- Индексы для webhook_events
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_company_id ON webhook_events(company_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed_at) WHERE processed_at IS NULL;

-- Комментарии
COMMENT ON TABLE webhook_events IS 'История всех webhook событий от YClients';
COMMENT ON COLUMN webhook_events.event_id IS 'Уникальный ID события для предотвращения дубликатов';
COMMENT ON COLUMN webhook_events.event_type IS 'Тип события: record.created, record.updated, record.deleted';
COMMENT ON COLUMN webhook_events.payload IS 'Полные данные события в JSON формате';
COMMENT ON COLUMN webhook_events.processed_at IS 'Время обработки события (NULL = не обработано)';

-- =====================================================

-- 2. Таблица для истории уведомлений
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

-- Индексы для booking_notifications
CREATE INDEX IF NOT EXISTS idx_booking_notifications_record_id ON booking_notifications(yclients_record_id);
CREATE INDEX IF NOT EXISTS idx_booking_notifications_phone ON booking_notifications(phone);
CREATE INDEX IF NOT EXISTS idx_booking_notifications_sent_at ON booking_notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_booking_notifications_type ON booking_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_booking_notifications_company ON booking_notifications(company_id);

-- Комментарии
COMMENT ON TABLE booking_notifications IS 'История всех отправленных WhatsApp уведомлений';
COMMENT ON COLUMN booking_notifications.notification_type IS 'Тип: booking_created, booking_updated, booking_cancelled';
COMMENT ON COLUMN booking_notifications.whatsapp_message_id IS 'ID сообщения в WhatsApp для отслеживания статуса доставки';
COMMENT ON COLUMN booking_notifications.error IS 'Текст ошибки если уведомление не было отправлено';

-- =====================================================

-- 3. Дополнения к таблице appointments_cache
ALTER TABLE appointments_cache 
ADD COLUMN IF NOT EXISTS created_by_bot BOOLEAN DEFAULT false;

ALTER TABLE appointments_cache 
ADD COLUMN IF NOT EXISTS client_phone VARCHAR(20);

-- Индексы для новых полей
CREATE INDEX IF NOT EXISTS idx_appointments_cache_created_by_bot 
ON appointments_cache(yclients_record_id, created_by_bot) 
WHERE created_by_bot = true;

CREATE INDEX IF NOT EXISTS idx_appointments_cache_client_phone 
ON appointments_cache(client_phone);

-- Комментарии
COMMENT ON COLUMN appointments_cache.created_by_bot IS 'Флаг, указывающий что запись создана через AI Admin бота';
COMMENT ON COLUMN appointments_cache.client_phone IS 'Телефон клиента для отправки уведомлений (дублируется для случаев удаления)';

-- =====================================================

-- 4. Обновление существующих записей
-- Помечаем записи созданные ботом по комментарию
UPDATE appointments_cache 
SET created_by_bot = true 
WHERE comment ILIKE '%AI Admin%' 
   OR comment ILIKE '%WhatsApp%'
   OR comment ILIKE '%бот%'
   OR comment ILIKE '%AI администратор%';

-- =====================================================

-- 5. Создание функции для автоматической очистки старых событий
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS void AS $$
BEGIN
  -- Удаляем обработанные события старше 30 дней
  DELETE FROM webhook_events 
  WHERE processed_at IS NOT NULL 
    AND created_at < NOW() - INTERVAL '30 days';
  
  -- Удаляем необработанные события старше 7 дней (вероятно, ошибки)
  DELETE FROM webhook_events 
  WHERE processed_at IS NULL 
    AND created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Комментарий к функции
COMMENT ON FUNCTION cleanup_old_webhook_events() IS 'Очистка старых webhook событий для экономии места';

-- =====================================================

-- 6. Полезные представления для мониторинга

-- Статистика webhook событий за последние 24 часа
CREATE OR REPLACE VIEW webhook_stats_24h AS
SELECT 
  event_type,
  COUNT(*) as total_events,
  COUNT(processed_at) as processed_events,
  COUNT(*) - COUNT(processed_at) as pending_events,
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_processing_time_seconds
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type;

-- Статистика уведомлений за последние 24 часа
CREATE OR REPLACE VIEW notification_stats_24h AS
SELECT 
  notification_type,
  COUNT(*) as total_sent,
  COUNT(delivered_at) as delivered,
  COUNT(read_at) as read,
  COUNT(error) as failed
FROM booking_notifications
WHERE sent_at > NOW() - INTERVAL '24 hours'
GROUP BY notification_type;

-- =====================================================

-- Проверка что все создано успешно
DO $$ 
BEGIN 
  RAISE NOTICE 'Все таблицы и индексы для webhook уведомлений созданы успешно!';
  RAISE NOTICE '';
  RAISE NOTICE 'Созданные объекты:';
  RAISE NOTICE '- webhook_events (таблица событий)';
  RAISE NOTICE '- booking_notifications (история уведомлений)';
  RAISE NOTICE '- Дополнительные поля в appointments_cache';
  RAISE NOTICE '- cleanup_old_webhook_events() (функция очистки)';
  RAISE NOTICE '- webhook_stats_24h (представление статистики)';
  RAISE NOTICE '- notification_stats_24h (представление статистики)';
END $$;