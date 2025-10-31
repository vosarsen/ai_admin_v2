-- Отключить RLS для таблицы services временно для синхронизации
ALTER TABLE services DISABLE ROW LEVEL SECURITY;

-- Или создать политику, разрешающую все операции (менее безопасно)
-- CREATE POLICY "Enable all operations for services" ON services
-- FOR ALL USING (true) WITH CHECK (true);