# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔄 Project Awareness & Context

**IMPORTANT**: Before starting any work, ALWAYS:
1. Run `./start-work.sh` to get current project status
2. Read `config/project-docs/CONTEXT.md` for where we left off last time
3. Read `config/project-docs/PLANNING.md` to understand the project architecture and design principles
4. Check `config/project-docs/TASK.md` to see current tasks, completed work, and known issues
5. Review `config/project-docs/RECOMMENDATIONS.md` for improvement ideas
6. Check `docs/TROUBLESHOOTING.md` if encountering issues
7. Review relevant examples in `examples/` folder for established patterns
8. Check `config/project-docs/INITIAL.md` if working on a new feature request
9. Review `docs/development-diary/` for historical context and decisions

**AFTER completing any feature or significant work**:
- Create a development diary entry in `docs/development-diary/YYYY-MM-DD-feature-name.md`
- This helps maintain project history and share knowledge for future development

## 🔧 MCP Servers Usage (CRITICAL - USE THESE INSTEAD OF SSH/SCRIPTS)

**ALWAYS USE MCP SERVERS** for direct service access. These are faster and more reliable than SSH commands:

### Available MCP Servers:

1. **@logs** - Direct server logs access
   - Use for: Checking PM2 logs, searching errors, monitoring services
   - Example: `@logs logs_tail service:ai-admin-worker-v2 lines:50`
   - **REPLACES**: `ssh root@46.149.70.219 "pm2 logs ..."`

2. **@whatsapp** - WhatsApp testing
   - Use for: Sending test messages, checking bot responses, running scenarios
   - Example: `@whatsapp send_message phone:79001234567 message:"Привет! Хочу записаться"`
   - **REPLACES**: `node test-direct-webhook.js` and other test scripts

3. **@supabase** - Direct database access
   - Use for: Querying tables, checking data, database operations
   - Example: `@supabase query_table table:clients filters:{"phone":"79001234567"}`
   - **REPLACES**: SSH + psql commands or Supabase dashboard

4. **@yclients** - YClients API access
   - Use for: Getting services, checking slots, creating bookings
   - Example: `@yclients get_available_slots date:2025-07-29`
   - **REPLACES**: Curl commands to YClients API

5. **@redis** - Redis cache management
   - Use for: Checking/clearing context, testing conversation flow
   - Example: `@redis get_context phone:79001234567`
   - **REPLACES**: redis-cli commands
   - **REQUIRES**: SSH tunnel on port 6380 (run `./scripts/maintain-redis-tunnel.sh start`)

### When to Use MCP:
- **ALWAYS** for checking logs - use @logs instead of SSH
- **ALWAYS** for database queries - use @supabase instead of psql
- **ALWAYS** for testing WhatsApp - use @whatsapp instead of test scripts
- **ALWAYS** for Redis operations - use @redis instead of redis-cli
- **ONLY for debugging** YClients API - use @yclients to check raw API responses

### ⚠️ IMPORTANT: Testing Bot Functionality
**NEVER use MCP servers to test bot features!** MCP servers are for debugging and infrastructure access only.

To test bot functionality:
1. **Use @whatsapp** to send messages to the bot
2. **Check bot responses** with @logs or @whatsapp get_last_response
3. **Verify database changes** with @supabase
4. **Check conversation context** with @redis

Example of CORRECT bot testing:
```
# 1. Send test message to bot
@whatsapp send_message phone:79001234567 message:"Хочу отменить запись"

# 2. Check bot's response
@whatsapp get_last_response phone:79001234567

# 3. Check logs for processing details
@logs logs_tail service:ai-admin-worker-v2 lines:50

# 4. Verify context if needed
@redis get_context phone:79001234567
```

Example of INCORRECT testing:
```
# ❌ WRONG - This tests YClients API directly, not our bot!
@yclients search_clients search:79001234567
```

### MCP Usage Examples:

```
# Check recent errors (instead of SSH + pm2 logs)
@logs logs_errors service:ai-admin-worker-v2 minutes:30

# Test WhatsApp message (instead of node test-direct-webhook.js)
@whatsapp send_message phone:79001234567 message:"Привет! Хочу записаться на стрижку завтра в 15:00"

# Check client in database (instead of psql or Supabase dashboard)
@supabase query_table table:clients filters:{"phone":"79001234567"}

# Get available slots (instead of YClients API curl)
@yclients get_available_slots date:2025-07-29 service_ids:[45]

# Check conversation context (instead of redis-cli)
@redis get_context phone:79001234567

# Clear context for testing (instead of redis-cli DEL)
@redis clear_context phone:79001234567

# Run full booking scenario
@whatsapp run_scenario scenario:booking_flow phone:79001234567

# Check if YClients integration received any webhooks
@logs logs_search pattern:"yclients" service:ai-admin-api lines:5
```

### Important Notes:
- MCP servers provide real-time access to production services
- No need to copy/paste long SSH commands
- Results are returned directly in the conversation
- Always prefer MCP over traditional tools when available

## Working Environment

- **Local directory**: /Users/vosarsen/Documents/GitHub/ai_admin_v2
- **Server**: ssh root@46.149.70.219
- **Server path**: /opt/ai-admin
- **SSH Key**: Available at `~/.ssh/id_ed25519_ai_admin` (use with `-i` flag)
- **SSH Command**: `ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219`
- **Business WhatsApp number**: +79936363848 (бизнес номер барбершопа для WhatsApp)

## Development Workflow

We use a strict workflow for all changes:

1. **Local** - analyze and modify files locally
2. **Commit** - IMMEDIATELY after each change, commit with descriptive message
   ```bash
   git add -A && git commit -m "fix: description of change"
   ```
3. **Push** - push changes to GitHub
   ```bash
   git push origin branch-name
   ```
4. **Deploy** - pull changes on server and restart services
   ```bash
   ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && git pull && pm2 restart all"
   ```
5. **Test** - test changes in production environment
   - Send test messages via @whatsapp or test scripts
   - Check logs via @logs for errors and expected behavior
   - Verify the fix actually works
6. **Iterate** - if issues found:
   - Fix locally
   - Commit again
   - Push and deploy
   - Test again
   - Repeat until desired result achieved
7. **Document** - ONLY after achieving desired result:
   - Create development diary entry in `docs/development-diary/YYYY-MM-DD-feature-name.md`
   - Document what worked, final solution, test results

**Important Principles**: 
- **Commit after EVERY change** - don't accumulate multiple changes
- **Test in production** - local testing is not enough
- **Document ONLY success** - no point documenting failed attempts
- Files in local directory and server are synchronized through Git
- We use `TodoWrite` for task tracking throughout the conversation
- NEVER modify files directly on server
- NEVER skip the commit-push-deploy-test cycle
- **Development diary** documents the FINAL WORKING solution, not the process
  - Format: `docs/development-diary/YYYY-MM-DD-feature-name.md`
  - Include: context, final solution, technical details, test results, lessons learned

## Project Overview

AI Admin v2 is a production-ready WhatsApp AI Assistant for beauty salons. It uses simplified AI-First architecture where a single AI call handles all decision-making, replacing the previous 5-6 step pipeline. The system is multi-tenant ready and scalable from 30 to 10,000+ companies. 

## Current Status

### Migration v1 → v2 Completed
- **Production now runs on v2 architecture** (as of July 13, 2024)
- Worker: `ai-admin-worker-v2` (not v1)
- All messages processed through AI Admin v2

### Critical Issues Fixed (September 21, 2025)
1. ✅ **Error 440 (connectionReplaced)** - Baileys now stable without reconnections
   - Added `BAILEYS_STANDALONE=true` flag
   - Disabled aggressive health checks
   - Fixed sendMessage to not create duplicate sessions
2. ✅ **Worker message sending** - API now proxies to baileys-service
3. ✅ **CompanyId type error** - Fixed object being passed instead of string

### Previously Fixed Issues
1. ✅ ecosystem.config.js updated to use v2 worker
2. ✅ Fixed `context is not defined` error
3. ✅ Fixed `query.from is not a function`
4. ✅ Fixed table name: schedules → staff_schedules
5. ✅ Fixed missing clients handling with maybeSingle()
6. ✅ Fixed undefined checks in sortServicesForClient
7. ✅ Fixed `AIService.generateResponse` error - now using `_callAI` method
8. ✅ Fixed Redis port conflict (6380 vs 6379) with temporary override


### Important Configuration Notes
- **BAILEYS_STANDALONE**: MUST be set to `true` in production to prevent session conflicts
- **Redis Port**: Local development uses port 6380 (for SSH tunnel), but server uses 6379
- **Temporary Fix**: `smart-cache.js` and `redis-factory.js` have temporary overrides for port 6380→6379
- **TODO**: Create separate environment configs for local vs production Redis URLs

### ⚠️ CRITICAL: WhatsApp Stability
**ALWAYS use `BAILEYS_STANDALONE=true` in production!** This prevents:
- Error 440 (connectionReplaced)
- Multiple processes fighting for the same WhatsApp session
- Unstable connections and reconnection loops

See `docs/BAILEYS_STANDALONE_ARCHITECTURE.md` for complete architecture details.

### ✅ FIXED: Duplicate Reminders (September 23, 2025)
- **Problem**: Clients received 10-20 identical reminders
- **Root Cause**: Multiple reminder systems + 5319 duplicate jobs in queue
- **Solution**: Consolidated to single booking-monitor service
- **Status**: Fixed and deployed!
- **Details**:
  - Only booking-monitor handles reminders now
  - Uses proper declensions for services/staff names
  - 40 diverse templates
  - See: `docs/development-diary/2025-09-23-reminder-system-consolidation.md`

### ✅ FIXED: Rapid-Fire Protection (July 23, 2025)
- **Problem**: Messages sent in parts were NOT combined
- **Solution**: Implemented Redis-based batching
- **Status**: Deployed to production and working!
- **Details**:
  - Messages are batched for up to 10 seconds
  - All clients now use `/webhook/whatsapp/batched`
  - Batch processor runs as separate PM2 process
  - See: `docs/development-diary/2025-07-23-redis-batching-implementation.md`

### ✅ FIXED: WhatsApp Stability Issues (September 10, 2025)
- **Problems Fixed**:
  - Connection cycling every 5-6 seconds (error 440: Connection replaced)
  - Message duplication (each message processed twice)
  - Invalid phone number extraction from WhatsApp JID
  - Incorrect session validation for Baileys
- **Solutions**:
  - Close old session before creating new one
  - Remove duplicate message handler from API routes
  - Fix phone extraction from JID format (`number@s.whatsapp.net`)
  - Use `sock.user` instead of `ws.readyState` for Baileys
- **Status**: Production stable - no reconnections, no duplicates
- **Details**: `docs/development-diary/2025-09-10-whatsapp-stability-fixes.md`

## Architecture (v2)

### Old Architecture (v1):
```
Message → AI Service → NLU Service → EntityExtractor → ActionResolver → ResponseGenerator → Action
```

### Current Architecture (v2 with Two-Stage - August 2025):
```
Message → Two-Stage Processor → Response
         ├── Stage 1: Command Extraction (JSON) - 8 sec
         ├── Parallel Command Execution - 0.01 sec
         └── Stage 2: Response Generation - 5 sec
```
**Performance**: 13.2 sec (Two-Stage) vs 32.6 sec (ReAct) - **2.5x faster!**

To activate Two-Stage:
```bash
export USE_TWO_STAGE=true
export AI_PROMPT_VERSION=two-stage
```

### Alternative Architecture (ReAct pattern):
```
Message → AI Admin v2 (full context) → ReAct Cycles (3-4 iterations) → Response
```

Key features:
- **Two-Stage**: 2 AI calls, JSON commands, parallel execution, 13 sec average
- **ReAct**: 3-4 AI calls, text blocks, sequential, 33 sec average
- **Command-Based**: AI embeds commands like [SEARCH_SLOTS], [CREATE_BOOKING] in responses
- **Business Type Adaptation**: Automatic detection and terminology adjustment
- **Parallel Context Loading**: All data loaded upfront in parallel
- **5-Minute Context Cache**: Reduces database calls

## Key Commands

### Development (v2)
```bash
# Start v2 workers (recommended)
node src/workers/index-v2.js       # Start v2 workers
npm run worker:v2                  # Alternative if configured in package.json

# Or use old workers
node src/workers/index.js          # Start v1 workers (legacy)

# Development mode
npm run dev                        # Start API server with nodemon
npm test                          # Run all Jest tests
npm run test:unit                 # Run unit tests only
npm run test:integration          # Run integration tests
npm run test:watch                # Run tests in watch mode
```

### Testing Specific Features
```bash
node test-architecture-simple.js    # Test core architecture
node test-proactive-ai.js          # Test AI suggestions
node test-monitoring-simple.js     # Test monitoring system
node test-booking-flow.js          # Test booking scenarios
node test-queue-simple.js          # Test queue processing
```

### Production
```bash
npm start               # Start production server
pm2 start ecosystem.config.js      # Start with PM2
pm2 status             # View process status
pm2 logs               # View logs
node scripts/monitor.js # Real-time monitoring dashboard
```

### Scripts
```bash
node scripts/check-env.js          # Validate environment configuration
node scripts/deploy.sh             # Deploy to production
node scripts/backup-redis.js       # Backup Redis data
node scripts/yclients-api-test.js  # Test YClients integration
```

## Core Services

### AI Admin v2 (`src/services/ai-admin-v2/`)
- **Single unified AI service** replacing the old pipeline
- Handles all AI operations in one call
- Supports commands: [SEARCH_SLOTS], [CREATE_BOOKING], [SHOW_PRICES], [SHOW_PORTFOLIO]
- Automatic business type detection and adaptation
- 5-minute context caching for performance

### MessageQueue (`src/queue/`)
- Handles message queuing with BullMQ
- Implements rapid-fire protection
- Manages worker job distribution

### BookingMonitor (`src/services/booking-monitor/`)
- **Monitors all bookings** from YClients every minute
- **Handles ALL reminders** (consolidated system as of Sept 23, 2025)
  - Sends reminders 19-21h day before & 2h before appointment
  - Uses 40 diverse templates with proper declensions
  - Stores history in `booking_notifications` table
- Sends notifications for booking changes
- Works with Baileys WhatsApp service

### BookingService (`src/services/booking/`)
- Handles all booking operations
- Integrates with YClients API
- Manages booking state and validation

### ContextService (`src/services/context/`)
- Manages conversation context in Redis
- Handles user preferences and history
- Implements context expiration (30 days)

### WhatsAppClient (`src/integrations/whatsapp/`)
- WhatsApp message handling
- Supports both Venom Bot and WhatsApp Business API
- Message formatting and media handling

### Business Types Configuration (`src/config/business-types.js`)
- Defines terminology and behavior for different beauty businesses
- Supported types: barbershop, nails, massage, epilation, brows, beauty
- Customizes greetings, confirmations, and communication style

### 🆕 FuzzyMatcher (`src/utils/fuzzy-matcher.js`)
- **Интеллектуальный поиск услуг** с поддержкой опечаток
- Алгоритм Левенштейна для нечеткого поиска
- Извлечение ключевых слов с фильтрацией стоп-слов
- Многоуровневая система оценки совпадений
- **📚 Документация**: [docs/fuzzy-matcher-guide.md](docs/fuzzy-matcher-guide.md)

## Database Schema

The system uses Supabase (PostgreSQL) with the following key tables:
- `companies`: Multi-tenant company data (1 row)
- `bookings`: Booking records and history (0 rows)
- `clients`: Client information and preferences (1,361 rows)
- `services`: Available services catalog (45 rows)
- `staff`: Staff members/masters (3 rows)
- `staff_schedules`: Working schedules (110 rows)
- `messages`: Message history and analytics (0 rows)
- `actions`: AI action tracking (0 rows)
- `dialog_contexts`: Conversation contexts (21 rows)
- `company_sync_status`: Sync status tracking (0 rows)

### MCP (Model Context Protocol) Integration

**📚 MCP Setup Guide**: See [docs/mcp-servers-guide-v2.md](docs/mcp-servers-guide-v2.md) for the correct setup using CLI commands.

**⚠️ IMPORTANT**: MCP servers must be configured using `claude mcp add` commands, NOT by editing JSON files!

#### Quick Setup:
```bash
# Run this to set up all MCP servers
./docs/mcp-setup-commands.sh
```

#### Available MCP Servers:
1. **@test-simple** - Basic test server (use to verify MCP is working)
2. **@redis** - Redis cache management (requires SSH tunnel on port 6380)
3. **@supabase** - Direct database access (uses service_role key for full access)
4. **@whatsapp** - WhatsApp testing
5. **@yclients** - YClients API access
6. **@logs** - Server logs via SSH

#### Usage:
- Check status: Type `/mcp` in Claude Code
- List servers: `claude mcp list`
- Add server: `claude mcp add <name> <command> [args...]`
- Remove server: `claude mcp remove <name>`
- **Important**: Restart Claude Code after changing MCP configurations or server code

**Redis Tunnel Required**:
```bash
./scripts/maintain-redis-tunnel.sh start
```

### YClients API Documentation

The complete YClients API documentation is available in `YCLIENTS_API.md` file (35k lines, parsed from https://developers.yclients.com/ru).

**Quick access tools:**
1. **Structure file**: `docs/yclients-api-structure.md` - структура всего файла с номерами строк
2. **Index file**: `docs/yclients-api-index.md` - основные endpoints и примеры поиска
3. **Search script**: `scripts/search-yclients-api.js` - для быстрого поиска в документации

**Примеры использования поиска:**
```bash
# Найти всё про создание записи
node scripts/search-yclients-api.js "book_record"

# Показать все POST endpoints
node scripts/search-yclients-api.js --endpoints POST

# Поиск по ключевому слову
node scripts/search-yclients-api.js "Создать запись"
```

**Основные endpoints для AI Admin:**
- Authorization: POST `/api/v1/auth`
- Get services: GET `/api/v1/book_services/{company_id}`
- Get time slots: GET `/api/v1/book_times/{company_id}`
- Create booking: POST `/api/v1/book_record/{company_id}`
- Check booking: POST `/api/v1/book_check/{company_id}`

**Поиск в документации через Grep:**
```bash
# Найти параметры для создания записи
grep -A 50 "Создать запись на сеанс" YCLIENTS_API.md

# Найти все про определенный endpoint
grep -B 5 -A 20 "book_times" YCLIENTS_API.md
```

No additional MCP integration needed for YClients documentation access.

**ВАЖНО**: При работе с YClients API всегда использовать документацию:
1. Проверить структуру в `docs/yclients-api-structure.md` для поиска нужного раздела
2. Найти точный метод и параметры в `YCLIENTS_API.md` используя номера строк
3. Обратить внимание на экранирование (`book\_record` вместо `book_record`)
4. Проверить обязательные параметры и формат данных (ISO8601 для дат, формат телефона и т.д.)

## Environment Configuration

Key environment variables:
- `AI_PROVIDER`: AI service provider (default: deepseek)
- `DEEPSEEK_API_KEY`: DeepSeek API key
- `DEEPSEEK_MODEL`: AI model (default: deepseek-chat)
- `YCLIENTS_API_KEY`: YClients CRM API key
- `REDIS_URL`: Redis connection URL
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_KEY`: Supabase service key
- `WHATSAPP_PROVIDER`: WhatsApp provider (venom/business-api)
- `SECRET_KEY`: HMAC authentication key

## Testing Approach

- **Unit Tests**: Test individual services and utilities
- **Integration Tests**: Test API endpoints and service interactions
- **End-to-End Tests**: Test complete booking flows
- **Performance Tests**: Monitor response times and throughput

When adding new features:
1. Write unit tests for new service methods
2. Add integration tests for new API endpoints
3. Update end-to-end tests if flow changes
4. Run performance tests to ensure no regression

## Performance Targets

- Message throughput: 100-200 msg/min (3 workers)
- Response time: 2-5 seconds average
- Cache hit rate: >70%
- Memory usage: <150MB per worker
- Error rate: <2%

## Security Considerations

- All webhooks use HMAC-SHA256 authentication
- Redis requires password authentication in production
- Rate limiting: 30 requests/minute per phone number
- Input validation on all user inputs
- Secrets encrypted with AES-256-GCM

## Deployment

The system uses PM2 for process management:
```javascript
// ecosystem.config.js defines:
- api: API server instance
- worker: Message processing workers (3 instances)
- reminder: Reminder worker (1 instance)
```

For scaling:
- Increase worker instances in ecosystem.config.js
- Add Redis replicas for read scaling
- Use load balancer for API servers
- Monitor with `node scripts/monitor.js`

## Database Optimization

### План оптимизации производительности

#### ✅ Выполнено:
1. **Индексы созданы** в Supabase (ускорение запросов в 10-100x)
   - `idx_services_company_active` - поиск услуг
   - `idx_staff_company_active` - поиск мастеров  
   - `idx_clients_phone_company` - поиск клиентов
   - `idx_dialog_contexts_user` - контекст диалогов

#### 🚀 Текущая проблема:
- **Высокая латентность** до Supabase из России (150-200ms на запрос)
- Индексы помогают, но не решают проблему сетевой задержки

#### 💡 План действий:

**1. Быстрый фикс (5 минут)** - добавить простой кэш в `loadFullContext`:
```javascript
// В начале метода loadFullContext
if (!this._cache) this._cache = {};
const key = `${phone}_${companyId}`;
const now = Date.now();

if (this._cache[key] && now - this._cache[key].time < 300000) { // 5 минут
  logger.debug('Using cached context');
  return this._cache[key].data;
}

// В конце метода
this._cache[key] = { data: context, time: now };
```

**2. Redis кэширование (1 час)**:
- Использовать готовый `optimized-supabase.js`
- Настроить Redis: `apt-get install redis-server`
- Заменить импорты в AI Admin v2

**3. Локальная репликация (1 неделя)**:
- Синхронизировать критичные данные локально
- Обновлять каждые 5-10 минут
- Запросы будут выполняться за 1-10ms

**4. Миграция на локальную БД (1 месяц)**:
- Полностью убрать зависимость от Supabase
- PostgreSQL на сервере
- Прямая синхронизация с YClients

### Ожидаемые результаты:
- **Сейчас**: 200-500ms на запрос
- **С кэшем**: 5-20ms на повторные запросы (cache hit 70-90%)
- **С локальной БД**: 1-10ms всегда

### Команды для оптимизации:
```bash
# Создать индексы (уже выполнено)
scripts/database/create-indexes-working.sql

# Проверить производительность
node scripts/test-server-performance.js

# Мониторинг
npm run monitor
```

### Файлы оптимизации:
- `src/database/optimized-supabase.js` - клиент с Redis кэшем
- `scripts/database/` - SQL скрипты для индексов
- `PERFORMANCE_ANALYSIS.md` - детальный анализ

## 🔄 Система синхронизации YClients → Supabase

### ⚡ Оптимизированная архитектура (August 2025)
Полностью переработанная система синхронизации с ускорением в 16 раз.

**📚 Полная документация**: [docs/SYNC_SYSTEM.md](docs/SYNC_SYSTEM.md)

### Ключевые особенности:
- **22 секунды** для синхронизации 1400+ клиентов (было 6 минут)
- **Пакетная обработка** по 50 записей за запрос
- **Автоматическое расписание** через cron
- **Модульная архитектура** - отдельные файлы для каждой сущности
- **Синхронизация категорий услуг** - автоматическая загрузка названий категорий

### Расписание автоматической синхронизации:
```
01:00 - Услуги с категориями (ежедневно)
02:00 - Мастера (ежедневно) - только активные сотрудники
03:00 - Клиенты (ежедневно) - с оптимизацией
Каждые 4 часа - Расписания
00:00 воскресенье - Информация о компании
```

### 🆕 Синхронизация категорий (14 августа 2025)
При синхронизации услуг автоматически:
1. Загружаются категории из `/api/v1/company/{id}/service_categories`
2. Создается маппинг category_id → category_title
3. Каждая услуга получает название категории
4. **Результат**: 100% услуг имеют категории в БД

### Ручной запуск:
```bash
# Полная синхронизация
node scripts/manual-sync.js

# Только клиенты (оптимизированная версия)
node scripts/manual-sync.js clients

# Проверка статуса
node scripts/check-sync-status.js

# Статистика клиентов
node check-client-stats.js
```

### Важные файлы:
- `src/sync/sync-manager.js` - координатор синхронизации
- `src/sync/clients-sync-optimized.js` - оптимизированная синхронизация клиентов
- `src/sync/staff-sync.js` - синхронизация мастеров с фильтрацией
- `src/sync/sync-utils.js` - общие утилиты

### Известные особенности:
- YClients API возвращает `sold_amount`, а не `spent` для финансовых данных
- Фильтруются только активные мастера (не уволенные и не скрытые)
- Используется пакетная обработка для ускорения

## Troubleshooting

### If getting "Извините, произошла ошибка" responses:
1. Check logs: `ssh root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 50"`
2. Common causes:
   - Database connection issues
   - Missing data in tables
   - Undefined object properties
3. v2 now has error handling for all database operations

### Testing Changes
1. Send test message in WhatsApp
2. Check logs for errors
3. If error - fix locally, commit, push, pull on server, restart worker

### PM2 Process Monitoring
Monitor the health and stability of PM2 processes:

```bash
# Check process status and restart counts
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 status"

# Reset restart counters (useful after fixing issues)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 reset all"        # Reset all processes
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 reset ai-admin-worker-v2"  # Reset specific process

# View logs for specific process
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 50"
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-booking-monitor --lines 50"

# Real-time monitoring
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 monit"

# Check for errors in logs
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs --err --lines 100"
```

**Important Notes:**
- High restart counts may be historical - use `pm2 reset` to establish baseline
- Some processes self-recover from errors (e.g., booking-monitor)
- Monitor after deployments to catch issues early
- Check `pm2 status` periodically for stability tracking

## Development Guidelines

## No Hardcoding Policy
**ВАЖНО**: В проекте ЗАПРЕЩЕНО использовать хардкод. Все значения должны быть:
- Настраиваемыми через конфигурацию (`src/config/`)
- Передаваемыми как параметры
- Определенными в константах или enum
- Загружаемыми из базы данных

Примеры что НЕ делать:
```javascript
// ❌ ПЛОХО
title: 'Beauty Salon'
timezone: 'Europe/Moscow'
address: 'Не указан'

// ✅ ХОРОШО
title: config.company?.defaultTitle || 'Салон красоты'
timezone: config.app?.timezone || 'Europe/Moscow'
address: data.address || ''
```

# Common Development Tasks

### Adding a New AI Command (v2)
1. Update `src/services/ai-admin-v2/index.js` to add command in prompt
2. Implement command extraction regex in `extractCommands()`
3. Add command execution logic in `executeCommands()`
4. Test with appropriate message scenarios

### Adding a New Business Type
1. Add configuration to `src/config/business-types.js`
2. Define: terminology, greetings, confirmations, rules
3. Update business type detection logic in AI Admin v2
4. Test with company of that type

### Modifying Message Flow (v2)
1. Update `src/workers/message-worker-v2.js` for processing logic
2. Modify `src/queue/message-queue.js` if queue behavior changes
3. Update rapid-fire protection in `shouldProcessMessage()`
4. Test with `node test-queue-simple.js`

### Switching Between v1 and v2
```bash
# To use v2 (recommended):
node src/workers/index-v2.js

# To use v1 (legacy):
node src/workers/index.js

# Both versions can run in parallel on different queues if needed
```

## AI Provider System (August 2025)

### Overview
Унифицированная система управления AI провайдерами и промптами позволяет:
- Легко переключаться между DeepSeek и Qwen без изменения кода
- Тестировать разные версии промптов (A/B тестирование)
- Собирать статистику эффективности каждого промпта
- Использовать разные модели Qwen (Plus, Max, Turbo)

**📚 Полная документация**: См. [docs/AI_PROVIDERS_GUIDE.md](docs/AI_PROVIDERS_GUIDE.md)

### Architecture Files
- `src/services/ai/provider-factory.js` - Фабрика AI провайдеров
- `src/services/ai-admin-v2/prompt-manager.js` - Менеджер промптов
- `src/services/ai-admin-v2/prompts/` - Директория с промптами
- `src/api/routes/ai-management.js` - API для управления

### Quick Commands

#### Switching AI Providers
```bash
# List available providers
node scripts/switch-ai-provider.js list

# Switch to Qwen (fast model)
node scripts/switch-ai-provider.js switch qwen
# or set env: AI_PROVIDER=qwen

# Switch to Qwen 72B (smart model)
node scripts/switch-ai-provider.js switch qwen-72b

# Switch back to DeepSeek
node scripts/switch-ai-provider.js switch deepseek
```

#### Managing Prompts
```bash
# List prompts and statistics
node scripts/manage-prompts.js list

# Switch active prompt
node scripts/manage-prompts.js switch strict-prompt
# or set env: AI_PROMPT_VERSION=strict-prompt

# Enable A/B testing
node scripts/manage-prompts.js ab-test on
# or set env: AI_PROMPT_AB_TEST=true

# Test prompt
node scripts/manage-prompts.js test "Хочу записаться на стрижку"
```

### Available Prompts
1. **base-prompt** - Минимальный промпт
2. **enhanced-prompt** - С примерами (рекомендуется для DeepSeek)
3. **strict-prompt** - Строгий формат (рекомендуется для Qwen)

### API Endpoints
```bash
# Provider management
GET  /api/ai/providers
POST /api/ai/providers/switch

# Prompt management
GET  /api/ai/prompts
POST /api/ai/prompts/switch
POST /api/ai/prompts/ab-test
GET  /api/ai/prompts/stats
POST /api/ai/prompts/test
```

### Important Notes
- **Qwen Integration**: Теперь Qwen интегрирован как полноценный провайдер, не через обёртки
- **Old Qwen Files**: Файлы `index-qwen-simple.js`, `index-with-qwen.js` больше не используются
- **Statistics**: Система автоматически собирает статистику по каждому промпту
- **Prompt Selection**: При USE_QWEN=true рекомендуется использовать `strict-prompt`

### Troubleshooting Qwen
Если Qwen не выполняет команды:
1. Переключитесь на `strict-prompt`: `AI_PROMPT_VERSION=strict-prompt`
2. Попробуйте Qwen 72B модель: `AI_PROVIDER=qwen-72b`
3. Если не помогает, вернитесь на DeepSeek: `AI_PROVIDER=deepseek`

## Debugging

- Enable debug logs: `DEBUG=ai-admin:* npm run dev`
- Monitor Redis: `redis-cli monitor`
- View queue dashboard: `http://localhost:3000/admin/queues`
- Check health: `curl http://localhost:3000/health`
- Real-time monitoring: `node scripts/monitor.js`

### v2 Specific Logs
Logs will show:
- Business type detection
- Commands AI decided to execute
- Command execution results
- Context caching hits/misses
- Single AI call performance metrics

Example v2 logs:
```
🤖 AI Admin v2 processing: "хочу записаться" from 79001234567
Loading full context from database...
Business type detected: barbershop
Executing command: SEARCH_SLOTS
✅ AI Admin v2 completed in 523ms
🤖 Bot response to 79001234567: "Привет! Вот доступные слоты для записи..."
```

## MCP Integration & Testing

### MCP Servers Setup (July 17, 2024)
MCP (Model Context Protocol) servers are configured for direct access to services:

1. **MCP WhatsApp** (`mcp-whatsapp/`) - Testing WhatsApp integration
2. **MCP YClients** (`mcp-yclients/`) - Direct YClients API access  
3. **MCP Supabase** (`mcp-supabase/`) - Direct database queries
4. **MCP Redis** (`mcp-redis/`) - Redis cache access

**📚 For detailed MCP configuration guide, see: [docs/mcp-configuration-guide.md](docs/mcp-configuration-guide.md)**

#### MCP Redis Setup (IMPORTANT)
MCP Redis requires SSH tunnel to remote server. The tunnel is **automatically maintained**:

**Usage in Claude Code:**
1. Use `/mcp` command to access MCP servers
2. Redis commands available:
   - `@redis get_context phone:79001234567` - get conversation context
   - `@redis clear_context phone:79001234567` - clear context (reset dialog)
   - `@redis set_booking_stage` - set booking stage for testing
   - `@redis list_active_contexts` - list all active conversations
   - `@redis simulate_returning_client` - make client appear as returning
   - `@redis get_all_keys pattern:*` - get Redis keys by pattern

**Automatic SSH Tunnel:**
- Tunnel runs on `localhost:6380 → 46.149.70.219:6379`
- Auto-starts on system boot (via launchd)
- Auto-restarts on connection failure
- Check status: `./scripts/maintain-redis-tunnel.sh status`
- View logs: `tail -f ~/.redis-tunnel.log`

**Manual Control (if needed):**
```bash
# Quick start tunnel
./setup-redis-tunnel.sh quick

# Install as system service (already done)
./setup-redis-tunnel.sh install

# Uninstall service
./setup-redis-tunnel.sh uninstall
```

**IMPORTANT**: Always use MCP Redis (`@redis` commands) for context manipulation during testing!

### Testing WhatsApp Bot

#### Quick Test Commands
```bash
# Send single test message
node test-direct-webhook.js

# Run full booking scenario
node test-booking-scenario.js

# Check Venom-bot status
node test-venom-check.js

# Direct message through Venom
./test-venom-direct.sh
```

#### Important Testing Notes
1. **Test from different number** - Bot can't reply to itself (+79686484488)
2. **Use client number** like 79001234567 for testing
3. **Bot responses are now logged** with prefix `🤖 Bot response to`

#### Recent Fixes (July 17, 2024)
1. **Fixed imports**:
   - `ai-admin-v2/index.js`: Fixed AIService import (singleton, not constructor)
   - `data-loader.js`: Fixed Supabase import (destructured)

2. **Added response logging**:
   - In `message-worker-v2.js`: Logs full bot response text
   - In `whatsapp/client.js`: Logs message preview
   - Error responses also logged

3. **Current Issues**:
   - Worker v2 sends error message due to AIService issues
   - But logging now works to see all bot responses

#### Viewing Bot Responses
```bash
# See bot responses in logs
ssh root@46.149.70.219 "tail -100 /root/.pm2/logs/ai-admin-worker-v2-out.log | grep '🤖 Bot response'"

# See message previews
ssh root@46.149.70.219 "tail -100 /root/.pm2/logs/ai-admin-worker-v2-out.log | grep 'messagePreview'"
```

### MCP Configuration Notes

**Important**: MCP servers are configured in `~/.config/claude/mcp.json` (NOT in the project directory)

**Known Issues**:
1. Environment variable expansion (`${VAR}`) doesn't work - use hardcoded values
2. WhatsApp MCP requires correct `AI_ADMIN_API_URL` pointing to remote server
3. Redis MCP requires SSH tunnel on port 6380 (not default 6379)

**To update MCP configuration**:
```bash
# Edit Claude's config file
vi ~/.config/claude/mcp.json

# Then restart Claude Code
```

### Quick Deployment Flow
```bash
# 1. Make changes locally
# 2. Commit
git add -A && git commit -m "fix: description"

# 3. Copy files to server (since git push needs auth)
scp src/path/to/file.js root@46.149.70.219:/opt/ai-admin/src/path/to/file.js

# 4. Restart worker
ssh root@46.149.70.219 "pm2 restart ai-admin-worker-v2"

# 5. Test and check logs
node test-direct-webhook.js
ssh root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 50"
```

## 📁 Project Structure

### Root Directory Organization
- **src/** - Main source code
- **scripts/** - Utility and management scripts
- **tests/** - Test files and test scenarios
- **mcp/** - MCP server implementations
- **docs/** - All documentation (organized by category)
- **examples/** - Code examples and patterns
- **config/** - Configuration files and project docs
- **archive/** - Archived scripts and test files (not for active use)
- **legacy/** - Legacy code kept for reference
- **public/** - Public assets and HTML files
- **kultura-analytics/** - Business analytics specific to Kultura

### Documentation Structure (docs/)
- **architecture/** - System architecture, database design, caching
- **technical/** - Technical guides for AI, integrations, implementations
- **features/** - Feature documentation and specifications
- **configuration/** - Setup guides and configuration instructions
- **deployment/** - Deployment guides, MCP setup, infrastructure
- **development-diary/** - Daily development logs and decisions
- **guides/** - User guides, admin guides, quick references
- **api/** - API documentation
- **sessions/** - Work session summaries
- **testing-results/** - Test results and reports

### Config Directory (config/)
- **project-docs/** - Project management docs (CONTEXT.md, TASK.md, etc.)
- Configuration files for different environments

### Archive Directory (archive/)
- **test-files/** - Old test scripts and JSON results
- **sync-scripts/** - Database synchronization scripts
- **analysis-scripts/** - Debugging and analysis utilities

**Note**: Files in `archive/` are kept for reference only. Use main source code for active development.