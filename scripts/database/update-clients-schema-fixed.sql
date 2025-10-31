-- Добавляем новые колонки в таблицу clients для разделения трат
-- Исправленная версия для Supabase

-- 1. Добавляем колонку для суммы услуг
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS services_amount DECIMAL(10, 2) DEFAULT 0;

-- 2. Добавляем колонку для суммы товаров
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS goods_amount DECIMAL(10, 2) DEFAULT 0;

-- 3. Добавляем колонку для истории покупок товаров (исправленный синтаксис)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS goods_purchases JSONB DEFAULT '[]';

-- 4. Добавляем колонку для количества покупок товаров
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS goods_count INTEGER DEFAULT 0;

-- 5. Добавляем комментарии к колонкам
COMMENT ON COLUMN clients.services_amount IS 'Общая сумма потраченная на услуги';
COMMENT ON COLUMN clients.goods_amount IS 'Общая сумма потраченная на товары';
COMMENT ON COLUMN clients.goods_purchases IS 'История покупок товаров [{date, amount, document_id, comment}]';
COMMENT ON COLUMN clients.goods_count IS 'Количество покупок товаров';

-- 6. Создаем индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_clients_goods_amount 
ON clients(company_id, goods_amount) 
WHERE goods_amount > 0;

CREATE INDEX IF NOT EXISTS idx_clients_goods_ratio 
ON clients(company_id, (goods_amount / NULLIF(total_spent, 0))) 
WHERE total_spent > 0;

-- 7. Проверяем результат
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name IN ('total_spent', 'services_amount', 'goods_amount', 'goods_purchases', 'goods_count')
ORDER BY column_name;