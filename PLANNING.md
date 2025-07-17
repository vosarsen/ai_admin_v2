# AI Admin v2 - Architecture & Planning

## 🎯 Project Overview

AI Admin v2 is a production-ready WhatsApp AI Assistant for beauty salons that uses a simplified AI-First architecture. It replaces a complex 5-6 step pipeline with a single AI call that handles all decision-making.

### Key Innovation
```
Old: Message → AI → NLU → EntityExtractor → ActionResolver → ResponseGenerator → Action
New: Message → AI Admin v2 (full context) → Actions → Response
```

## 🏗 Architecture

### Core Components

#### 1. Message Processing Layer
- **WhatsApp Integration** (`src/integrations/whatsapp/`)
  - Supports Venom Bot and WhatsApp Business API
  - Handles media, formatting, and message queuing
  
- **Message Queue** (`src/queue/`)
  - BullMQ for reliable message processing
  - Rapid-fire protection (ignores messages within 2 seconds)
  - 3 worker instances for parallel processing

#### 2. AI Core (v2)
- **AI Admin v2** (`src/services/ai-admin-v2/`)
  - Single unified AI service replacing the old pipeline
  - Command-based approach: `[SEARCH_SLOTS]`, `[CREATE_BOOKING]`, etc.
  - Business type detection and adaptation
  - 5-minute context caching for performance

#### 3. Data Layer
- **Supabase** (PostgreSQL)
  - Multi-tenant architecture (company_id based)
  - Real-time sync with YClients
  - MCP integration for direct access
  
- **Redis**
  - Conversation context (30-day expiration)
  - Message deduplication
  - Performance caching

#### 4. External Integrations
- **YClients API**
  - CRM system for beauty salons
  - Booking management
  - Client and service data
  
## 📁 Project Structure

```
ai_admin_v2/
├── src/
│   ├── api/                    # REST API endpoints
│   ├── config/                 # Configuration files
│   │   └── business-types.js   # Business terminology adaptation
│   ├── database/               # Database clients
│   ├── integrations/           
│   │   ├── whatsapp/          # WhatsApp integration
│   │   └── yclients/          # YClients CRM integration
│   ├── queue/                  # Message queue management
│   ├── services/
│   │   ├── ai-admin-v2/       # Main AI service (v2)
│   │   ├── ai-admin/          # Legacy AI service (v1)
│   │   ├── booking/           # Booking operations
│   │   └── context/           # Context management
│   └── workers/               # Background workers
├── scripts/                    # Utility scripts
├── tests/                      # Test suites
└── docs/                       # Documentation
```

## 🔄 Message Flow

1. **Incoming Message**
   - WhatsApp webhook → API endpoint
   - HMAC authentication
   - Queue for processing

2. **Context Loading** (Parallel)
   - Company data
   - Client history
   - Available services & staff
   - Current bookings
   - Business hours

3. **AI Processing**
   - Full context sent to AI
   - AI decides on commands
   - Commands extracted via regex

4. **Command Execution**
   - `[SEARCH_SLOTS]` → Find available time slots
   - `[CREATE_BOOKING]` → Create booking in YClients
   - `[SHOW_PRICES]` → Display service prices
   - etc.

5. **Response**
   - Format response for WhatsApp
   - Send via WhatsApp API
   - Update context in Redis

## 🎯 Design Principles

1. **AI-First**: Let AI make all decisions with full context
2. **Command-Based**: Clear, extractable commands in AI responses
3. **Business Adaptation**: Automatic terminology adjustment
4. **Performance**: Aggressive caching and parallel loading
5. **Reliability**: Queue-based processing with retries
6. **Multi-tenant**: Company isolation at all levels

## 📊 Performance Targets

- Message throughput: 100-200 msg/min (3 workers)
- Response time: 2-5 seconds average
- Cache hit rate: >70%
- Memory usage: <150MB per worker
- Error rate: <2%

## 🔐 Security

- HMAC-SHA256 webhook authentication
- Environment-based secrets
- Rate limiting per phone number
- Input sanitization
- Company-based data isolation

## 🚀 Deployment

- PM2 process management
- 3 worker instances
- Redis for state management
- Supabase for persistence
- Monitoring via custom dashboard

## 📈 Scaling Strategy

1. **Vertical**: Increase worker count
2. **Horizontal**: Redis clustering
3. **Database**: Read replicas
4. **Caching**: Local data replication