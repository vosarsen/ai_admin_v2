-- Простая версия создания таблицы visits без триггеров
-- Для выполнения в Supabase Dashboard

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
  services JSONB DEFAULT '[]',
  service_names TEXT[] DEFAULT '{}',
  service_ids INTEGER[] DEFAULT '{}',
  services_cost DECIMAL(10,2) DEFAULT 0,
  
  -- Время и дата визита
  visit_date DATE NOT NULL,
  visit_time TIME,
  datetime TIMESTAMP NOT NULL,
  duration INTEGER DEFAULT 0,
  
  -- Финансовая информация
  total_cost DECIMAL(10,2) DEFAULT 0,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tips_amount DECIMAL(10,2) DEFAULT 0,
  payment_status VARCHAR(20),
  payment_method VARCHAR(50),
  
  -- Статус визита
  attendance INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'completed',
  is_online BOOLEAN DEFAULT false,
  
  -- Дополнительная информация
  comment TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  source VARCHAR(50),
  
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