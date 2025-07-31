-- Добавляем поле created_by_bot в таблицу appointments_cache
-- Это поле нужно, чтобы не отправлять уведомления для записей, созданных через бота

ALTER TABLE appointments_cache 
ADD COLUMN IF NOT EXISTS created_by_bot BOOLEAN DEFAULT false;

-- Комментарий к полю
COMMENT ON COLUMN appointments_cache.created_by_bot IS 'Флаг, указывающий что запись создана через AI Admin бота';

-- Индекс для быстрого поиска записей, созданных ботом
CREATE INDEX IF NOT EXISTS idx_appointments_cache_created_by_bot 
ON appointments_cache(yclients_record_id, created_by_bot) 
WHERE created_by_bot = true;

-- Добавляем поле для хранения телефона клиента
ALTER TABLE appointments_cache 
ADD COLUMN IF NOT EXISTS client_phone VARCHAR(20);

-- Комментарий к полю
COMMENT ON COLUMN appointments_cache.client_phone IS 'Телефон клиента для отправки уведомлений';

-- Индекс для быстрого поиска по телефону
CREATE INDEX IF NOT EXISTS idx_appointments_cache_client_phone 
ON appointments_cache(client_phone);

-- Обновляем существующие записи, если нужно
-- Предполагаем, что записи с comment содержащим определенный текст созданы ботом
UPDATE appointments_cache 
SET created_by_bot = true 
WHERE comment LIKE '%AI Admin%' 
   OR comment LIKE '%WhatsApp бот%'
   OR comment LIKE '%Создано через бота%';