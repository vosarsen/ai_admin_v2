-- =====================================================
-- Создание таблицы для истории визитов (visits)
-- =====================================================
-- Хранит историю всех визитов клиентов из YClients

-- Создаем таблицу для хранения истории визитов
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- YClients идентификаторы
  yclients_visit_id INTEGER,
  yclients_record_id INTEGER,
  company_id INTEGER NOT NULL,
  
  -- Связь с клиентом
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  client_phone VARCHAR(20) NOT NULL,
  client_name VARCHAR(255),
  client_yclients_id INTEGER,
  
  -- Информация о мастере
  staff_id INTEGER,
  staff_name VARCHAR(255),
  staff_yclients_id INTEGER,
  
  -- Информация об услугах
  services JSONB DEFAULT '[]', -- [{id, name, cost, duration}]
  service_names TEXT[] DEFAULT '{}',
  service_ids INTEGER[] DEFAULT '{}',
  services_cost DECIMAL(10,2) DEFAULT 0,
  
  -- Время и дата визита
  visit_date DATE NOT NULL,
  visit_time TIME,
  datetime TIMESTAMP NOT NULL,
  duration INTEGER DEFAULT 0, -- в минутах
  
  -- Финансовая информация
  total_cost DECIMAL(10,2) DEFAULT 0,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tips_amount DECIMAL(10,2) DEFAULT 0,
  payment_status VARCHAR(20), -- not_paid, paid_not_full, paid_full, paid_over
  payment_method VARCHAR(50), -- cash, card, online, mixed
  
  -- Статус визита
  attendance INTEGER DEFAULT 1, -- -1 = не пришел, 0 = ожидается, 1 = пришел, 2 = подтвердил
  status VARCHAR(20) DEFAULT 'completed', -- completed, cancelled, no_show
  is_online BOOLEAN DEFAULT false,
  
  -- Дополнительная информация
  comment TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  source VARCHAR(50), -- online, phone, walk-in, app
  
  -- Абонементы и программы лояльности
  used_abonement BOOLEAN DEFAULT false,
  abonement_id INTEGER,
  loyalty_transactions JSONB DEFAULT '[]',
  
  -- Метаданные
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  synced_at TIMESTAMP DEFAULT NOW(),
  
  -- Уникальность для предотвращения дублей
  UNIQUE(company_id, yclients_record_id)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_visits_company_id ON visits(company_id);
CREATE INDEX IF NOT EXISTS idx_visits_client_id ON visits(client_id);
CREATE INDEX IF NOT EXISTS idx_visits_client_phone ON visits(client_phone);
CREATE INDEX IF NOT EXISTS idx_visits_client_yclients_id ON visits(client_yclients_id) WHERE client_yclients_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visits_staff_id ON visits(staff_id) WHERE staff_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_datetime ON visits(datetime);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_payment_status ON visits(payment_status);

-- Составные индексы для аналитики
CREATE INDEX IF NOT EXISTS idx_visits_client_date ON visits(client_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_staff_date ON visits(staff_id, visit_date DESC) WHERE staff_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visits_service_ids ON visits USING GIN(service_ids);

-- Индекс для поиска последних визитов клиента
CREATE INDEX IF NOT EXISTS idx_visits_recent_client ON visits(company_id, client_phone, visit_date DESC)
WHERE status = 'completed';

-- Комментарии к таблице
COMMENT ON TABLE visits IS 'История визитов клиентов из YClients';
COMMENT ON COLUMN visits.yclients_visit_id IS 'ID визита в системе YClients';
COMMENT ON COLUMN visits.yclients_record_id IS 'ID записи в системе YClients';
COMMENT ON COLUMN visits.services IS 'JSON массив с детальной информацией об услугах';
COMMENT ON COLUMN visits.attendance IS 'Статус посещения: -1 = не пришел, 0 = ожидается, 1 = пришел, 2 = подтвердил';
COMMENT ON COLUMN visits.payment_status IS 'Статус оплаты: not_paid, paid_not_full, paid_full, paid_over';

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_visits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_visits_updated_at BEFORE UPDATE
    ON visits FOR EACH ROW EXECUTE FUNCTION update_visits_updated_at();

-- Функция для обновления статистики клиента после добавления визита
CREATE OR REPLACE FUNCTION update_client_stats_from_visits()
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем статистику клиента
    UPDATE clients SET
        visit_count = (
            SELECT COUNT(*) FROM visits 
            WHERE client_id = NEW.client_id AND status = 'completed'
        ),
        total_spent = (
            SELECT COALESCE(SUM(paid_amount), 0) FROM visits 
            WHERE client_id = NEW.client_id AND status = 'completed'
        ),
        last_visit_date = (
            SELECT MAX(visit_date) FROM visits 
            WHERE client_id = NEW.client_id AND status = 'completed'
        ),
        first_visit_date = (
            SELECT MIN(visit_date) FROM visits 
            WHERE client_id = NEW.client_id AND status = 'completed'
        ),
        last_service_ids = (
            SELECT ARRAY_AGG(DISTINCT service_id) 
            FROM (
                SELECT UNNEST(service_ids) as service_id 
                FROM visits 
                WHERE client_id = NEW.client_id AND status = 'completed'
                ORDER BY visit_date DESC 
                LIMIT 1
            ) t
        ),
        favorite_staff_ids = (
            SELECT ARRAY_AGG(staff_id ORDER BY visit_count DESC)
            FROM (
                SELECT staff_id, COUNT(*) as visit_count
                FROM visits
                WHERE client_id = NEW.client_id 
                    AND status = 'completed' 
                    AND staff_id IS NOT NULL
                GROUP BY staff_id
                ORDER BY visit_count DESC
                LIMIT 3
            ) t
        ),
        average_bill = (
            SELECT AVG(paid_amount)::INTEGER 
            FROM visits 
            WHERE client_id = NEW.client_id AND status = 'completed'
        )
    WHERE id = NEW.client_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для автообновления статистики клиента
CREATE TRIGGER update_client_stats_after_visit
AFTER INSERT OR UPDATE ON visits
FOR EACH ROW EXECUTE FUNCTION update_client_stats_from_visits();

-- Проверяем что таблица создана
SELECT 
  'visits' as table_name,
  COUNT(*) as row_count,
  pg_size_pretty(pg_total_relation_size('visits'::regclass)) as table_size;