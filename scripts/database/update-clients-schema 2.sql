-- Добавляем новые колонки в таблицу clients для разделения трат
-- Эти колонки позволят точно отслеживать траты на услуги и товары

-- 1. Добавляем колонку для суммы услуг (если еще нет)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS services_amount DECIMAL(10, 2) DEFAULT 0
COMMENT 'Общая сумма потраченная на услуги';

-- 2. Добавляем колонку для суммы товаров (если еще нет)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS goods_amount DECIMAL(10, 2) DEFAULT 0
COMMENT 'Общая сумма потраченная на товары';

-- 3. Добавляем колонку для истории покупок товаров
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS goods_purchases JSONB DEFAULT '[]'::jsonb
COMMENT 'История покупок товаров [{date, amount, document_id, comment}]';

-- 4. Добавляем колонку для количества покупок товаров
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS goods_count INTEGER DEFAULT 0
COMMENT 'Количество покупок товаров';

-- 5. Добавляем индекс для быстрого поиска клиентов с покупками товаров
CREATE INDEX IF NOT EXISTS idx_clients_goods_amount 
ON clients(company_id, goods_amount) 
WHERE goods_amount > 0;

-- 6. Добавляем индекс для поиска по соотношению товары/услуги
CREATE INDEX IF NOT EXISTS idx_clients_goods_ratio 
ON clients(company_id, (goods_amount / NULLIF(total_spent, 0))) 
WHERE total_spent > 0;

-- Проверяем результат
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'clients' 
    AND column_name IN ('total_spent', 'services_amount', 'goods_amount', 'goods_purchases', 'goods_count')
ORDER BY column_name;