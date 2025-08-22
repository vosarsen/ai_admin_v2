-- Добавление колонки для хранения склонений в таблицу services
-- Выполнить в Supabase SQL Editor

-- Добавляем колонку declensions типа jsonb для хранения склонений
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS declensions jsonb;

-- Добавляем комментарий к колонке
COMMENT ON COLUMN services.declensions IS 'Склонения названия услуги для правильного использования в сообщениях. Содержит: nominative, genitive, dative, accusative, instrumental, prepositional, prepositional_na';

-- Создаем индекс для быстрого поиска услуг со склонениями
CREATE INDEX IF NOT EXISTS idx_services_declensions 
ON services(company_id, yclients_id) 
WHERE declensions IS NOT NULL;

-- Пример структуры данных в declensions:
-- {
--   "original": "Мужская стрижка",
--   "nominative": "мужская стрижка",
--   "genitive": "мужской стрижки",
--   "dative": "мужской стрижке",
--   "accusative": "мужскую стрижку",
--   "instrumental": "мужской стрижкой",
--   "prepositional": "о мужской стрижке",
--   "prepositional_na": "мужской стрижке"
-- }