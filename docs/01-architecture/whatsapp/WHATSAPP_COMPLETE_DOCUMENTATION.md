# 📚 WhatsApp System - Complete Documentation

## 📑 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Configuration](#configuration)
5. [API Reference](#api-reference)
6. [Multi-Tenant System](#multi-tenant-system)
7. [Error Handling](#error-handling)
8. [Authentication Methods](#authentication-methods)
9. [Monitoring & Health](#monitoring--health)
10. [Troubleshooting](#troubleshooting)
11. [Migration Guide](#migration-guide)
12. [Developer Guide](#developer-guide)
13. [Performance Optimization](#performance-optimization)
14. [Security](#security)
15. [Deployment](#deployment)

---

## 🎯 Overview

AI Admin v2 WhatsApp System is a production-ready, multi-tenant WhatsApp integration built on Baileys library. It supports up to 10,000+ companies with isolated sessions, automatic recovery, and comprehensive monitoring.

### Key Features
- ✅ **Multi-tenant architecture** - Isolated sessions per company
- ✅ **Dual authentication** - QR Code and Pairing Code methods
- ✅ **Auto-recovery** - Automatic reconnection with exponential backoff
- ✅ **Memory optimization** - TTL-based automatic cleanup
- ✅ **Standardized errors** - Consistent error handling
- ✅ **3-layer architecture** - Simplified and maintainable
- ✅ **Rate limiting** - Protection against abuse
- ✅ **Health monitoring** - Real-time session health checks

### System Requirements
- Node.js 18+
- Redis 6+
- PostgreSQL 13+ (Supabase)
- 2GB RAM minimum
- 10GB disk space

---

## 🏗️ Architecture

### 3-Layer Architecture

```
┌─────────────────────────────────────────────────┐
│            WhatsApp Manager                      │ Layer 1: Public API
│    (Unified interface, backward compatible)      │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│            Session Manager                       │ Layer 2: Business Logic
│    (Multi-tenant, lifecycle, monitoring)         │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│            Baileys Provider                      │ Layer 3: Protocol
│    (WhatsApp protocol implementation)            │
└─────────────────────────────────────────────────┘
```

### Component Structure

```
src/
├── integrations/whatsapp/
│   ├── whatsapp-manager.js        # Layer 1: Public API
│   ├── session-manager.js         # Layer 2: Session management
│   └── providers/
│       └── baileys-provider.js    # Layer 3: Protocol implementation
│
├── services/whatsapp/
│   ├── health-monitor.js          # Health monitoring
│   ├── pairing-code-manager.js    # Pairing code management
│   └── session-state-manager.js   # Redis state management
│
├── utils/
│   ├── whatsapp-errors.js         # Error classes
│   └── ttl-map.js                 # Auto-cleanup Map
│
├── api/
│   ├── routes/
│   │   ├── whatsapp-standardized.js  # API endpoints
│   │   └── whatsapp-sessions.js      # Session endpoints
│   └── webhooks/
│       └── whatsapp-baileys.js       # Webhook handlers
│
└── middlewares/
    └── whatsapp-error-handler.js     # Error middleware
```

---

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your credentials
```

### Basic Usage

```javascript
const whatsappManager = require('./src/integrations/whatsapp/whatsapp-manager');

// Initialize
await whatsappManager.initialize();

// Send message
await whatsappManager.sendMessage('79001234567', 'Hello World!');

// Send media
await whatsappManager.sendMedia(
  '79001234567',
  'https://example.com/image.jpg',
  'image',
  'Check this out!'
);

// Get QR code for authentication
const qr = await whatsappManager.getQRCode();
console.log('Scan this QR:', qr);
```

---

## ⚙️ Configuration

### Environment Variables

```bash
# WhatsApp Configuration
WHATSAPP_PROVIDER=baileys              # Provider: baileys or venom
USE_PAIRING_CODE=false                 # Use pairing code instead of QR
WHATSAPP_SESSIONS_PATH=./sessions      # Sessions storage path

# Company Configuration
YCLIENTS_COMPANY_ID=962302            # Default company ID
COMPANY_PHONE=79686484488             # Company phone for pairing

# Database
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJxxx...
REDIS_URL=redis://localhost:6379

# Monitoring
HEALTH_CHECK_INTERVAL=30000           # Health check interval (ms)
MAX_RECONNECT_ATTEMPTS=10             # Max reconnection attempts
RECONNECT_DELAY=5000                  # Base reconnect delay (ms)

# Rate Limiting
RATE_LIMIT_WINDOW=60000               # Rate limit window (ms)
RATE_LIMIT_MAX_REQUESTS=30           # Max requests per window

# TTL Configuration
SESSION_TTL=3600000                   # Session TTL (1 hour)
QR_CODE_TTL=60000                    # QR code TTL (60 seconds)
PAIRING_CODE_TTL=60000               # Pairing code TTL (60 seconds)
```

### Configuration Object

```javascript
// src/config/index.js
module.exports = {
  whatsapp: {
    provider: 'baileys',
    multiTenant: true,
    sessionsPath: './sessions',
    timeout: 30000,
    retries: 3,
    keepAliveInterval: 30000,
    qrTimeout: 60000,
    maxQRAttempts: 3,
    usePairingCode: false
  },
  // ... other config
};
```

---

## 📡 API Reference

### Base URL
```
http://localhost:3000/api/whatsapp
```

### Endpoints

#### Send Message
```http
POST /api/whatsapp/send
Content-Type: application/json

{
  "phone": "79001234567",
  "message": "Hello World",
  "companyId": "962302"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "messageId": "3A0BD8F5E8B9C4D2E1F3"
  }
}
```

#### Send Media
```http
POST /api/whatsapp/send-media
Content-Type: application/json

{
  "phone": "79001234567",
  "mediaUrl": "https://example.com/image.jpg",
  "type": "image",
  "caption": "Check this out!",
  "companyId": "962302"
}
```

#### Get Session Status
```http
GET /api/whatsapp/sessions/{companyId}/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "status": "connected",
    "user": {
      "id": "79686484488@s.whatsapp.net",
      "name": "AI Admin Bot"
    },
    "connectedAt": "2025-09-19T10:30:00Z"
  }
}
```

#### Get QR Code
```http
GET /api/whatsapp/sessions/{companyId}/qr
```

**Response:**
```json
{
  "success": true,
  "data": {
    "qr": "2@AHR0cHM6Ly93ZWIud2hhdHNhcHAu...",
    "attempts": 1
  }
}
```

#### Request Pairing Code
```http
POST /api/whatsapp/sessions/{companyId}/pairing-code
Content-Type: application/json

{
  "phoneNumber": "79001234567"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "code": "ABCD-EFGH",
    "expiresIn": 60,
    "phoneNumber": "79001234567"
  }
}
```

#### Initialize Company Session
```http
POST /api/whatsapp/sessions/{companyId}/initialize
Content-Type: application/json

{
  "usePairingCode": true,
  "phoneNumber": "79001234567"
}
```

#### Disconnect Session
```http
POST /api/whatsapp/sessions/{companyId}/disconnect
```

#### Get All Sessions
```http
GET /api/whatsapp/sessions
```

**Response:**
```json
{
  "success": true,
  "data": {
    "962302": {
      "connected": true,
      "status": "connected"
    },
    "123456": {
      "connected": false,
      "status": "disconnected"
    }
  },
  "summary": {
    "total": 2,
    "connected": 1
  }
}
```

#### Health Check
```http
GET /api/whatsapp/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "initialized": true,
    "provider": "baileys",
    "defaultCompany": "962302",
    "totalSessions": 5,
    "connectedSessions": 4,
    "uptime": 86400,
    "memoryUsage": "120MB"
  }
}
```

#### Diagnose Issues
```http
POST /api/whatsapp/diagnose
Content-Type: application/json

{
  "phone": "79001234567",
  "companyId": "962302"
}
```

---

## 🏢 Multi-Tenant System

### Overview
Each company has completely isolated WhatsApp session with its own:
- Authentication state
- Message history
- Rate limits
- Configuration
- Health monitoring

### Company Isolation

```javascript
// Each company has isolated session
await whatsappManager.initializeCompany('company-123', {
  name: 'Beauty Salon',
  phone: '79001234567',
  config: {
    greetingMessage: 'Welcome to Beauty Salon!',
    workingHours: '9:00-18:00'
  }
});

// Send message for specific company
await whatsappManager.sendMessage('79001234567', 'Hello!', {
  companyId: 'company-123'
});
```

### Database Schema

```sql
-- Companies table
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  company_id VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255),
  whatsapp_enabled BOOLEAN DEFAULT false,
  whatsapp_phone VARCHAR(20),
  whatsapp_status VARCHAR(50),
  whatsapp_config JSONB,
  whatsapp_last_connected TIMESTAMP,
  whatsapp_connection_method VARCHAR(20)
);

-- Sessions tracking
CREATE TABLE whatsapp_sessions (
  id SERIAL PRIMARY KEY,
  company_id VARCHAR(50) NOT NULL,
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Message history
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  company_id VARCHAR(50) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  message TEXT,
  message_id VARCHAR(100),
  direction VARCHAR(10), -- incoming/outgoing
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🚨 Error Handling

### Error Classes Hierarchy

```javascript
WhatsAppError (Base)
├── ConnectionError       // Network/connection issues
├── AuthenticationError   // Auth/login failures
├── SessionError         // Session management issues
├── RateLimitError      // Rate limiting
├── MessageSendError    // Message sending failures
├── ValidationError     // Input validation
├── ConfigurationError  // Config issues
├── TimeoutError       // Operation timeouts
├── ProviderError      // Provider-specific errors
├── DatabaseError      // Database operations
├── QRCodeError        // QR code issues
└── PairingCodeError   // Pairing code issues
```

### Error Handling Example

```javascript
const { ErrorHandler, MessageSendError } = require('./utils/whatsapp-errors');

try {
  await whatsappManager.sendMessage(phone, message);
} catch (error) {
  const standardError = ErrorHandler.standardize(error);

  if (standardError.isRetryable) {
    // Retry with exponential backoff
    await ErrorHandler.retry(
      () => whatsappManager.sendMessage(phone, message),
      { maxAttempts: 3 }
    );
  } else {
    // Log and return error
    ErrorHandler.log(standardError, logger);
    return ErrorHandler.toResponse(standardError);
  }
}
```

### API Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "MESSAGE_SEND_ERROR",
    "message": "Failed to send message: Session not connected",
    "details": {
      "phone": "79001234567",
      "companyId": "962302"
    },
    "isRetryable": true,
    "retryAfter": 60
  }
}
```

---

## 🔐 Authentication Methods

### QR Code Method

```javascript
// 1. Get QR code
const qr = await whatsappManager.getQRCode('company-123');

// 2. Display QR (terminal or web)
qrcode.generate(qr, { small: true });

// 3. User scans with WhatsApp mobile app
// 4. Session automatically connects
```

### Pairing Code Method

```javascript
// 1. Request pairing code
const result = await whatsappManager.requestPairingCode(
  'company-123',
  '79001234567'
);

console.log(`Pairing code: ${result.code}`); // ABCD-EFGH

// 2. User enters code in WhatsApp:
//    Settings → Linked Devices → Link with phone number
// 3. Session automatically connects
```

### When to Use Each Method

| Scenario | Recommended Method | Reason |
|----------|-------------------|---------|
| First setup | QR Code | Simpler for users |
| "Linking devices blocked" error | Pairing Code | Bypasses restriction |
| After 3 failed QR attempts | Pairing Code | Automatic fallback |
| Automated setup | Pairing Code | No camera needed |
| Remote setup | Pairing Code | Phone number only |

---

## 📊 Monitoring & Health

### Health Check System

```javascript
// Automatic health checks every 30 seconds
const health = await whatsappManager.checkHealth();
/*
{
  initialized: true,
  provider: 'baileys',
  sessions: {
    '962302': { connected: true, uptime: 86400 }
  },
  totalSessions: 5,
  connectedSessions: 4,
  metrics: {
    messagesSent: 1250,
    messagesReceived: 890,
    averageResponseTime: 120
  }
}
*/
```

### Monitoring Endpoints

```bash
# Real-time monitoring dashboard
curl http://localhost:3000/api/whatsapp/health

# Session metrics
curl http://localhost:3000/api/whatsapp/sessions/962302/metrics

# System diagnostics
curl -X POST http://localhost:3000/api/whatsapp/diagnose \
  -H "Content-Type: application/json" \
  -d '{"phone": "79001234567"}'
```

### Monitoring Scripts

```bash
# Health check script
node scripts/whatsapp-health-check.js

# Monitor with auto-recovery
node scripts/whatsapp-monitor-improved.js

# Session cleanup
node scripts/whatsapp-smart-cleanup.js
```

### Metrics to Monitor

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Session Uptime | >99% | 95-99% | <95% |
| Message Success Rate | >98% | 95-98% | <95% |
| Response Time | <200ms | 200-500ms | >500ms |
| Memory Usage | <100MB | 100-150MB | >150MB |
| QR Attempts | 1-2 | 3 | >3 |
| Reconnect Attempts | 0-2 | 3-5 | >5 |

---

## 🔧 Troubleshooting

### Common Issues & Solutions

#### 1. "Linking new devices is not possible right now"

**Cause:** WhatsApp rate limiting after too many QR scans

**Solution:**
```javascript
// Use pairing code instead
await whatsappManager.requestPairingCode('company-123', '79001234567');
```

Or wait 30-60 minutes before trying again.

#### 2. Session Keeps Disconnecting

**Cause:** Network issues or expired authentication

**Diagnosis:**
```bash
# Check logs
pm2 logs ai-admin-api --lines 100 | grep "disconnect"

# Check session status
curl http://localhost:3000/api/whatsapp/sessions/962302/status
```

**Solution:**
```javascript
// Force reconnect with new auth
await whatsappManager.deleteSession('company-123');
await whatsappManager.initializeCompany('company-123');
```

#### 3. Messages Not Sending

**Diagnosis:**
```javascript
const diagnosis = await whatsappManager.diagnoseProblem(
  '79001234567',
  'company-123'
);
console.log(diagnosis);
```

**Common Solutions:**
- Check session is connected
- Verify phone number format
- Check rate limits
- Ensure recipient has WhatsApp

#### 4. High Memory Usage

**Cause:** No cleanup of old data

**Solution:** Already fixed with TTLMap, but can force cleanup:
```javascript
// Manual cleanup
whatsappManager.provider.sessions.cleanup();
whatsappManager.provider.qrCodes.cleanup();
```

#### 5. QR Code Not Generating

**Check:**
```bash
# Check auth folder permissions
ls -la sessions/company_962302/

# Check for stale sessions
rm -rf sessions/company_962302/
```

#### 6. Database Errors

**Check Supabase connection:**
```javascript
const { supabase } = require('./src/database/supabase');
const { data, error } = await supabase
  .from('companies')
  .select('*')
  .limit(1);
```

### Debug Mode

Enable debug logging:
```bash
DEBUG=whatsapp:* npm start
```

### Recovery Procedures

#### Full System Reset
```bash
# 1. Stop all processes
pm2 stop all

# 2. Clear Redis
redis-cli FLUSHDB

# 3. Clear sessions
rm -rf sessions/*

# 4. Restart
pm2 restart all
```

#### Single Company Reset
```javascript
// Clear specific company
await whatsappManager.deleteSession('company-123');
await redisClient.del(`whatsapp:*:company-123`);
rm -rf sessions/company_123/
```

---

## 🔄 Migration Guide

### From Old Architecture to New

#### Old Code (4 layers):
```javascript
const clientFactory = require('./client-factory');
const client = clientFactory.getClient();
await client.initialize();
await client.sendMessage(phone, message);
```

#### New Code (3 layers):
```javascript
const whatsappManager = require('./whatsapp-manager');
await whatsappManager.initialize();
await whatsappManager.sendMessage(phone, message);
```

### Database Migrations

```bash
# Run migrations
psql $DATABASE_URL < migrations/add-whatsapp-pairing-tables.sql
```

### Environment Variable Changes

```bash
# Old
WHATSAPP_USE_BAILEYS=true
WHATSAPP_SESSION_NAME=default

# New
WHATSAPP_PROVIDER=baileys
USE_PAIRING_CODE=false
```

### Breaking Changes

1. **Session Pool**: Now using single improved version
2. **Error Format**: Standardized error objects
3. **TTL Maps**: Auto-cleanup enabled by default
4. **Provider Selection**: Now in config, not runtime

---

## 👨‍💻 Developer Guide

### Project Setup

```bash
# Clone repository
git clone https://github.com/company/ai-admin-v2
cd ai-admin-v2

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env

# Run migrations
npm run migrate

# Start development
npm run dev
```

### Code Style

```javascript
// Use async/await
async function sendMessage(phone, text) {
  try {
    // Validate input
    if (!phone || !text) {
      throw new ValidationError('Missing required fields');
    }

    // Send message
    const result = await whatsappManager.sendMessage(phone, text);

    // Log success
    logger.info(`Message sent to ${phone}`);

    return result;
  } catch (error) {
    // Handle error with standard handler
    throw ErrorHandler.standardize(error);
  }
}
```

### Testing

```bash
# Run all tests
npm test

# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Test specific company
node scripts/test-whatsapp.js --company=962302
```

### Adding New Features

1. **New API Endpoint**
```javascript
// src/api/routes/whatsapp-custom.js
router.post('/custom-feature',
  validateRequest(schema),
  asyncHandler(async (req, res) => {
    // Implementation
  })
);
```

2. **New Provider Method**
```javascript
// src/integrations/whatsapp/providers/baileys-provider.js
async customMethod(companyId, params) {
  const socket = this.sessions.get(companyId);
  // Implementation
}
```

3. **New Error Type**
```javascript
// src/utils/whatsapp-errors.js
class CustomError extends WhatsAppError {
  constructor(message, details) {
    super(message, 'CUSTOM_ERROR', details);
    this.name = 'CustomError';
  }
}
```

### Debugging Tips

```javascript
// Enable verbose logging
const logger = require('./utils/logger');
logger.level = 'debug';

// Trace function calls
console.trace('Function called from:');

// Inspect objects
console.dir(object, { depth: null });

// Monitor memory
console.log(process.memoryUsage());
```

---

## ⚡ Performance Optimization

### Current Performance Metrics

| Metric | Value | Target |
|--------|-------|--------|
| Message Send Time | 100-200ms | <200ms |
| Session Init Time | 3-5s | <5s |
| Memory per Session | 15MB | <20MB |
| CPU per Session | 0.5% | <1% |
| Max Concurrent Sessions | 1000 | 10000 |

### Optimization Techniques

1. **TTL Maps** - Automatic memory cleanup
```javascript
// Already implemented
this.sessions = new TTLMap(3600000, 60000);
```

2. **Connection Pooling**
```javascript
// Redis connection pool
const Redis = require('ioredis');
const redis = new Redis({
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false
});
```

3. **Message Batching**
```javascript
// Batch multiple messages
const messages = [
  { phone: '79001', text: 'Hello' },
  { phone: '79002', text: 'Hi' }
];
await Promise.all(messages.map(m =>
  whatsappManager.sendMessage(m.phone, m.text)
));
```

4. **Caching**
```javascript
// Cache frequently accessed data
const cache = new NodeCache({ stdTTL: 600 });
cache.set('company-962302', companyData);
```

### Scaling Strategies

1. **Horizontal Scaling**
```javascript
// Multiple worker processes
pm2 start ecosystem.config.js -i max
```

2. **Load Balancing**
```nginx
upstream whatsapp {
  server 127.0.0.1:3000;
  server 127.0.0.1:3001;
  server 127.0.0.1:3002;
}
```

3. **Redis Clustering**
```javascript
const Redis = require('ioredis');
const cluster = new Redis.Cluster([
  { host: 'redis1', port: 6379 },
  { host: 'redis2', port: 6379 }
]);
```

---

## 🔒 Security

### Security Measures

1. **HMAC Webhook Validation**
```javascript
const crypto = require('crypto');
function validateWebhook(req) {
  const signature = req.headers['x-signature'];
  const hash = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');
  return signature === hash;
}
```

2. **Rate Limiting**
```javascript
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 60000,
  max: 30
});
app.use('/api/whatsapp', limiter);
```

3. **Input Validation**
```javascript
const Joi = require('joi');
const schema = Joi.object({
  phone: Joi.string().pattern(/^\d{10,15}$/),
  message: Joi.string().max(4096)
});
```

4. **Encryption**
```javascript
// Session data encryption
const crypto = require('crypto');
const algorithm = 'aes-256-gcm';
```

### Security Checklist

- [ ] Enable HTTPS only
- [ ] Use environment variables for secrets
- [ ] Implement rate limiting
- [ ] Validate all inputs
- [ ] Sanitize phone numbers
- [ ] Encrypt session data
- [ ] Regular security audits
- [ ] Monitor for anomalies
- [ ] Implement access control
- [ ] Keep dependencies updated

---

## 🚀 Deployment

### Production Setup

```bash
# 1. Server preparation
sudo apt update
sudo apt install -y nodejs npm redis postgresql nginx

# 2. Clone and setup
git clone https://github.com/company/ai-admin-v2
cd ai-admin-v2
npm ci --production

# 3. Environment configuration
cp .env.production .env
# Edit with production values

# 4. Database setup
psql $DATABASE_URL < migrations/schema.sql

# 5. PM2 setup
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 6. Nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/whatsapp
sudo ln -s /etc/nginx/sites-available/whatsapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'whatsapp-api',
    script: 'src/api/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    max_memory_restart: '300M',
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }, {
    name: 'whatsapp-monitor',
    script: 'scripts/whatsapp-monitor-improved.js',
    instances: 1,
    cron_restart: '0 */6 * * *'
  }]
};
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "src/api/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  whatsapp:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:6-alpine
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

### Monitoring Setup

```bash
# Prometheus metrics
npm install prom-client

# Grafana dashboard
docker run -d -p 3001:3000 grafana/grafana

# Setup alerts
pm2 install pm2-slack
pm2 set pm2-slack:slack_url https://hooks.slack.com/...
```

---

## 📝 Appendix

### File Structure
```
ai-admin-v2/
├── src/
│   ├── integrations/whatsapp/   # WhatsApp integration
│   ├── services/whatsapp/       # WhatsApp services
│   ├── api/                     # API routes
│   ├── utils/                   # Utilities
│   └── middlewares/             # Express middlewares
├── scripts/                     # Management scripts
├── migrations/                  # Database migrations
├── docs/                        # Documentation
├── tests/                       # Test files
└── sessions/                    # WhatsApp sessions (gitignored)
```

### Important Files

| File | Purpose |
|------|---------|
| `whatsapp-manager.js` | Main public API |
| `session-manager.js` | Multi-tenant sessions |
| `baileys-provider.js` | Protocol implementation |
| `whatsapp-errors.js` | Error classes |
| `ttl-map.js` | Auto-cleanup utility |
| `health-monitor.js` | Health monitoring |
| `pairing-code-manager.js` | Pairing codes |

### Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `WHATSAPP_PROVIDER` | baileys | Provider selection |
| `USE_PAIRING_CODE` | false | Use pairing instead of QR |
| `HEALTH_CHECK_INTERVAL` | 30000 | Health check interval |
| `MAX_RECONNECT_ATTEMPTS` | 10 | Max reconnect tries |
| `SESSION_TTL` | 3600000 | Session lifetime |
| `RATE_LIMIT_WINDOW` | 60000 | Rate limit window |

### Useful Commands

```bash
# Check status
pm2 status

# View logs
pm2 logs whatsapp-api --lines 100

# Restart service
pm2 restart whatsapp-api

# Monitor
pm2 monit

# Backup sessions
tar -czf sessions-backup.tar.gz sessions/

# Clear Redis
redis-cli FLUSHDB

# Test connection
curl http://localhost:3000/api/whatsapp/health
```

---

## 📚 Related Documentation

- [WhatsApp System Analysis Report](./WHATSAPP_SYSTEM_ANALYSIS_REPORT.md)
- [Multi-tenant Architecture](./WHATSAPP_MULTITENANT_ARCHITECTURE.md)
- [Pairing Code Solution](./WHATSAPP_PAIRING_CODE_SOLUTION.md)
- [Simplified Architecture](./WHATSAPP_SIMPLIFIED_ARCHITECTURE.md)
- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys)

---

## 🆘 Support

For issues and questions:
- GitHub Issues: [github.com/company/ai-admin-v2/issues](https://github.com/company/ai-admin-v2/issues)
- Email: support@company.com
- Slack: #whatsapp-support

---

*Last updated: 2025-09-19*
*Version: 2.0.0*
*Status: Production Ready*