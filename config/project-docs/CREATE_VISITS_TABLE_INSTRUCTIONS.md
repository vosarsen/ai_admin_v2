# 📋 ИНСТРУКЦИЯ: Создание таблицы visits в Supabase

## ⚡ ВАЖНО: Таблица visits необходима для хранения истории визитов клиентов!

Без этой таблицы невозможно:
- Персонализировать общение на основе истории
- Рекомендовать услуги
- Анализировать предпочтения клиентов
- Определять любимых мастеров

## 🚀 Шаги для создания таблицы:

### 1. Откройте Supabase SQL Editor:
   👉 https://supabase.com/dashboard/project/wyfbwjqnkkjeldhnmnpb/sql/new

### 2. Скопируйте SQL код:
   Откройте файл: `scripts/database/create-visits-table-simple.sql`
   ИЛИ используйте код ниже:

```sql
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
```

### 3. Вставьте код в SQL Editor и нажмите "Run"

### 4. Создайте индексы (опционально, но рекомендуется):

```sql
-- Индексы для быстрого поиска
CREATE INDEX idx_visits_company_id ON visits(company_id);
CREATE INDEX idx_visits_client_id ON visits(client_id);
CREATE INDEX idx_visits_client_phone ON visits(client_phone);
CREATE INDEX idx_visits_visit_date ON visits(visit_date);
CREATE INDEX idx_visits_datetime ON visits(datetime);
CREATE INDEX idx_visits_status ON visits(status);

-- Составной индекс для поиска последних визитов клиента
CREATE INDEX idx_visits_recent_client ON visits(company_id, client_phone, visit_date DESC)
WHERE status = 'completed';
```

### 5. Проверьте создание таблицы:
   Запустите: `node test-visits-sync.js`

## 📊 После создания таблицы:

### Тестовая синхронизация (3 клиента):
```bash
node scripts/sync-visits.js --limit 3
```

### Синхронизация VIP клиентов:
```bash
node scripts/sync-visits.js --vip
```

### Полная синхронизация:
```bash
node scripts/sync-visits.js
```

## ⚠️ Важные моменты:

1. **Таблица visits критически важна** для персонализации общения
2. **Без истории визитов** бот не может:
   - Узнавать постоянных клиентов
   - Рекомендовать услуги на основе предыдущих
   - Определять любимых мастеров
   - Предлагать удобное время

3. **После создания таблицы** нужно синхронизировать историю
4. **Синхронизация займет время** (примерно 1-2 минуты на 100 клиентов)

## 🔥 Это СУПЕР ВАЖНО и БЕЗУМНО НЕОБХОДИМО!

История визитов - это основа для умного и персонализированного общения с клиентами!