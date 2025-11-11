-- Supabase Schema Recreation for Timeweb PostgreSQL
-- Date: 2025-11-11
-- Purpose: Recreate Supabase (legacy) schema in Timeweb for Phase 4 migration
-- Based on: PHASE_4_BLOCKER.md and SCHEMA_COMPARISON.md analysis

-- Note: This schema is optimized for AI WhatsApp bot functionality
-- Includes: AI context, Russian declensions, client analytics, denormalized data

-- ============================================================================
-- COMPANIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    yclients_id INTEGER,
    title VARCHAR(255),
    address VARCHAR(500),
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    timezone VARCHAR(100),
    working_hours VARCHAR(255),
    coordinate_lat NUMERIC(10, 7),
    coordinate_lon NUMERIC(10, 7),
    currency VARCHAR(10),
    ai_enabled BOOLEAN DEFAULT false,
    sync_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_sync_at TIMESTAMP,
    raw_data JSONB,
    whatsapp_enabled BOOLEAN DEFAULT false,
    whatsapp_config JSONB,
    whatsapp_connected BOOLEAN DEFAULT false,
    whatsapp_phone VARCHAR(50),
    whatsapp_connected_at TIMESTAMP,
    integration_status VARCHAR(100),
    connected_at TIMESTAMP,
    marketplace_user_id VARCHAR(255),
    marketplace_user_name VARCHAR(255),
    marketplace_user_phone VARCHAR(50),
    marketplace_user_email VARCHAR(255),
    whatsapp_session_data JSONB,
    api_key VARCHAR(255),
    webhook_secret VARCHAR(255),
    last_payment_date TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_companies_company_id ON companies(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_yclients_id ON companies(yclients_id);

-- ============================================================================
-- CLIENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    yclients_id INTEGER NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    raw_phone VARCHAR(50),
    email VARCHAR(255),
    discount NUMERIC(5, 2),
    company_id INTEGER,
    branch_ids INTEGER[],
    tags TEXT[],
    status VARCHAR(50),
    source VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    visit_count INTEGER DEFAULT 0,
    total_spent NUMERIC(12, 2),
    first_visit_date DATE,
    last_visit_date DATE,
    last_services TEXT[],
    visit_history JSONB,
    preferences JSONB,
    last_sync_at TIMESTAMP,
    loyalty_level VARCHAR(50),
    client_segment VARCHAR(50),
    average_bill NUMERIC(12, 2),
    last_service_ids INTEGER[],
    favorite_staff_ids INTEGER[],
    preferred_time_slots VARCHAR(50)[],
    blacklisted BOOLEAN DEFAULT false,
    notes TEXT,
    created_by_ai BOOLEAN DEFAULT false,
    last_ai_interaction TIMESTAMP,
    ai_context JSONB,
    ai_messages_count INTEGER DEFAULT 0,
    ai_satisfaction_score NUMERIC(3, 2),
    services_amount NUMERIC(12, 2),
    goods_amount NUMERIC(12, 2),
    goods_purchases JSONB,
    goods_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_yclients_id ON clients(yclients_id);
CREATE INDEX IF NOT EXISTS idx_clients_company_id ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_last_visit_date ON clients(last_visit_date);

-- ============================================================================
-- SERVICES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    yclients_id INTEGER NOT NULL,
    company_id INTEGER,
    title VARCHAR(500) NOT NULL,
    category_id INTEGER,
    category_title VARCHAR(255),
    price_min NUMERIC(12, 2),
    price_max NUMERIC(12, 2),
    discount NUMERIC(5, 2),
    duration INTEGER,
    seance_length INTEGER,
    is_active BOOLEAN DEFAULT true,
    is_bookable BOOLEAN DEFAULT true,
    description TEXT,
    weight INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_sync_at TIMESTAMP,
    raw_data JSONB,
    image_url VARCHAR(500),
    declensions JSONB
);

CREATE INDEX IF NOT EXISTS idx_services_yclients_id ON services(yclients_id);
CREATE INDEX IF NOT EXISTS idx_services_company_id ON services(company_id);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active);

-- ============================================================================
-- STAFF TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    yclients_id INTEGER NOT NULL,
    company_id INTEGER,
    name VARCHAR(255) NOT NULL,
    specialization VARCHAR(255),
    position VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    is_bookable BOOLEAN DEFAULT true,
    rating NUMERIC(3, 2),
    votes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    avatar_url TEXT,
    information TEXT,
    service_ids INTEGER[],
    email VARCHAR(255),
    phone VARCHAR(50),
    telegram VARCHAR(100),
    experience_years INTEGER,
    level_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_sync_at TIMESTAMP,
    raw_data JSONB,
    declensions JSONB
);

CREATE INDEX IF NOT EXISTS idx_staff_yclients_id ON staff(yclients_id);
CREATE INDEX IF NOT EXISTS idx_staff_company_id ON staff(company_id);
CREATE INDEX IF NOT EXISTS idx_staff_is_active ON staff(is_active);

-- ============================================================================
-- STAFF_SCHEDULES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS staff_schedules (
    id BIGSERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL,
    staff_name VARCHAR(255),
    date DATE NOT NULL,
    is_working BOOLEAN DEFAULT true,
    work_start TIME,
    work_end TIME,
    working_hours VARCHAR(50),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    has_booking_slots BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff_id ON staff_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_date ON staff_schedules(date);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff_date ON staff_schedules(staff_id, date);

-- ============================================================================
-- BOOKINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    yclients_record_id INTEGER NOT NULL,
    company_id INTEGER,
    client_phone VARCHAR(50),
    client_name VARCHAR(255),
    client_yclients_id INTEGER,
    staff_id INTEGER,
    staff_name VARCHAR(255),
    services TEXT[],
    service_ids INTEGER[],
    datetime TIMESTAMP NOT NULL,
    date DATE,
    duration INTEGER,
    cost NUMERIC(12, 2),
    prepaid NUMERIC(12, 2),
    status VARCHAR(50),
    visit_attendance INTEGER,
    comment TEXT,
    online BOOLEAN DEFAULT false,
    record_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP,
    created_by_bot BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_bookings_yclients_record_id ON bookings(yclients_record_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client_phone ON bookings(client_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_datetime ON bookings(datetime);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_company_id ON bookings(company_id);

-- ============================================================================
-- DIALOG_CONTEXTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS dialog_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    state VARCHAR(100),
    data JSONB,
    messages JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    client_id INTEGER,
    last_activity TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    last_booking_id UUID,
    session_type VARCHAR(50),
    context_metadata JSONB,
    company_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_dialog_contexts_user_id ON dialog_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_dialog_contexts_company_id ON dialog_contexts(company_id);
CREATE INDEX IF NOT EXISTS idx_dialog_contexts_last_activity ON dialog_contexts(last_activity);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id INTEGER,
    client_phone VARCHAR(50),
    direction VARCHAR(20),
    content TEXT,
    message_type VARCHAR(50),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_messages_company_id ON messages(company_id);
CREATE INDEX IF NOT EXISTS idx_messages_client_phone ON messages(client_phone);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- ============================================================================
-- ACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id INTEGER,
    client_phone VARCHAR(50),
    action_type VARCHAR(100),
    action_data JSONB,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_actions_company_id ON actions(company_id);
CREATE INDEX IF NOT EXISTS idx_actions_client_phone ON actions(client_phone);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);

-- ============================================================================
-- COMPANY_SYNC_STATUS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_sync_status (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    last_sync_at TIMESTAMP,
    last_sync_success BOOLEAN,
    last_sync_error TEXT,
    clients_synced INTEGER DEFAULT 0,
    services_synced INTEGER DEFAULT 0,
    staff_synced INTEGER DEFAULT 0,
    bookings_synced INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_company_sync_status_company_id ON company_sync_status(company_id);

-- ============================================================================
-- GRANT PERMISSIONS (if needed)
-- ============================================================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO gen_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO gen_user;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
