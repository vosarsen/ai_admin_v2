# AI Admin v2 🤖

**Production-ready WhatsApp AI Assistant for Beauty Salons**

[![MVP Status](https://img.shields.io/badge/MVP-Production%20Ready-green)](https://github.com/vosarsen/ai_admin_v2)
[![Architecture](https://img.shields.io/badge/Architecture-AI--First-blue)](https://github.com/vosarsen/ai_admin_v2)
[![Performance](https://img.shields.io/badge/Performance-Optimized-brightgreen)](https://github.com/vosarsen/ai_admin_v2)
[![Pilot](https://img.shields.io/badge/Pilot-Live%20Since%2007.2024-success)](https://github.com/vosarsen/ai_admin_v2)

## 🎯 Overview

AI Admin v2 is a next-generation WhatsApp booking assistant designed for beauty salons. Built with **AI-First architecture** and **Smart Caching**, it handles client bookings, provides intelligent suggestions, and offers proactive customer service through WhatsApp integration.

### ✨ Key Features

- 🤖 **AI-First Processing**: Dynamic service/staff resolution without hardcoding
- 🎭 **Client Personalization**: Personalized greetings based on visit history (1096 clients synced)
- ⚡ **Automatic Booking**: Creates bookings instantly when time & service specified
- 🚀 **Smart Context System**: Multi-level caching (Memory→Redis→DB) with atomic operations
- 🔥 **Rapid-Fire Protection**: Redis-based message batching (10s window)
- 💡 **Smart Recommendations**: Suggests favorite services and masters based on history
- 📊 **Performance Monitoring**: Real-time metrics with Prometheus integration
- 🌐 **Multi-Tenant Ready**: Scalable to 10,000+ companies
- 🔒 **Production Security**: Rate limiting, authentication, data validation
- ⏰ **Automatic Reminders**: Two-tier reminder system (day before + 2 hours before)
- 🔔 **Booking Monitor**: Auto-notifies clients when admin creates bookings
- 🏆 **Loyalty Program**: VIP status recognition with priority booking
- 🧠 **Context Memory**: Maintains conversation state across messages with smart date/time preservation

### 🎯 AI Commands (v2)

- `[SEARCH_SLOTS]` - Intelligent slot search with automatic time/service parsing
- `[CREATE_BOOKING]` - Direct booking creation with validation
- `[SHOW_PRICES]` - Dynamic price list with category filtering
- `[SAVE_CLIENT_NAME]` - Automatic client name recognition
- `[CANCEL_BOOKING]` - ✅ Booking cancellation (soft delete via attendance status)
- `[RESCHEDULE_BOOKING]` - ✅ Booking rescheduling with dual-method fallback
- `[CHECK_STAFF_SCHEDULE]` - ✅ Silent staff availability check

## 🧠 Context Management System

The v2 architecture includes a sophisticated context management system that maintains conversation state across messages:

- **Multi-Level Caching**: Memory (LRU) → Redis → Database
- **Atomic Operations**: Prevents race conditions and data overwrites
- **Smart Data Separation**: Different TTLs for dialog (2h), client (24h), preferences (30d)
- **Date/Time Preservation**: Correctly maintains temporal context between messages
- **Performance**: <10ms with cache hit, <100ms full load

[Learn more about context system →](docs/CONTEXT_SYSTEM.md)

## 🛍️ YClients Marketplace Integration

AI Admin v2 now features full integration with YClients Marketplace, allowing beauty salons to seamlessly connect their WhatsApp bot:

### ✨ Marketplace Features

- **🚀 Quick Setup**: One-click installation from YClients marketplace
- **📱 QR Code Connection**: Simple WhatsApp connection via web interface
- **🔄 Auto-Sync**: Automatic synchronization of services, staff, and bookings
- **🔐 Secure**: JWT authentication, rate limiting, validated data
- **📊 Real-time**: WebSocket updates for instant feedback
- **🌐 Multi-tenant**: Supports unlimited salons simultaneously

### 📚 Marketplace Documentation

- [**Integration Overview**](docs/marketplace/MARKETPLACE_INTEGRATION.md) - Complete integration guide
- [**Technical Documentation**](docs/marketplace/MARKETPLACE_TECHNICAL.md) - Technical implementation details
- [**Setup Guide**](docs/marketplace/MARKETPLACE_SETUP.md) - Step-by-step installation
- [**API Reference**](docs/marketplace/MARKETPLACE_API.md) - Complete API documentation
- [**Troubleshooting**](docs/marketplace/MARKETPLACE_TROUBLESHOOTING.md) - Problem solving guide

### 🔗 Quick Connect

Salons can connect their WhatsApp in 3 simple steps:
1. Install AI Admin from YClients marketplace
2. Scan QR code with WhatsApp
3. Start receiving bookings automatically!

**Production URL**: https://ai-admin.app/marketplace/

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
│   │   ├── context/       # Context management
│   │   └── marketplace/   # YClients Marketplace integration
│   └── workers/           # Background workers
├── docs/                  # Documentation (300+ files)
│   ├── development-diary/ # Daily development logs (150+ entries)
│   ├── marketplace/       # Marketplace integration docs
│   ├── features/          # Feature documentation
│   ├── technical/         # Technical documentation
│   ├── guides/            # Setup and usage guides
│   └── archive/           # Archived documentation
├── scripts/               # Utility scripts
├── tests/                 # Test suites
├── public/                # Static files & marketplace UI
│   └── marketplace/       # Marketplace web interface
├── mcp/                   # MCP servers for testing
├── examples/              # Code examples and patterns
├── config/                # Project configuration
├── archive/               # Archived code and documentation
│   ├── legacy-code/       # Old v1 implementation
│   ├── logs/              # Archived logs
│   └── old-tests/         # Archived test files
└── OFFER/                 # Business proposals
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Redis server
- PostgreSQL (via Supabase)
- YClients API access
- WhatsApp Business API or Venom Bot

## 🎭 Personalization System

AI Admin v2 includes a sophisticated personalization system that tailors conversations based on client history:

### Features:
- **Smart Greetings**: Different messages for new, regular, VIP, and returning clients
- **Service Recommendations**: Suggests favorite services based on history (>70% preference)
- **Master Preferences**: Remembers and suggests preferred staff members
- **Visit Analytics**: Tracks visit patterns, average bills, and loyalty levels
- **Special Offers**: Automatic milestone rewards and reactivation discounts

### Loyalty Levels:
- 🆕 **New**: 0-1 visits
- 🥉 **Bronze**: 2-4 visits
- 🥈 **Silver**: 5-9 visits
- 🥇 **Gold**: 10-19 visits
- 💎 **VIP**: 20+ visits

### Data Synchronization:
- Automatic sync with YClients twice daily (4:00 & 14:00 MSK)
- 1096 clients with complete visit history
- Safe incremental sync with API rate limiting
- 5-minute context caching for performance

[Learn more about personalization →](docs/PERSONALIZATION_IMPLEMENTATION.md)

### Installation

```bash
# Clone repository
git clone https://github.com/vosarsen/ai_admin_v2.git
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

### Core Documentation
- [CLAUDE.md](CLAUDE.md) - AI assistant instructions
- [CHANGELOG.md](CHANGELOG.md) - Version history
- [YCLIENTS_API.md](YCLIENTS_API.md) - YClients API reference

### Project Documentation
- [docs/README.md](docs/README.md) - Documentation index
- [docs/marketplace/](docs/marketplace/) - YClients Marketplace integration
- [docs/technical/](docs/technical/) - Technical documentation
- [docs/features/](docs/features/) - Feature documentation
- [docs/guides/](docs/guides/) - Setup and deployment guides
- [docs/development-diary/](docs/development-diary/) - Development history (150+ entries)

## 🤝 Contributing

1. Read [CLAUDE.md](CLAUDE.md) for development guidelines
2. Check [docs/development-diary/](docs/development-diary/) for recent changes
3. Follow existing code patterns in [examples/](examples/)
4. Write tests for new features in [tests/](tests/)
5. Update documentation in [docs/](docs/)

## 📈 Status

- **Production**: Live since July 2024
- **Architecture**: v2 (AI-First)
- **Latest Update**: September 16, 2024 - YClients Marketplace Integration
- **Documentation**: 300+ files, fully organized
- **Active Clients**: 1096+ synced

## 🔄 Recent Updates (September 2024)

- ✅ **YClients Marketplace Integration** - Full integration with marketplace
- ✅ **Documentation Reorganization** - 300+ docs organized into categories
- ✅ **WhatsApp Stability Fixes** - No more reconnections or duplicates
- ✅ **Context System v2** - Multi-level caching with atomic operations
- ✅ **Redis Batching** - Message batching for rapid-fire protection

## 📜 License

Proprietary - All rights reserved