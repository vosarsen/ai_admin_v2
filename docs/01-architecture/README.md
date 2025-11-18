# Architecture Documentation

Comprehensive technical architecture documentation for AI Admin v2.

## Overview

This section contains all architectural decisions, system design documents, and technical specifications for the AI Admin v2 WhatsApp bot system. The documentation is organized into logical subsystems for easy navigation.

## Directory Structure

### [ai-system/](ai-system/)
**31 files** - AI provider integrations and decision-making system
- **AI Providers**: Gemini, QWEN, DeepSeek configurations and comparisons
- **YClients API**: Integration specs, marketplace documentation
- **Optimization**: Batching, two-stage processing, universal prompts
- **Key Files**:
  - `GEMINI_INTEGRATION_GUIDE.md` - Current primary AI provider
  - `TWO_STAGE_PROCESSING_ARCHITECTURE.md` - Performance optimization
  - `UNIVERSAL_PROMPT_SYSTEM.md` - Prompt management architecture
  - `Request_API_YC.md` - YClients API reference

### [database/](database/)
**10 files** - Database architecture and migration documentation
- **PostgreSQL**: Timeweb hosting, migration from Supabase
- **Repository Pattern**: Data access layer implementation
- **Connection Management**: Pool optimization, SSL configuration
- **Key Files**:
  - `TIMEWEB_POSTGRES_SUMMARY.md` - Current database setup
  - `REPOSITORY_PATTERN.md` - Data access architecture
  - `CONNECTION_POOL_OPTIMIZATION.md` - Performance tuning

### [infrastructure/](infrastructure/)
**3 files** - Infrastructure decisions and cloud provider research
- **Yandex Cloud Research**: Functions vs VPS cost/architecture analysis
- **Current Setup**: Timeweb VPS configuration and justification
- **Key Files**:
  - `YANDEX_CLOUD_FUNCTIONS_RESEARCH.md` - Comprehensive 11-page analysis
  - `YANDEX_CLOUD_QUICK_DECISION.md` - TL;DR: Stay on VPS
  - **Decision**: Do NOT migrate to serverless (8.5x more expensive, architectural incompatibility)

### [features/](features/)
**21 files** - Feature-specific architecture documentation
- **Booking System**: Scheduling, reminders, conflict resolution
- **Service Management**: Descriptions, categories, smart sorting
- **Client Management**: History tracking, preferences
- **Key Files**:
  - `BOOKING_MONITOR_ARCHITECTURE.md` - Automated reminder system
  - `SERVICE_DESCRIPTIONS_FEATURE.md` - Contextual service info
  - `CLIENT_HISTORY_TRACKING.md` - Client interaction history

### [system-overview/](system-overview/)
**18 files** - Core system architecture and integrations
- **Context System**: V2 conversation management
- **Sync System**: YClients data synchronization
- **Message Queue**: BullMQ architecture
- **Key Files**:
  - `CONTEXT_SYSTEM_V2.md` - Current context management (NOTE: This is the active version)
  - `SYNC_SYSTEM_V2.md` - Data synchronization architecture
  - `REDIS_BATCHING.md` - Performance optimization
  - `MESSAGE_QUEUE_ARCHITECTURE.md` - BullMQ implementation

### [whatsapp/](whatsapp/)
**15 files** - WhatsApp integration architecture
- **Baileys Integration**: Connection management, session handling
- **Message Processing**: Media handling, formatting
- **Session Management**: Pool architecture, cleanup
- **Key Files**:
  - `BAILEYS_CONNECTION_MANAGER.md` - Connection lifecycle
  - `WHATSAPP_SESSION_POOL.md` - Session pooling strategy
  - `MEDIA_MESSAGE_ARCHITECTURE.md` - Media handling

## Architecture Principles

1. **Modularity**: Each component has clear boundaries and interfaces
2. **Scalability**: Designed for horizontal scaling via queue workers
3. **Reliability**: Comprehensive error handling and monitoring
4. **Performance**: Optimized for <10s response times
5. **Maintainability**: Clear separation of concerns, repository pattern

## Technology Stack

- **Runtime**: Node.js 20.x with TypeScript
- **AI Provider**: Google Gemini 2.5 Flash (via SOCKS5 proxy)
- **Database**: PostgreSQL 15 (Timeweb Cloud)
- **Cache**: Redis 7.x
- **Queue**: BullMQ
- **WhatsApp**: Baileys (WebSocket)
- **Monitoring**: Sentry, PM2

## Recent Changes

- **2025-11-18**: Infrastructure research: Evaluated Yandex Cloud Functions, decision to stay on VPS
- **2025-11-11**: Completed migration from Supabase to Timeweb PostgreSQL
- **2025-10-19**: Switched from DeepSeek to Gemini (2.6x performance improvement)
- **2025-10-23**: Implemented hybrid schedule synchronization
- **2025-10-28**: Fixed booking reschedule functionality

## Navigation Tips

1. Start with `system-overview/` for understanding the overall architecture
2. Dive into specific subsystems via their dedicated directories
3. Check `features/` for user-facing functionality details
4. Reference `database/` for data models and access patterns
5. Use `whatsapp/` for messaging integration specifics

---
*Last updated: 2025-11-18*