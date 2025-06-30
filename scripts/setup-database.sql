-- Database setup for AI Admin MVP
-- Run this in your PostgreSQL/Supabase database

-- Companies table (multi-tenant support)
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    yclients_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'Europe/Moscow',
    settings JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    phone VARCHAR(20) NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    yclients_id VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, phone)
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    client_id INTEGER REFERENCES clients(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE,
    message_count INTEGER DEFAULT 0,
    context JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active'
);

-- Messages table (partitioned by date)
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL,
    conversation_id INTEGER REFERENCES conversations(id),
    company_id INTEGER REFERENCES companies(id),
    direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
    message_type VARCHAR(20) DEFAULT 'text',
    content TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for current and next month
CREATE TABLE IF NOT EXISTS messages_2025_01 PARTITION OF messages
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS messages_2025_02 PARTITION OF messages
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    client_id INTEGER REFERENCES clients(id),
    yclients_record_id VARCHAR(50),
    service_name VARCHAR(255),
    staff_name VARCHAR(255),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    price DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'confirmed',
    reminder_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_company_phone ON clients(company_id, phone);
CREATE INDEX idx_conversations_client ON conversations(client_id);
CREATE INDEX idx_conversations_company ON conversations(company_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_bookings_scheduled ON bookings(scheduled_at);
CREATE INDEX idx_bookings_client ON bookings(client_id);
CREATE INDEX idx_analytics_company_type ON analytics_events(company_id, event_type);

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Views for analytics
CREATE OR REPLACE VIEW daily_stats AS
SELECT 
    c.id as company_id,
    c.name as company_name,
    DATE(m.created_at) as date,
    COUNT(DISTINCT conv.client_id) as unique_clients,
    COUNT(m.id) as total_messages,
    COUNT(CASE WHEN m.direction = 'inbound' THEN 1 END) as inbound_messages,
    COUNT(CASE WHEN m.direction = 'outbound' THEN 1 END) as outbound_messages
FROM companies c
LEFT JOIN messages m ON m.company_id = c.id
LEFT JOIN conversations conv ON m.conversation_id = conv.id
WHERE m.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.id, c.name, DATE(m.created_at);

-- Sample data for testing
INSERT INTO companies (yclients_id, name, timezone) VALUES 
    ('962302', 'Test Barbershop', 'Europe/Moscow')
ON CONFLICT (yclients_id) DO NOTHING;

-- Permissions (for Supabase)
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;