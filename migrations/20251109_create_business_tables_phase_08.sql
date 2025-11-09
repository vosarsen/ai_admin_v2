-- =============================================================================
-- Migration: Phase 0.8 - Create Business Data Tables for Timeweb PostgreSQL
-- Date: 2025-11-09
-- Purpose: Create all core business tables to support YClients data migration
--
-- Tables Created (in dependency order):
-- 1. companies (base entity)
-- 2. clients (depends on companies)
-- 3. services (depends on companies)
-- 4. staff (depends on companies)
-- 5. staff_schedules (depends on staff)
-- 6. bookings (depends on clients, services, staff)
-- 7. appointments_cache (depends on companies)
-- 8. dialog_contexts (standalone)
-- 9. reminders (depends on bookings)
-- 10. sync_status (standalone)
-- =============================================================================

-- =============================================================================
-- 1. COMPANIES - Base entity for multi-tenant architecture
-- =============================================================================

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  yclients_company_id INTEGER UNIQUE NOT NULL,

  -- Contact info
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),

  -- Marketplace integration
  marketplace_app_id VARCHAR(255),
  marketplace_connected_at TIMESTAMPTZ,
  marketplace_permissions JSONB,

  -- Settings
  settings JSONB DEFAULT '{}',
  timezone VARCHAR(50) DEFAULT 'Europe/Moscow',
  locale VARCHAR(10) DEFAULT 'ru-RU',

  -- Status
  is_active BOOLEAN DEFAULT true,
  subscription_status VARCHAR(50) DEFAULT 'active',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_companies_yclients_id
  ON companies(yclients_company_id);

CREATE INDEX IF NOT EXISTS idx_companies_active
  ON companies(is_active) WHERE is_active = true;

-- Comments
COMMENT ON TABLE companies IS 'Companies (salons) using the AI Admin system';
COMMENT ON COLUMN companies.yclients_company_id IS 'YClients company ID (for API integration)';
COMMENT ON COLUMN companies.marketplace_app_id IS 'YClients Marketplace App ID (if installed)';

-- =============================================================================
-- 2. CLIENTS - Customer records
-- =============================================================================

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- YClients mapping
  yclients_client_id INTEGER,

  -- Contact info
  phone VARCHAR(20) NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),

  -- Demographics
  sex VARCHAR(10),
  birth_date DATE,

  -- Preferences
  discount DECIMAL(5,2) DEFAULT 0,
  loyalty_card VARCHAR(50),

  -- Visits tracking
  visits_count INTEGER DEFAULT 0,
  last_visit_date DATE,
  first_visit_date DATE,

  -- Tags and notes
  tags TEXT[],
  comment TEXT,
  importance INTEGER DEFAULT 0,

  -- Status
  is_deleted BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(company_id, phone)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clients_company_id
  ON clients(company_id);

CREATE INDEX IF NOT EXISTS idx_clients_phone
  ON clients(phone);

CREATE INDEX IF NOT EXISTS idx_clients_company_phone
  ON clients(company_id, phone);

CREATE INDEX IF NOT EXISTS idx_clients_yclients_id
  ON clients(yclients_client_id);

CREATE INDEX IF NOT EXISTS idx_clients_last_visit
  ON clients(last_visit_date DESC) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_clients_visits_count
  ON clients(visits_count DESC) WHERE is_deleted = false;

-- Comments
COMMENT ON TABLE clients IS 'Customer records for all companies';
COMMENT ON COLUMN clients.yclients_client_id IS 'YClients client ID (null for WhatsApp-only clients)';
COMMENT ON COLUMN clients.phone IS 'Normalized phone number (e.g., 79001234567)';

-- =============================================================================
-- 3. SERVICES - Service catalog
-- =============================================================================

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- YClients mapping
  yclients_service_id INTEGER,

  -- Service details
  title VARCHAR(255) NOT NULL,
  category_id INTEGER,
  category_name VARCHAR(255),

  -- Pricing
  price_min DECIMAL(10,2),
  price_max DECIMAL(10,2),

  -- Duration
  duration INTEGER NOT NULL, -- minutes

  -- Display
  comment TEXT,
  weight INTEGER DEFAULT 0, -- sorting order

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(company_id, yclients_service_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_services_company_id
  ON services(company_id);

CREATE INDEX IF NOT EXISTS idx_services_active
  ON services(company_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_services_category
  ON services(category_id) WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_services_yclients_id
  ON services(yclients_service_id);

-- Comments
COMMENT ON TABLE services IS 'Service catalog for all companies';
COMMENT ON COLUMN services.duration IS 'Service duration in minutes';
COMMENT ON COLUMN services.weight IS 'Display order (higher = shown first)';

-- =============================================================================
-- 4. STAFF - Staff members (masters, specialists)
-- =============================================================================

CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- YClients mapping
  yclients_staff_id INTEGER,

  -- Personal info
  name VARCHAR(255) NOT NULL,
  specialization VARCHAR(255),
  avatar_url TEXT,

  -- Contact
  phone VARCHAR(20),
  email VARCHAR(255),

  -- Rating
  rating DECIMAL(3,2),
  comments_count INTEGER DEFAULT 0,

  -- Display
  weight INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_hidden BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(company_id, yclients_staff_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_staff_company_id
  ON staff(company_id);

CREATE INDEX IF NOT EXISTS idx_staff_active
  ON staff(company_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_staff_yclients_id
  ON staff(yclients_staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_rating
  ON staff(rating DESC NULLS LAST) WHERE is_active = true;

-- Comments
COMMENT ON TABLE staff IS 'Staff members (masters, specialists) for all companies';
COMMENT ON COLUMN staff.weight IS 'Display order (higher = shown first)';

-- =============================================================================
-- 5. STAFF_SCHEDULES - Staff availability schedules
-- =============================================================================

CREATE TABLE IF NOT EXISTS staff_schedules (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  -- YClients mapping
  yclients_schedule_id INTEGER,

  -- Schedule date
  date DATE NOT NULL,

  -- Working hours
  start_time TIME,
  end_time TIME,

  -- Status
  is_working BOOLEAN DEFAULT true,
  is_day_off BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(staff_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_schedules_staff_id
  ON staff_schedules(staff_id);

CREATE INDEX IF NOT EXISTS idx_schedules_staff_date
  ON staff_schedules(staff_id, date);

CREATE INDEX IF NOT EXISTS idx_schedules_company_date
  ON staff_schedules(company_id, date);

CREATE INDEX IF NOT EXISTS idx_schedules_date
  ON staff_schedules(date) WHERE is_working = true;

-- Comments
COMMENT ON TABLE staff_schedules IS 'Staff availability schedules (daily)';
COMMENT ON COLUMN staff_schedules.is_day_off IS 'True if this is a day off (overrides working hours)';

-- =============================================================================
-- 6. BOOKINGS - Appointment bookings
-- =============================================================================

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- YClients mapping
  yclients_booking_id INTEGER,

  -- Relationships
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,

  -- Booking details
  datetime TIMESTAMPTZ NOT NULL,
  duration INTEGER NOT NULL, -- minutes

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, confirmed, completed, cancelled

  -- Pricing
  cost DECIMAL(10,2),
  paid DECIMAL(10,2) DEFAULT 0,

  -- Notes
  comment TEXT,
  client_comment TEXT,

  -- Source
  source VARCHAR(50) DEFAULT 'whatsapp', -- whatsapp, yclients, api

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ,

  -- Constraints
  CHECK (datetime > '2020-01-01'),
  CHECK (duration > 0),
  CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  UNIQUE(company_id, yclients_booking_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_company_id
  ON bookings(company_id);

CREATE INDEX IF NOT EXISTS idx_bookings_client_id
  ON bookings(client_id);

CREATE INDEX IF NOT EXISTS idx_bookings_staff_id
  ON bookings(staff_id);

CREATE INDEX IF NOT EXISTS idx_bookings_service_id
  ON bookings(service_id);

CREATE INDEX IF NOT EXISTS idx_bookings_datetime
  ON bookings(datetime);

CREATE INDEX IF NOT EXISTS idx_bookings_company_datetime
  ON bookings(company_id, datetime DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_status
  ON bookings(status) WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_bookings_yclients_id
  ON bookings(yclients_booking_id);

-- Comments
COMMENT ON TABLE bookings IS 'Appointment bookings for all companies';
COMMENT ON COLUMN bookings.source IS 'Booking source: whatsapp, yclients, api';
COMMENT ON COLUMN bookings.duration IS 'Appointment duration in minutes';

-- =============================================================================
-- 7. APPOINTMENTS_CACHE - Cached YClients appointments data
-- =============================================================================

CREATE TABLE IF NOT EXISTS appointments_cache (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Cache key
  cache_key VARCHAR(255) NOT NULL,

  -- Cached data
  appointments JSONB NOT NULL,

  -- Metadata
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Constraints
  UNIQUE(company_id, cache_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_appointments_cache_company
  ON appointments_cache(company_id);

CREATE INDEX IF NOT EXISTS idx_appointments_cache_expires
  ON appointments_cache(expires_at);

-- Comments
COMMENT ON TABLE appointments_cache IS 'Cached YClients appointments data (TTL-based)';
COMMENT ON COLUMN appointments_cache.cache_key IS 'Cache key format: YYYY-MM-DD or staff_id_YYYY-MM-DD';

-- =============================================================================
-- 8. DIALOG_CONTEXTS - WhatsApp conversation contexts
-- =============================================================================

CREATE TABLE IF NOT EXISTS dialog_contexts (
  id SERIAL PRIMARY KEY,

  -- User identification
  phone VARCHAR(20) NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Context data
  context JSONB NOT NULL DEFAULT '{}',

  -- State
  current_step VARCHAR(50),
  booking_data JSONB,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(phone, company_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dialog_contexts_phone
  ON dialog_contexts(phone);

CREATE INDEX IF NOT EXISTS idx_dialog_contexts_company
  ON dialog_contexts(company_id);

CREATE INDEX IF NOT EXISTS idx_dialog_contexts_expires
  ON dialog_contexts(expires_at) WHERE expires_at IS NOT NULL;

-- Comments
COMMENT ON TABLE dialog_contexts IS 'WhatsApp conversation contexts with TTL';
COMMENT ON COLUMN dialog_contexts.current_step IS 'Current booking flow step';
COMMENT ON COLUMN dialog_contexts.booking_data IS 'In-progress booking data';

-- =============================================================================
-- 9. REMINDERS - Appointment reminders
-- =============================================================================

CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

  -- Reminder details
  remind_at TIMESTAMPTZ NOT NULL,
  type VARCHAR(50) NOT NULL, -- sms, whatsapp, email

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed
  sent_at TIMESTAMPTZ,
  error TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CHECK (type IN ('sms', 'whatsapp', 'email')),
  CHECK (status IN ('pending', 'sent', 'failed'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reminders_booking_id
  ON reminders(booking_id);

CREATE INDEX IF NOT EXISTS idx_reminders_company_id
  ON reminders(company_id);

CREATE INDEX IF NOT EXISTS idx_reminders_remind_at
  ON reminders(remind_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_reminders_status
  ON reminders(status) WHERE status = 'pending';

-- Comments
COMMENT ON TABLE reminders IS 'Appointment reminders (SMS, WhatsApp, Email)';

-- =============================================================================
-- 10. SYNC_STATUS - YClients sync tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS sync_status (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Sync details
  entity_type VARCHAR(50) NOT NULL, -- clients, services, staff, schedules, bookings

  -- Status
  last_sync_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,

  -- Statistics
  records_synced INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(company_id, entity_type),
  CHECK (entity_type IN ('clients', 'services', 'staff', 'schedules', 'bookings', 'all'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sync_status_company
  ON sync_status(company_id);

CREATE INDEX IF NOT EXISTS idx_sync_status_entity
  ON sync_status(entity_type);

-- Comments
COMMENT ON TABLE sync_status IS 'YClients data synchronization status tracking';

-- =============================================================================
-- AUTO-UPDATE TRIGGERS - Update updated_at on all tables
-- =============================================================================

-- Generic function for updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'updated_at'
      AND table_name IN (
        'companies', 'clients', 'services', 'staff', 'staff_schedules',
        'bookings', 'dialog_contexts', 'reminders', 'sync_status'
      )
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trigger_update_%I_updated_at ON %I;
      CREATE TRIGGER trigger_update_%I_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', t, t, t, t);
  END LOOP;
END $$;

-- =============================================================================
-- CLEANUP FUNCTIONS
-- =============================================================================

-- Cleanup expired dialog contexts
CREATE OR REPLACE FUNCTION cleanup_expired_dialog_contexts()
RETURNS TABLE(deleted_count BIGINT) AS $$
DECLARE
  result_count BIGINT;
BEGIN
  WITH deleted AS (
    DELETE FROM dialog_contexts
    WHERE expires_at IS NOT NULL
      AND expires_at < NOW()
    RETURNING *
  )
  SELECT COUNT(*) INTO result_count FROM deleted;

  RETURN QUERY SELECT result_count;
  RAISE NOTICE 'Cleaned up % expired dialog contexts', result_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired appointments cache
CREATE OR REPLACE FUNCTION cleanup_expired_appointments_cache()
RETURNS TABLE(deleted_count BIGINT) AS $$
DECLARE
  result_count BIGINT;
BEGIN
  WITH deleted AS (
    DELETE FROM appointments_cache
    WHERE expires_at < NOW()
    RETURNING *
  )
  SELECT COUNT(*) INTO result_count FROM deleted;

  RETURN QUERY SELECT result_count;
  RAISE NOTICE 'Cleaned up % expired appointments cache entries', result_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STATISTICS FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS TABLE(
  table_name TEXT,
  row_count BIGINT,
  table_size TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tablename::TEXT,
    t.n_tup_ins - t.n_tup_del AS row_count,
    pg_size_pretty(pg_total_relation_size(quote_ident(t.tablename)::regclass)) AS table_size
  FROM pg_stat_user_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename NOT LIKE 'whatsapp_%'
  ORDER BY (t.n_tup_ins - t.n_tup_del) DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  tables_to_check TEXT[] := ARRAY[
    'companies', 'clients', 'services', 'staff', 'staff_schedules',
    'bookings', 'appointments_cache', 'dialog_contexts', 'reminders', 'sync_status'
  ];
  table_name TEXT;
  table_count INTEGER := 0;
BEGIN
  FOREACH table_name IN ARRAY tables_to_check
  LOOP
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = table_name) THEN
      RAISE NOTICE '✅ Table % created successfully', table_name;
      table_count := table_count + 1;
    ELSE
      RAISE WARNING '❌ Table % NOT created', table_name;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Phase 0.8 Migration Complete!';
  RAISE NOTICE '✅ %/% tables created successfully', table_count, array_length(tables_to_check, 1);
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Create partitioned messages table (Phase 0.8.3)';
  RAISE NOTICE '2. Verify all indexes created';
  RAISE NOTICE '3. Test with sample data';
END $$;
