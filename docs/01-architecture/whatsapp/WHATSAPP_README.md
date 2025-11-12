# 🤖 WhatsApp Integration System

> Production-ready, multi-tenant WhatsApp integration for AI Admin v2

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/company/ai-admin-v2)
[![Status](https://img.shields.io/badge/status-production-green.svg)](https://github.com/company/ai-admin-v2)
[![Architecture](https://img.shields.io/badge/architecture-3--layer-orange.svg)](./WHATSAPP_SIMPLIFIED_ARCHITECTURE.md)
[![Sessions](https://img.shields.io/badge/sessions-10k+-purple.svg)](./WHATSAPP_MULTITENANT_ARCHITECTURE.md)

## 🌟 Features

- **🏢 Multi-tenant**: Supports 10,000+ isolated company sessions
- **🔐 Dual Auth**: QR Code and Pairing Code methods
- **♻️ Auto-recovery**: Automatic reconnection with exponential backoff
- **💾 Smart Memory**: TTL-based automatic cleanup
- **🚨 Error Handling**: Standardized error classes and recovery
- **📊 Monitoring**: Real-time health checks and diagnostics
- **⚡ Performance**: 100-200ms message delivery

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [📚 Complete Documentation](./WHATSAPP_COMPLETE_DOCUMENTATION.md) | Full system documentation |
| [🏗️ Architecture](./WHATSAPP_SIMPLIFIED_ARCHITECTURE.md) | 3-layer architecture design |
| [🏢 Multi-tenant](./WHATSAPP_MULTITENANT_ARCHITECTURE.md) | Multi-company isolation |
| [🔐 Pairing Code](./WHATSAPP_PAIRING_CODE_SOLUTION.md) | Authentication methods |
| [📊 System Analysis](./WHATSAPP_SYSTEM_ANALYSIS_REPORT.md) | Performance analysis |
| [📡 API Documentation](./whatsapp-api-openapi.yaml) | OpenAPI specification |

## 🚀 Quick Start

### Installation

```bash
# Clone repository
git clone https://github.com/company/ai-admin-v2
cd ai-admin-v2

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run migrations
npm run migrate

# Start development
npm run dev
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
```

### Multi-tenant Usage

```javascript
// Initialize company
await whatsappManager.initializeCompany('company-123');

// Send for specific company
await whatsappManager.sendMessage('79001234567', 'Hello!', {
  companyId: 'company-123'
});
```

## 🔧 Configuration

### Required Environment Variables

```bash
# WhatsApp
WHATSAPP_PROVIDER=baileys
USE_PAIRING_CODE=false
YCLIENTS_COMPANY_ID=962302

# Database
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your-key
REDIS_URL=redis://localhost:6379

# Monitoring
HEALTH_CHECK_INTERVAL=30000
MAX_RECONNECT_ATTEMPTS=10
```

## 📡 API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/whatsapp/send` | Send text message |
| POST | `/api/whatsapp/send-media` | Send media |
| GET | `/api/whatsapp/sessions/{id}/status` | Session status |
| POST | `/api/whatsapp/sessions/{id}/initialize` | Init session |
| GET | `/api/whatsapp/sessions/{id}/qr` | Get QR code |
| POST | `/api/whatsapp/sessions/{id}/pairing-code` | Get pairing code |
| GET | `/api/whatsapp/health` | Health check |

[Full API Documentation →](./whatsapp-api-openapi.yaml)

## 🏗️ Architecture

### Simplified 3-Layer Architecture

```
┌────────────────────┐
│  WhatsApp Manager  │ ← Public API
├────────────────────┤
│  Session Manager   │ ← Business Logic
├────────────────────┤
│  Baileys Provider  │ ← Protocol
└────────────────────┘
```

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **WhatsApp Manager** | Public API interface | `/src/integrations/whatsapp/whatsapp-manager.js` |
| **Session Manager** | Multi-tenant sessions | `/src/integrations/whatsapp/session-manager.js` |
| **Baileys Provider** | WhatsApp protocol | `/src/integrations/whatsapp/providers/baileys-provider.js` |
| **Error Handler** | Standardized errors | `/src/utils/whatsapp-errors.js` |
| **TTL Map** | Auto-cleanup | `/src/utils/ttl-map.js` |

## 🚨 Error Handling

### Error Classes

```javascript
try {
  await whatsappManager.sendMessage(phone, message);
} catch (error) {
  if (error instanceof RateLimitError) {
    // Wait and retry
    await sleep(error.retryAfter * 1000);
  } else if (error instanceof SessionError) {
    // Reinitialize session
    await whatsappManager.initializeCompany(companyId);
  } else {
    // Handle other errors
    console.error(error);
  }
}
```

### Available Error Classes

- `WhatsAppError` - Base error class
- `ConnectionError` - Network issues
- `AuthenticationError` - Auth failures
- `SessionError` - Session issues
- `RateLimitError` - Rate limiting
- `MessageSendError` - Send failures
- `ValidationError` - Input validation
- `TimeoutError` - Timeouts

## 🔐 Authentication Methods

### QR Code (Default)

```javascript
const qr = await whatsappManager.getQRCode('company-123');
// Display QR for scanning
```

### Pairing Code (Alternative)

```javascript
const result = await whatsappManager.requestPairingCode(
  'company-123',
  '79001234567'
);
console.log(`Code: ${result.code}`); // ABCD-EFGH
```

## 📊 Monitoring

### Health Check

```javascript
const health = await whatsappManager.checkHealth();
console.log(`Connected: ${health.connectedSessions}/${health.totalSessions}`);
```

### Diagnostics

```javascript
const diagnosis = await whatsappManager.diagnoseProblem('79001234567');
if (diagnosis.problem) {
  console.log(`Issue: ${diagnosis.problem}`);
  console.log(`Solution: ${diagnosis.solution}`);
}
```

## 🔧 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Linking devices blocked" | Use pairing code method |
| Session disconnects | Check logs, reinitialize |
| Messages not sending | Run diagnostics |
| High memory usage | Already fixed with TTL |

[Full Troubleshooting Guide →](./WHATSAPP_COMPLETE_DOCUMENTATION.md#troubleshooting)

## 📈 Performance

| Metric | Current | Target |
|--------|---------|--------|
| Message Send | 100-200ms | <200ms |
| Session Init | 3-5s | <5s |
| Memory/Session | 15MB | <20MB |
| Uptime | 96% | 99%+ |

## 🚀 Production Deployment

```bash
# PM2 deployment
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Docker deployment
docker-compose up -d

# Health check
curl http://localhost:3000/api/whatsapp/health
```

[Full Deployment Guide →](./WHATSAPP_COMPLETE_DOCUMENTATION.md#deployment)

## 📝 Recent Updates

### v2.0.0 (2025-09-19)
- ✅ Simplified architecture from 4 to 3 layers
- ✅ Added TTL-based memory management
- ✅ Standardized error handling
- ✅ Implemented pairing code support
- ✅ Fixed Supabase integration
- ✅ Resolved duplicate dependencies

[View Changelog →](../CHANGELOG.md)

## 🧪 Testing

```bash
# Run all tests
npm test

# Test specific company
node scripts/test-whatsapp.js --company=962302

# Test pairing code
node scripts/whatsapp-pairing-auth.js 962302
```

## 📚 Resources

- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [API Reference](./whatsapp-api-openapi.yaml)
- [Support](https://github.com/company/ai-admin-v2/issues)

## 👥 Contributors

- AI Admin Team
- Baileys Community
- Open Source Contributors

## 📄 License

MIT License - See [LICENSE](../LICENSE) for details

---

<div align="center">

**[Documentation](./WHATSAPP_COMPLETE_DOCUMENTATION.md)** •
**[API](./whatsapp-api-openapi.yaml)** •
**[Architecture](./WHATSAPP_SIMPLIFIED_ARCHITECTURE.md)** •
**[Issues](https://github.com/company/ai-admin-v2/issues)**

</div>