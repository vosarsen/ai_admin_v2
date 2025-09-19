# 🏢 WhatsApp Multi-Tenant Configuration Guide

> Complete guide for configuring and deploying WhatsApp system in multi-tenant mode

## 📋 Table of Contents

- [Overview](#overview)
- [Configuration](#configuration)
- [Environment Variables](#environment-variables)
- [API Usage](#api-usage)
- [Metrics & Monitoring](#metrics--monitoring)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Migration](#migration)

## 🎯 Overview

The WhatsApp system now fully supports multi-tenant operations, allowing multiple companies to use isolated WhatsApp sessions on the same server.

### Key Features

- **Complete Isolation**: Each company has its own session, data, and metrics
- **No Hardcoded Values**: Everything configurable via environment variables
- **Per-Company Metrics**: Track usage and performance per tenant
- **Security Validation**: Input validation and sanitization
- **Rate Limiting**: Individual limits per company
- **Auto-Cleanup**: TTL-based memory management

## ⚙️ Configuration

### Quick Start

```bash
# Enable multi-tenant mode
export WHATSAPP_MULTI_TENANT=true
export WHATSAPP_MAX_SESSIONS=1000

# Start the service
npm start
```

### Single-Tenant Mode (Legacy)

```bash
# Disable multi-tenant for single company
export WHATSAPP_MULTI_TENANT=false
export DEFAULT_COMPANY_ID=962302
```

## 🔧 Environment Variables

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `WHATSAPP_PROVIDER` | `baileys` | WhatsApp provider to use |
| `WHATSAPP_MULTI_TENANT` | `true` | Enable multi-tenant mode |
| `WHATSAPP_MAX_SESSIONS` | `1000` | Maximum concurrent sessions |
| `DEFAULT_COMPANY_ID` | `null` | Default company (single-tenant only) |

### Session Management

| Variable | Default | Description |
|----------|---------|-------------|
| `WHATSAPP_SESSION_TTL` | `3600000` | Session TTL (1 hour) |
| `WHATSAPP_AUTH_STATE_TTL` | `7200000` | Auth state TTL (2 hours) |
| `WHATSAPP_CLEANUP_INTERVAL` | `60000` | Cleanup interval (1 minute) |
| `WHATSAPP_MAX_LISTENERS` | `20` | Max event listeners |

### Connection Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `WHATSAPP_MAX_RECONNECT_ATTEMPTS` | `10` | Max reconnection attempts |
| `WHATSAPP_RECONNECT_DELAY` | `5000` | Initial reconnect delay (ms) |
| `WHATSAPP_KEEPALIVE_INTERVAL` | `30000` | Keep-alive interval (ms) |
| `WHATSAPP_CONNECTION_TIMEOUT` | `60000` | Connection timeout (ms) |
| `WHATSAPP_USE_PAIRING_CODE` | `false` | Enable pairing code auth |
| `WHATSAPP_MAX_QR_ATTEMPTS` | `3` | Max QR generation attempts |

### Security Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `WHATSAPP_VALIDATE_WEBHOOKS` | `true` | Validate webhook signatures |
| `WHATSAPP_WEBHOOK_SECRET` | - | Webhook validation secret |
| `WHATSAPP_ALLOWED_PHONE_PATTERN` | `^[0-9]{10,15}$` | Allowed phone pattern |
| `WHATSAPP_BLOCKED_NUMBERS` | - | Comma-separated blocked numbers |
| `WHATSAPP_ENCRYPT_MESSAGES` | `false` | Encrypt stored messages |
| `WHATSAPP_ENCRYPTION_KEY` | - | Encryption key (if enabled) |

### Multi-Tenant Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `WHATSAPP_VALIDATE_COMPANY` | `true` | Validate company IDs |
| `WHATSAPP_COMPANY_ID_PATTERN` | `^[a-zA-Z0-9_-]+$` | Company ID pattern |
| `WHATSAPP_RATE_LIMIT_PER_COMPANY` | `100` | Messages/minute per company |
| `WHATSAPP_RATE_LIMIT_WINDOW` | `60000` | Rate limit window (ms) |
| `WHATSAPP_ISOLATE_AUTH` | `true` | Isolate auth between companies |

### Monitoring Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `WHATSAPP_METRICS_ENABLED` | `true` | Enable metrics collection |
| `WHATSAPP_METRICS_INTERVAL` | `60000` | Metrics collection interval |
| `WHATSAPP_HEALTH_CHECK_ENABLED` | `true` | Enable health checks |
| `WHATSAPP_HEALTH_CHECK_INTERVAL` | `30000` | Health check interval |
| `WHATSAPP_ALERTING_ENABLED` | `false` | Enable alerting |
| `WHATSAPP_ALERT_WEBHOOK` | - | Alert webhook URL |
| `WHATSAPP_ALERT_ERROR_RATE` | `0.1` | Error rate threshold (10%) |
| `WHATSAPP_ALERT_DISCONNECT_RATE` | `0.2` | Disconnect rate threshold |
| `WHATSAPP_ALERT_MEMORY_MB` | `500` | Memory usage threshold |

### Logging Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `WHATSAPP_LOG_LEVEL` | `info` | Log level |
| `WHATSAPP_LOG_TO_FILE` | `false` | Enable file logging |
| `WHATSAPP_LOG_PATH` | `logs/whatsapp.log` | Log file path |
| `WHATSAPP_DEBUG_BAILEYS` | `false` | Debug Baileys library |
| `WHATSAPP_DEBUG_SESSIONS` | `false` | Debug session management |

## 📡 API Usage

### Sending Messages (Multi-Tenant)

```javascript
// Always include companyId in multi-tenant mode
const response = await fetch('/api/whatsapp/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    companyId: 'company-123',  // Required in multi-tenant
    phone: '79001234567',
    message: 'Hello from Company 123!'
  })
});
```

### Initialize Company Session

```javascript
// Initialize WhatsApp for a specific company
await fetch('/api/whatsapp/sessions/company-123/initialize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    usePairingCode: false,
    phoneNumber: '79001234567'  // Required if usePairingCode: true
  })
});
```

### Get Company Metrics

```javascript
// Get metrics for specific company
const metrics = await fetch('/api/whatsapp/metrics/company-123');

// Response format:
{
  "success": true,
  "metrics": {
    "companyId": "company-123",
    "uptime": 3600000,
    "messages": {
      "sent": 150,
      "received": 200,
      "failed": 5
    },
    "errors": {
      "total": 5,
      "rate": "3.33%"
    }
  }
}
```

## 📊 Metrics & Monitoring

### Available Metrics Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/whatsapp/metrics` | Global metrics |
| `GET /api/whatsapp/metrics/:companyId` | Company metrics |
| `GET /api/whatsapp/metrics/companies/all` | All companies |
| `GET /api/whatsapp/metrics/performance` | Performance stats |
| `GET /api/whatsapp/metrics/timeseries` | Time series data |
| `GET /api/whatsapp/metrics/rate` | Message rate |
| `GET /api/whatsapp/metrics/alerts` | Check alerts |
| `GET /api/whatsapp/health/metrics` | Health with metrics |

### Metrics Structure

```javascript
{
  "global": {
    "messagesSent": 1000,
    "messagesReceived": 1500,
    "sessions": {
      "active": 25,
      "connections": 30,
      "disconnections": 5
    },
    "errors": {
      "total": 10,
      "rate": "0.4%",
      "breakdown": {
        "TIMEOUT": 5,
        "NETWORK": 3,
        "AUTH": 2
      }
    }
  },
  "companies": {
    "company-123": { /* company specific metrics */ },
    "company-456": { /* company specific metrics */ }
  }
}
```

### Setting Up Monitoring

```bash
# Enable all monitoring features
export WHATSAPP_METRICS_ENABLED=true
export WHATSAPP_HEALTH_CHECK_ENABLED=true
export WHATSAPP_ALERTING_ENABLED=true
export WHATSAPP_ALERT_WEBHOOK=https://your-webhook.com/alerts

# Set thresholds
export WHATSAPP_ALERT_ERROR_RATE=0.05  # Alert at 5% error rate
export WHATSAPP_ALERT_MEMORY_MB=1000   # Alert at 1GB memory
```

## 🔒 Security

### Input Validation

All inputs are validated:
- **Company IDs**: Must match pattern (alphanumeric + dash/underscore)
- **Phone Numbers**: Must be 10-15 digits
- **Messages**: Sanitized for suspicious content
- **URLs**: Validated for media messages

### Rate Limiting

```bash
# Configure per-company rate limiting
export WHATSAPP_RATE_LIMIT_PER_COMPANY=100  # 100 messages
export WHATSAPP_RATE_LIMIT_WINDOW=60000      # per minute
```

### Phone Number Blocking

```bash
# Block specific numbers
export WHATSAPP_BLOCKED_NUMBERS=79001234567,79009999999
```

### Webhook Security

```bash
# Enable webhook validation
export WHATSAPP_VALIDATE_WEBHOOKS=true
export WHATSAPP_WEBHOOK_SECRET=your-secret-key-here
```

## 🔧 Troubleshooting

### Common Issues

#### "Company ID is required in multi-tenant mode"
- **Cause**: No company ID provided in multi-tenant mode
- **Solution**: Always include `companyId` in requests

#### "Invalid company ID format"
- **Cause**: Company ID doesn't match pattern
- **Solution**: Use only alphanumeric, dash, underscore

#### "Rate limit exceeded"
- **Cause**: Too many messages from one company
- **Solution**: Implement queuing or increase limits

#### "No active session for company"
- **Cause**: Company session not initialized
- **Solution**: Call `/api/whatsapp/sessions/:companyId/initialize`

### Debug Mode

```bash
# Enable debug logging
export WHATSAPP_LOG_LEVEL=debug
export WHATSAPP_DEBUG_SESSIONS=true
export WHATSAPP_DEBUG_BAILEYS=true

# Check logs
pm2 logs ai-admin-api --lines 100
```

### Health Check

```bash
# Check system health
curl http://localhost:3000/api/whatsapp/health/metrics

# Response shows:
# - Session status per company
# - Current metrics
# - Active alerts
# - System resources
```

## 🔄 Migration

### From Single to Multi-Tenant

1. **Backup current data**
   ```bash
   cp -r /opt/ai-admin/sessions /opt/ai-admin/sessions.backup
   ```

2. **Update environment**
   ```bash
   # Enable multi-tenant
   export WHATSAPP_MULTI_TENANT=true
   unset DEFAULT_COMPANY_ID
   ```

3. **Update API calls**
   ```javascript
   // Old (single-tenant)
   await sendMessage(phone, message);

   // New (multi-tenant)
   await sendMessage(phone, message, { companyId: 'company-123' });
   ```

4. **Restart services**
   ```bash
   pm2 restart ai-admin-api
   ```

### From Hardcoded to Configurable

1. **Remove hardcoded values from code**
   - No more `962302` in source code
   - All settings via environment

2. **Set environment variables**
   ```bash
   # Create .env file
   cat > .env << EOF
   WHATSAPP_MULTI_TENANT=true
   WHATSAPP_MAX_SESSIONS=100
   # ... other settings
   EOF
   ```

3. **Deploy updated code**
   ```bash
   git pull origin main
   npm install
   pm2 restart all
   ```

## 📚 Examples

### Complete Multi-Tenant Setup

```bash
#!/bin/bash
# setup-multi-tenant.sh

# Core settings
export WHATSAPP_MULTI_TENANT=true
export WHATSAPP_MAX_SESSIONS=500
export WHATSAPP_PROVIDER=baileys

# Security
export WHATSAPP_VALIDATE_COMPANY=true
export WHATSAPP_COMPANY_ID_PATTERN="^[a-zA-Z0-9_-]+$"
export WHATSAPP_VALIDATE_WEBHOOKS=true
export WHATSAPP_WEBHOOK_SECRET="$(openssl rand -hex 32)"

# Rate limiting
export WHATSAPP_RATE_LIMIT_PER_COMPANY=100
export WHATSAPP_RATE_LIMIT_WINDOW=60000

# Monitoring
export WHATSAPP_METRICS_ENABLED=true
export WHATSAPP_HEALTH_CHECK_ENABLED=true
export WHATSAPP_ALERT_ERROR_RATE=0.05

# Logging
export WHATSAPP_LOG_LEVEL=info
export WHATSAPP_LOG_TO_FILE=true

# Start service
npm start
```

### Company Initialization Script

```javascript
// init-companies.js
const companies = [
  { id: 'salon-1', name: 'Beauty Salon 1' },
  { id: 'salon-2', name: 'Beauty Salon 2' },
  { id: 'salon-3', name: 'Beauty Salon 3' }
];

async function initializeCompanies() {
  for (const company of companies) {
    try {
      const response = await fetch(`/api/whatsapp/sessions/${company.id}/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usePairingCode: false
        })
      });

      if (response.ok) {
        console.log(`✅ Initialized ${company.name}`);
      } else {
        console.error(`❌ Failed to initialize ${company.name}`);
      }
    } catch (error) {
      console.error(`Error initializing ${company.name}:`, error);
    }
  }
}

initializeCompanies();
```

## 📈 Performance Considerations

### Memory Usage
- **Base**: ~50MB for API server
- **Per Session**: ~15MB per active WhatsApp session
- **TTL Cleanup**: Automatic after configured TTL expires
- **Max Memory**: (50MB + (sessions * 15MB))

### Scaling Recommendations
- **< 100 companies**: Single server sufficient
- **100-500 companies**: 4GB RAM recommended
- **500-1000 companies**: 8GB RAM, consider load balancing
- **> 1000 companies**: Multiple servers with load balancer

### Optimization Tips
1. Adjust TTL values based on usage patterns
2. Enable message batching for high volume
3. Use pairing code instead of QR for automation
4. Monitor metrics to identify bottlenecks
5. Implement caching for frequently accessed data

## 🆘 Support

### Documentation
- [WhatsApp Complete Documentation](./WHATSAPP_COMPLETE_DOCUMENTATION.md)
- [Architecture Guide](./WHATSAPP_SIMPLIFIED_ARCHITECTURE.md)
- [Development Diary](../development-diary/2025-09-19-multi-tenant-whatsapp-refactoring.md)

### Monitoring Dashboard
```bash
# View real-time metrics
curl http://localhost:3000/api/whatsapp/metrics/export | jq .

# Monitor specific company
curl http://localhost:3000/api/whatsapp/metrics/company-123 | jq .

# Check alerts
curl http://localhost:3000/api/whatsapp/metrics/alerts | jq .
```

---

**Last Updated**: September 19, 2025
**Version**: 2.0.0 (Multi-Tenant Release)
**Status**: Production Ready