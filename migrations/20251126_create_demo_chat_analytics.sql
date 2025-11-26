-- Migration: Add demo_chat_events table
-- Date: 2025-11-26
-- Purpose: Track demo chat analytics for optimization and lead generation

-- Create demo_chat_events table
CREATE TABLE IF NOT EXISTS demo_chat_events (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL, -- 'session_start', 'message_sent', 'message_received', 'limit_reached', 'error'
  message TEXT,
  response TEXT,
  user_ip VARCHAR(45), -- IPv4 or IPv6
  processing_time_ms INTEGER,
  ai_provider VARCHAR(50), -- 'gemini-flash', 'deepseek', etc.
  error_type VARCHAR(100),
  error_message TEXT,
  event_data JSONB, -- Additional context (user agent, suggestions clicked, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_demo_chat_events_session_id ON demo_chat_events(session_id);
CREATE INDEX IF NOT EXISTS idx_demo_chat_events_event_type ON demo_chat_events(event_type);
CREATE INDEX IF NOT EXISTS idx_demo_chat_events_created_at ON demo_chat_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_chat_events_ai_provider ON demo_chat_events(ai_provider);
CREATE INDEX IF NOT EXISTS idx_demo_chat_events_user_ip ON demo_chat_events(user_ip);

-- Composite index for common analytics queries
CREATE INDEX IF NOT EXISTS idx_demo_chat_events_session_created ON demo_chat_events(session_id, created_at DESC);

-- Add comments
COMMENT ON TABLE demo_chat_events IS 'Tracks all events from demo chat for analytics and optimization';
COMMENT ON COLUMN demo_chat_events.session_id IS 'UUID v4 session identifier from frontend';
COMMENT ON COLUMN demo_chat_events.event_type IS 'Type of event: session_start, message_sent, message_received, limit_reached, error';
COMMENT ON COLUMN demo_chat_events.message IS 'User message (for message_sent events)';
COMMENT ON COLUMN demo_chat_events.response IS 'Bot response (for message_received events)';
COMMENT ON COLUMN demo_chat_events.user_ip IS 'User IP address for rate limiting analytics';
COMMENT ON COLUMN demo_chat_events.processing_time_ms IS 'AI processing time in milliseconds';
COMMENT ON COLUMN demo_chat_events.ai_provider IS 'AI provider used (gemini-flash, deepseek, etc.)';
COMMENT ON COLUMN demo_chat_events.error_type IS 'Error type if event_type is error';
COMMENT ON COLUMN demo_chat_events.error_message IS 'Error message if event_type is error';
COMMENT ON COLUMN demo_chat_events.event_data IS 'Additional JSON data (user agent, suggestions clicked, etc.)';
