-- =====================================================
-- Создание таблицы для активных записей (bookings)
-- =====================================================

-- Удаляем таблицу если существует (для разработки)
-- DROP TABLE IF EXISTS bookings CASCADE;

-- Создаем таблицу для хранения активных записей
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- YClients идентификаторы
  yclients_record_id INTEGER UNIQUE NOT NULL,
  company_id INTEGER NOT NULL,
  
  -- Информация о клиенте
  client_phone VARCHAR(20) NOT NULL,
  client_name VARCHAR(255),
  client_yclients_id INTEGER,
  
  -- Информация о мастере
  staff_id INTEGER,
  staff_name VARCHAR(255),
  
  -- Информация об услугах
  services TEXT[] DEFAULT '{}',
  service_ids INTEGER[] DEFAULT '{}',
  
  -- Время и дата
  datetime TIMESTAMP NOT NULL,
  date DATE NOT NULL,
  duration INTEGER DEFAULT 0, -- в минутах
  
  -- Финансы
  cost DECIMAL(10,2) DEFAULT 0,
  prepaid DECIMAL(10,2) DEFAULT 0,
  
  -- Статус записи
  status VARCHAR(20) DEFAULT 'active', -- active, confirmed, cancelled, completed, no_show, past
  visit_attendance INTEGER DEFAULT 0, -- -1 = не пришел, 0 = ожидается, 1 = пришел, 2 = подтвердил
  
  -- Дополнительная информация
  comment TEXT,
  online BOOLEAN DEFAULT false,
  record_hash VARCHAR(255), -- для отмены через user API
  
  -- Метаданные
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  synced_at TIMESTAMP,
  created_by_bot BOOLEAN DEFAULT false -- создана через бота
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_bookings_company_id ON bookings(company_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client_phone ON bookings(client_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_client_yclients_id ON bookings(client_yclients_id) WHERE client_yclients_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_staff_id ON bookings(staff_id) WHERE staff_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_datetime ON bookings(datetime);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_yclients_record_id ON bookings(yclients_record_id);

-- Составной индекс для поиска активных записей клиента
CREATE INDEX IF NOT EXISTS idx_bookings_active_client ON bookings(company_id, client_phone, status) 
WHERE status IN ('active', 'confirmed');

-- Индекс для поиска записей по дате и статусу
CREATE INDEX IF NOT EXISTS idx_bookings_date_status ON bookings(date, status)
WHERE status IN ('active', 'confirmed');

-- Комментарии к таблице
COMMENT ON TABLE bookings IS 'Активные записи клиентов из YClients';
COMMENT ON COLUMN bookings.yclients_record_id IS 'ID записи в системе YClients';
COMMENT ON COLUMN bookings.status IS 'Статус записи: active (активная), confirmed (подтверждена), cancelled (отменена), completed (завершена), no_show (не явился), past (прошедшая)';
COMMENT ON COLUMN bookings.visit_attendance IS 'Статус посещения: -1 = не пришел, 0 = ожидается, 1 = пришел, 2 = подтвердил';
COMMENT ON COLUMN bookings.record_hash IS 'Хеш для отмены записи через user API YClients';
COMMENT ON COLUMN bookings.created_by_bot IS 'Флаг что запись создана через WhatsApp бота';

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE
    ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Политики безопасности (если используется Row Level Security)
-- ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Проверяем что таблица создана
SELECT 
  'bookings' as table_name,
  COUNT(*) as row_count,
  pg_size_pretty(pg_total_relation_size('bookings')) as table_size
FROM bookings;