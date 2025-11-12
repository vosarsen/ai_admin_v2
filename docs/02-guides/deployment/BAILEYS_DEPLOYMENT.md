# Baileys WhatsApp Provider - Deployment Guide

## Overview

This guide covers the deployment and configuration of the Baileys WhatsApp provider, which replaces Venom Bot with a lighter, more scalable multi-tenant solution.

## Key Benefits of Baileys

- **Lightweight**: Lower memory footprint (~50-100MB vs 500MB+ for Venom)
- **Multi-tenant**: Native support for multiple WhatsApp accounts
- **No Browser Required**: Direct WhatsApp Web API implementation
- **Better Performance**: Faster message processing
- **Session Persistence**: Automatic session restoration

## Architecture

```
┌─────────────────────┐
│   WhatsApp API      │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  Baileys Provider   │
│  (Multi-Session)    │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  Session Manager    │
│  (Company Router)   │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  Message Workers    │
│  (Processing)       │
└─────────────────────┘
```

## Installation

### 1. Install Dependencies

```bash
npm install @whiskeysockets/baileys pino qrcode-terminal
```

### 2. Environment Configuration

Update your `.env` file:

```bash
# WhatsApp Provider Configuration
WHATSAPP_PROVIDER=baileys          # Use 'baileys' instead of 'venom'
WHATSAPP_MULTI_TENANT=true         # Enable multi-tenant support
WHATSAPP_SESSIONS_PATH=./sessions  # Directory for session storage

# Optional: Keep Venom as fallback
# WHATSAPP_PROVIDER=venom
```

### 3. Run Migration Script

```bash
node scripts/migrate-to-baileys.js
```

This will:
- Backup your current configuration
- Update environment variables
- Create sessions directory
- Update database schema
- Migrate company settings

## Multi-Tenant Setup

### Database Schema

Ensure your `companies` table has these columns:

```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_status TEXT DEFAULT 'disconnected';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_config JSONB;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_last_connected TIMESTAMP;
```

### Company Configuration

Each company can have its own WhatsApp configuration:

```javascript
{
  whatsapp_enabled: true,
  whatsapp_config: {
    provider: 'baileys',
    autoReconnect: true,
    sessionTimeout: 300000, // 5 minutes
    customWebhook: 'https://company.com/webhook' // optional
  }
}
```

## Usage

### Basic Usage (Single Tenant)

```javascript
const whatsappClient = require('./src/integrations/whatsapp/baileys-client');

// Initialize
await whatsappClient.initialize();

// Send message
await whatsappClient.sendMessage('79001234567', 'Hello from Baileys!');
```

### Multi-Tenant Usage

```javascript
const sessionManager = require('./src/integrations/whatsapp/session-manager');

// Initialize manager
await sessionManager.initialize();

// Initialize company session
await sessionManager.initializeCompanySession('company_123', {
  autoReconnect: true
});

// Send message for specific company
await sessionManager.sendMessage('company_123', '79001234567', 'Hello!');
```

### Using Client Factory (Recommended)

```javascript
const clientFactory = require('./src/integrations/whatsapp/client-factory');

// Get client (automatically uses configured provider)
const whatsappClient = clientFactory.getClient();

// Use as normal
await whatsappClient.sendMessage('79001234567', 'Hello!');

// Switch provider at runtime (for testing)
clientFactory.switchProvider('venom'); // or 'baileys'
```

## Authentication

### QR Code Authentication

1. Start the application
2. Get QR code for company:

```javascript
const qr = await sessionManager.getQRCode('company_123');
```

3. Scan with WhatsApp mobile app
4. Session is saved automatically

### Session Persistence

Sessions are stored in `./sessions/company_${companyId}/` directory:
- `creds.json` - Authentication credentials
- `app-state-sync-*` - Session state files
- `store.json` - Message history cache

## API Endpoints

### Health Check
```
GET /api/whatsapp/status
```

### Get QR Code
```
GET /api/whatsapp/qr/:companyId
```

### Send Message
```
POST /api/whatsapp/send
{
  "companyId": "123",
  "phone": "79001234567",
  "message": "Hello!"
}
```

### Get All Sessions
```
GET /api/whatsapp/sessions
```

## Monitoring

### Session Health Check

The system automatically monitors session health every minute:
- Checks connection status
- Attempts reconnection if disconnected
- Updates database status

### Logs

Monitor Baileys logs:

```bash
# All WhatsApp logs
pm2 logs ai-admin-worker-v2 | grep -i whatsapp

# Session events
pm2 logs ai-admin-worker-v2 | grep -i "session"

# Connection issues
pm2 logs ai-admin-worker-v2 | grep -i "disconnect"
```

### Metrics

Key metrics to monitor:
- Active sessions count
- Message send success rate
- Reconnection attempts
- Session uptime

## Troubleshooting

### Common Issues

#### 1. QR Code Not Appearing
```bash
# Check if session already exists
ls -la ./sessions/company_*/

# Clear session and retry
rm -rf ./sessions/company_123/
```

#### 2. Connection Drops
```javascript
// Increase reconnect attempts in config
{
  maxReconnectAttempts: 10,
  reconnectDelay: 10000 // 10 seconds
}
```

#### 3. Message Not Sending
```bash
# Check session status
node -e "
const sm = require('./src/integrations/whatsapp/session-manager');
sm.initialize().then(() => {
  console.log(sm.getSessionStatus('company_123'));
});
"
```

#### 4. Memory Issues
```javascript
// Limit store size in baileys-provider.js
const store = makeInMemoryStore({ 
  logger: P({ level: 'silent' }),
  maxMessages: 100 // Limit message cache
});
```

## Performance Optimization

### 1. Session Pooling
- Reuse sessions across multiple companies when possible
- Implement session rotation for high-volume accounts

### 2. Message Batching
- Group messages to same recipient
- Use bulk send operations

### 3. Resource Limits
```javascript
// In session-manager.js
const MAX_SESSIONS = 50; // Limit concurrent sessions
const SESSION_TIMEOUT = 300000; // 5 minutes idle timeout
```

## Migration from Venom

### Gradual Migration

1. **Phase 1**: Run both providers in parallel
   ```bash
   WHATSAPP_PROVIDER=venom # Keep existing
   ```

2. **Phase 2**: Test Baileys with specific companies
   ```javascript
   if (company.testBaileys) {
     clientFactory.switchProvider('baileys');
   }
   ```

3. **Phase 3**: Full migration
   ```bash
   WHATSAPP_PROVIDER=baileys
   ```

### Rollback Plan

If issues occur:

1. Switch back to Venom:
   ```bash
   WHATSAPP_PROVIDER=venom
   ```

2. Restore environment backup:
   ```bash
   cp .env.backup-* .env
   ```

3. Restart workers:
   ```bash
   pm2 restart all
   ```

## Security Considerations

### Session Security

1. **Encrypt session files**:
   ```javascript
   // In baileys-provider.js
   const crypto = require('crypto');
   // Encrypt creds before saving
   ```

2. **Restrict session directory**:
   ```bash
   chmod 700 ./sessions
   ```

3. **Regular session rotation**:
   - Implement automatic re-authentication every 30 days
   - Monitor for suspicious activity

### Rate Limiting

Implement rate limiting per company:
```javascript
const rateLimits = new Map(); // companyId -> { count, resetTime }
```

## Production Checklist

- [ ] Environment variables configured
- [ ] Sessions directory created with proper permissions
- [ ] Database schema updated
- [ ] Backup of existing configuration
- [ ] QR code authentication completed for each company
- [ ] Monitoring alerts configured
- [ ] Rate limiting implemented
- [ ] Session encryption enabled
- [ ] Automatic reconnection tested
- [ ] Rollback plan documented

## Support

For issues or questions:
1. Check logs: `pm2 logs ai-admin-worker-v2`
2. Test connection: `node tests/test-baileys.js`
3. Review session files: `ls -la ./sessions/`
4. Check database: Company WhatsApp status

## References

- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys)
- [WhatsApp Web API](https://github.com/sigalor/whatsapp-web-reveng)
- [Multi-tenant Architecture](https://www.cloudflare.com/learning/cloud/what-is-multitenancy/)