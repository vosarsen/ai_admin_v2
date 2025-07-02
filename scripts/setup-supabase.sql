-- Disable RLS for sync tables
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE health_check_results DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON services TO authenticated, anon;
GRANT ALL ON staff TO authenticated, anon;
GRANT ALL ON clients TO authenticated, anon;
GRANT ALL ON staff_schedules TO authenticated, anon;
GRANT ALL ON appointments_cache TO authenticated, anon;
GRANT ALL ON sync_logs TO authenticated, anon;
GRANT ALL ON health_check_results TO authenticated, anon;
