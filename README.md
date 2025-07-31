# AI Admin v2 🤖

**Production-ready WhatsApp AI Assistant for Beauty Salons**

[![MVP Status](https://img.shields.io/badge/MVP-Production%20Ready-green)](https://github.com/your-repo/ai_admin_v2)
[![Architecture](https://img.shields.io/badge/Architecture-AI--First-blue)](https://github.com/your-repo/ai_admin_v2)
[![Performance](https://img.shields.io/badge/Performance-Optimized-brightgreen)](https://github.com/your-repo/ai_admin_v2)
[![Pilot](https://img.shields.io/badge/Pilot-Live%20Since%2025.07.2025-success)](https://github.com/your-repo/ai_admin_v2)

## 🎯 Overview

AI Admin v2 is a next-generation WhatsApp booking assistant designed for beauty salons. Built with **AI-First architecture** and **Smart Caching**, it handles client bookings, provides intelligent suggestions, and offers proactive customer service through WhatsApp integration.

### ✨ Key Features

- 🤖 **AI-First Processing**: Dynamic service/staff resolution without hardcoding
- ⚡ **Automatic Booking**: Creates bookings instantly when time & service specified
- 🚀 **Smart Caching**: Redis-based context caching with 12-hour TTL
- 🔥 **Rapid-Fire Protection**: Redis-based message batching (10s window)
- 💡 **Proactive Suggestions**: Never says "unavailable" without alternatives
- 📊 **Performance Monitoring**: Real-time metrics and health checks
- 🌐 **Multi-Tenant Ready**: Scalable to 10,000+ companies
- 🔒 **Production Security**: Rate limiting, authentication, data validation
- ⏰ **Automatic Reminders**: Two-tier reminder system (day before + 2 hours before)
- 🔔 **Booking Monitor**: Auto-notifies clients when admin creates bookings

### 🎯 AI Commands (v2)

- `[SEARCH_SLOTS]` - Intelligent slot search with automatic time/service parsing
- `[CREATE_BOOKING]` - Direct booking creation with validation
- `[SHOW_PRICES]` - Dynamic price list with category filtering
- `[SAVE_CLIENT_NAME]` - Automatic client name recognition
- `[CANCEL_BOOKING]` - ✅ Booking cancellation (soft delete via attendance status)
- `[RESCHEDULE_BOOKING]` - ✅ Booking rescheduling with dual-method fallback
- `[CHECK_STAFF_SCHEDULE]` - ✅ Silent staff availability check

## 📁 Project Structure

```
ai_admin_v2/
├── src/                    # Source code
│   ├── api/               # REST API endpoints & webhooks
│   ├── config/            # Configuration (business types, settings)
│   ├── database/          # Database clients (Supabase, Redis)
│   ├── integrations/      # External integrations (WhatsApp, YClients)
│   ├── queue/             # Message queue management (BullMQ)
│   ├── services/          # Core services
│   │   ├── ai-admin-v2/   # Main AI service
│   │   ├── booking/       # Booking operations
│   │   └── context/       # Context management
│   └── workers/           # Background workers
├── docs/                  # Documentation
│   ├── development-diary/ # Daily development logs
│   ├── features/          # Feature documentation
│   ├── guides/            # Setup and usage guides
│   └── sessions/          # Session summaries
├── scripts/               # Utility scripts
│   ├── database/          # Database management
│   └── deployment/        # Deployment scripts
├── tests/                 # Test suites
│   ├── manual/            # Manual test scripts
│   │   ├── booking/       # Booking related tests
│   │   ├── context/       # Context management tests
│   │   ├── redis/         # Redis and batching tests
│   │   ├── whatsapp/      # WhatsApp integration tests
│   │   ├── yclients/      # YClients API tests
│   │   └── misc/          # Other test scripts
│   └── integration/       # Integration tests
├── mcp/                   # MCP servers for testing
├── examples/              # Code examples and patterns
├── legacy/                # Legacy v1 code (archived)
└── public/                # Static files
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Redis server
- PostgreSQL (via Supabase)
- YClients API access
- WhatsApp Business API or Venom Bot

### Installation

```bash
# Clone repository
git clone https://github.com/your-repo/ai_admin_v2.git
cd ai_admin_v2

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development
npm run dev
```

### Key Scripts

```bash
npm run dev              # Start development server
npm run worker:v2        # Start v2 workers
npm test                 # Run tests
npm run monitor          # Real-time monitoring
./start-work.sh          # Quick project status
```

## 🔧 Configuration

### Environment Variables

```bash
# AI Configuration
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_key
DEEPSEEK_MODEL=deepseek-chat

# Database
SUPABASE_URL=your_url
SUPABASE_KEY=your_key
REDIS_URL=redis://localhost:6379

# YClients Integration
YCLIENTS_API_KEY=your_key
YCLIENTS_PARTNER_ID=8444
YCLIENTS_COMPANY_ID=962302

# WhatsApp
WHATSAPP_PROVIDER=venom
SECRET_KEY=your_hmac_key
```

### Business Types

Configure in `src/config/business-types.js`:
- barbershop
- nails
- massage
- epilation
- brows
- beauty

## 📊 Performance

- **Message throughput**: 100-200 msg/min (3 workers)
- **Response time**: 2-5 seconds average
- **Cache hit rate**: >70%
- **Memory usage**: <150MB per worker
- **Error rate**: <2%

## 🔐 Security

- HMAC-SHA256 webhook authentication
- Rate limiting (30 req/min per phone)
- Input validation and sanitization
- Secrets encryption (AES-256-GCM)
- Company-based data isolation

## 📚 Documentation

- [CLAUDE.md](CLAUDE.md) - AI assistant instructions
- [PLANNING.md](PLANNING.md) - Architecture overview
- [TASK.md](TASK.md) - Current tasks and progress
- [docs/guides/](docs/guides/) - Setup and deployment guides
- [docs/features/](docs/features/) - Feature documentation

## 🤝 Contributing

1. Read [CLAUDE.md](CLAUDE.md) for development guidelines
2. Check [TASK.md](TASK.md) for current priorities
3. Follow existing code patterns
4. Write tests for new features
5. Update documentation

## 📈 Status

- **Production**: Live pilot since July 25, 2025
- **Architecture**: v2 (AI-First)
- **Current Phase**: Phase 3 - Edge cases & reliability
- **Next**: Phase 4 - Advanced features

## 📜 License

Proprietary - All rights reserved