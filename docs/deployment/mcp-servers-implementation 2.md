# MCP Servers Implementation Guide

## Overview

All 5 MCP (Model Context Protocol) servers have been successfully implemented following the same ES modules pattern as the Supabase MCP server. Each server provides direct access to its respective system without requiring manual script creation.

## Implementation Status ✅

| Server | Status | Description |
|--------|--------|-------------|
| **Supabase** | ✅ Working | Direct database access |
| **Logs** | ✅ Implemented | SSH-based log access |
| **WhatsApp** | ✅ Working | WhatsApp testing automation |
| **Redis** | ✅ Implemented | Redis context management |
| **YClients** | ✅ Working | YClients API integration |

## Server Details

### 1. Supabase MCP (`mcp-supabase/`)
**Status**: Fully functional

**Tools Available**:
- `query_table` - Query any table with filters
- `list_tables` - List all tables with row counts
- `get_database_stats` - Get database statistics
- `search_bookings` - Search bookings with complex filters

**Requirements**: 
- `SUPABASE_URL` and `SUPABASE_KEY` in environment

### 2. Logs MCP (`mcp-logs/`)
**Status**: Implemented, requires SSH credentials

**Tools Available**:
- `logs_tail` - Get last N lines from PM2 logs
- `logs_search` - Search for pattern in logs
- `logs_errors` - Get recent errors from logs
- `pm2_status` - Get PM2 process status
- `pm2_restart` - Restart PM2 service
- `logs_live` - Get live logs for the last N seconds

**Requirements**:
- `SERVER_PASSWORD` or `SSH_PRIVATE_KEY` in environment
- SSH access to server (46.149.70.219)

### 3. WhatsApp MCP (`mcp-whatsapp/`)
**Status**: Fully functional

**Tools Available**:
- `send_message` - Send test message to WhatsApp bot
- `get_last_response` - Get the last bot response
- `get_conversation` - Get full conversation history
- `run_scenario` - Run predefined test scenarios
- `clear_test_data` - Clear all test data
- `simulate_response` - Simulate bot response for testing

**Requirements**:
- `AI_ADMIN_API_URL` (default: http://localhost:3000)
- `SECRET_KEY` for webhook signatures

### 4. Redis MCP (`mcp-redis/`)
**Status**: Implemented, requires Redis server

**Tools Available**:
- `get_context` - Get conversation context
- `clear_context` - Clear conversation context
- `set_booking_stage` - Set specific booking stage
- `list_active_contexts` - List all active contexts
- `set_client_preferences` - Set client preferences
- `simulate_returning_client` - Simulate returning client
- `get_all_keys` - Get all Redis keys matching pattern

**Requirements**:
- Redis server running (default: localhost:6379)
- `REDIS_URL` in environment

### 5. YClients MCP (`mcp-yclients/`)
**Status**: Fully functional

**Tools Available**:
- `get_services` - Get list of company services
- `get_available_slots` - Get available booking slots
- `create_test_booking` - Create a test booking
- `get_booking` - Get booking details
- `cancel_booking` - Cancel a booking
- `get_staff` - Get staff members list
- `get_staff_schedule` - Get staff member schedule
- `search_clients` - Search clients by phone or name
- `get_client_visits` - Get client visit history
- `check_booking` - Check booking availability

**Requirements**:
- `YCLIENTS_API_KEY` in environment
- Optional: `YCLIENTS_USER_TOKEN` for some operations

## Key Improvements

### 1. Consistent Pattern
All servers now follow the same ES modules pattern:
- Use `McpServer` from `@modelcontextprotocol/sdk`
- Proper error handling
- Environment variable loading via dotenv
- Zod schema validation for inputs

### 2. Better Error Messages
Each server provides clear error messages when:
- Environment variables are missing
- External services are unavailable
- Invalid parameters are provided

### 3. Enhanced Features
- **Logs**: Added `logs_live` tool for real-time log streaming
- **WhatsApp**: Added `simulate_response` for testing without actual bot
- **Redis**: Added `get_all_keys` for debugging Redis state
- **YClients**: Added `check_booking` to validate before creating

## Environment Setup

Add these to your `.env` file:

```bash
# Supabase (already configured)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Logs MCP
SERVER_HOST=46.149.70.219
SERVER_USER=root
SERVER_PASSWORD=your_ssh_password
# Or use SSH key:
# SSH_PRIVATE_KEY=/path/to/private/key

# WhatsApp MCP
AI_ADMIN_API_URL=http://localhost:3000
SECRET_KEY=your_webhook_secret
DEFAULT_COMPANY_ID=962302

# Redis MCP
REDIS_URL=redis://localhost:6379

# YClients MCP
YCLIENTS_API_KEY=your_yclients_api_key
YCLIENTS_USER_TOKEN=optional_user_token
```

## Testing

Run the test script to verify all servers:

```bash
node test-mcp-servers.js
```

Expected results:
- ✅ Supabase, WhatsApp, YClients should work immediately
- ⚠️ Logs requires SSH credentials
- ⚠️ Redis requires Redis server running

## Usage in Claude Code

Once configured, you can use these MCP tools directly:

```
@supabase query_table table:"clients" filters:{"phone": "79001234567"}
@logs logs_tail service:"ai-admin-worker-v2" lines:100
@whatsapp send_message phone:"79001234567" message:"Тест"
@redis get_context phone:"79001234567"
@yclients get_services company_id:962302
```

## Troubleshooting

### Logs MCP not working
- Check SSH credentials in `.env`
- Verify SSH access: `ssh root@46.149.70.219`

### Redis MCP not working
- Start Redis: `redis-server`
- Or update `REDIS_URL` to point to remote Redis

### YClients MCP authentication errors
- Verify `YCLIENTS_API_KEY` is correct
- Some endpoints may require `YCLIENTS_USER_TOKEN`