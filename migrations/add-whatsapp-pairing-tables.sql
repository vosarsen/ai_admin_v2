-- Migration: Add WhatsApp Pairing Code Support
-- Date: 2025-09-19
-- Description: Tables for multi-tenant WhatsApp pairing code management

-- 1. Table for storing pairing codes history
CREATE TABLE IF NOT EXISTS whatsapp_pairing_codes (
    id SERIAL PRIMARY KEY,
    company_id VARCHAR(50) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    code VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, used, expired
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_company_status (company_id, status),
    INDEX idx_expires (expires_at)
);

-- 2. Table for WhatsApp events logging
CREATE TABLE IF NOT EXISTS whatsapp_events (
    id SERIAL PRIMARY KEY,
    company_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- pairing_requested, pairing_generated, pairing_used, qr_generated, connected, disconnected
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_company_events (company_id, event_type, created_at)
);

-- 3. Add columns to companies table for WhatsApp configuration
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS whatsapp_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_whatsapp_connection TIMESTAMP,
ADD COLUMN IF NOT EXISTS whatsapp_connection_method VARCHAR(20); -- qr, pairing_code

-- 4. Table for rate limiting and monitoring
CREATE TABLE IF NOT EXISTS whatsapp_rate_limits (
    id SERIAL PRIMARY KEY,
    company_id VARCHAR(50) NOT NULL UNIQUE,
    qr_attempts INT DEFAULT 0,
    pairing_attempts INT DEFAULT 0,
    last_qr_attempt TIMESTAMP,
    last_pairing_attempt TIMESTAMP,
    blocked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_blocked (blocked_until)
);

-- 5. Table for session health monitoring
CREATE TABLE IF NOT EXISTS whatsapp_session_health (
    id SERIAL PRIMARY KEY,
    company_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL, -- connected, disconnected, connecting, error
    last_seen TIMESTAMP,
    disconnect_reason VARCHAR(100),
    reconnect_attempts INT DEFAULT 0,
    health_score INT DEFAULT 100, -- 0-100
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_company_health (company_id, status),
    INDEX idx_health_score (health_score)
);

-- 6. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Add triggers for updated_at
CREATE TRIGGER update_whatsapp_rate_limits_updated_at
    BEFORE UPDATE ON whatsapp_rate_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_session_health_updated_at
    BEFORE UPDATE ON whatsapp_session_health
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. Insert sample configuration for existing companies
UPDATE companies
SET whatsapp_config = jsonb_build_object(
    'usePairingCode', false,
    'maxQRAttempts', 3,
    'autoReconnect', true,
    'reconnectDelay', 60000,
    'smsNotifications', false,
    'emailNotifications', true
)
WHERE whatsapp_config = '{}' OR whatsapp_config IS NULL;

-- 9. Create view for monitoring dashboard
CREATE OR REPLACE VIEW whatsapp_connection_status AS
SELECT
    c.company_id,
    c.title as company_name,
    c.whatsapp_enabled,
    c.whatsapp_connection_method,
    c.last_whatsapp_connection,
    sh.status as current_status,
    sh.health_score,
    sh.reconnect_attempts,
    sh.last_seen,
    rl.qr_attempts,
    rl.pairing_attempts,
    rl.blocked_until,
    CASE
        WHEN rl.blocked_until > CURRENT_TIMESTAMP THEN 'blocked'
        WHEN sh.status = 'connected' THEN 'healthy'
        WHEN sh.reconnect_attempts > 5 THEN 'unhealthy'
        ELSE 'unknown'
    END as overall_health
FROM companies c
LEFT JOIN whatsapp_session_health sh ON c.company_id = sh.company_id
    AND sh.id = (
        SELECT id FROM whatsapp_session_health
        WHERE company_id = c.company_id
        ORDER BY created_at DESC
        LIMIT 1
    )
LEFT JOIN whatsapp_rate_limits rl ON c.company_id = rl.company_id
WHERE c.whatsapp_enabled = true;

-- 10. Function to check if company can generate pairing code
CREATE OR REPLACE FUNCTION can_generate_pairing_code(p_company_id VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_rate_limit RECORD;
    v_time_since_attempt INTERVAL;
BEGIN
    SELECT * INTO v_rate_limit
    FROM whatsapp_rate_limits
    WHERE company_id = p_company_id;

    IF NOT FOUND THEN
        RETURN true;
    END IF;

    -- Check if blocked
    IF v_rate_limit.blocked_until > CURRENT_TIMESTAMP THEN
        RETURN false;
    END IF;

    -- Check attempts in last hour
    v_time_since_attempt := CURRENT_TIMESTAMP - v_rate_limit.last_pairing_attempt;

    IF v_time_since_attempt < INTERVAL '1 hour' AND v_rate_limit.pairing_attempts >= 5 THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 11. Function to log pairing code generation
CREATE OR REPLACE FUNCTION log_pairing_code_generation(
    p_company_id VARCHAR,
    p_phone_number VARCHAR,
    p_code VARCHAR
)
RETURNS VOID AS $$
BEGIN
    -- Insert pairing code record
    INSERT INTO whatsapp_pairing_codes (company_id, phone_number, code, expires_at)
    VALUES (p_company_id, p_phone_number, p_code, CURRENT_TIMESTAMP + INTERVAL '60 seconds');

    -- Update rate limits
    INSERT INTO whatsapp_rate_limits (company_id, pairing_attempts, last_pairing_attempt)
    VALUES (p_company_id, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (company_id) DO UPDATE
    SET pairing_attempts = CASE
            WHEN whatsapp_rate_limits.last_pairing_attempt < CURRENT_TIMESTAMP - INTERVAL '1 hour'
            THEN 1
            ELSE whatsapp_rate_limits.pairing_attempts + 1
        END,
        last_pairing_attempt = CURRENT_TIMESTAMP;

    -- Log event
    INSERT INTO whatsapp_events (company_id, event_type, details)
    VALUES (
        p_company_id,
        'pairing_generated',
        jsonb_build_object(
            'phone_number', p_phone_number,
            'code', p_code,
            'timestamp', CURRENT_TIMESTAMP
        )
    );
END;
$$ LANGUAGE plpgsql;

-- 12. Grant permissions (adjust based on your user roles)
GRANT SELECT, INSERT, UPDATE ON whatsapp_pairing_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON whatsapp_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON whatsapp_rate_limits TO authenticated;
GRANT SELECT, INSERT, UPDATE ON whatsapp_session_health TO authenticated;
GRANT SELECT ON whatsapp_connection_status TO authenticated;

-- 13. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_companies_whatsapp ON companies(company_id, whatsapp_enabled);
CREATE INDEX IF NOT EXISTS idx_pairing_codes_lookup ON whatsapp_pairing_codes(company_id, code, status);
CREATE INDEX IF NOT EXISTS idx_events_recent ON whatsapp_events(created_at DESC);

-- 14. Add comments for documentation
COMMENT ON TABLE whatsapp_pairing_codes IS 'Stores WhatsApp pairing codes for multi-tenant authentication';
COMMENT ON TABLE whatsapp_events IS 'Audit log for all WhatsApp-related events';
COMMENT ON TABLE whatsapp_rate_limits IS 'Rate limiting and abuse prevention for WhatsApp connections';
COMMENT ON TABLE whatsapp_session_health IS 'Real-time health monitoring for WhatsApp sessions';
COMMENT ON VIEW whatsapp_connection_status IS 'Dashboard view for monitoring all company WhatsApp connections';

-- 15. Sample data for testing (optional, remove in production)
-- INSERT INTO whatsapp_rate_limits (company_id, qr_attempts, pairing_attempts)
-- VALUES ('962302', 0, 0);

-- INSERT INTO whatsapp_session_health (company_id, status, health_score)
-- VALUES ('962302', 'disconnected', 75);