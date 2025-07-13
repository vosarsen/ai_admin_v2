# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Admin v2 is a production-ready WhatsApp AI Assistant for beauty salons. It uses simplified AI-First architecture where a single AI call handles all decision-making, replacing the previous 5-6 step pipeline. The system is multi-tenant ready and scalable from 30 to 10,000+ companies.

- **Local directory**: /Users/vosarsen/Documents/GitHub/ai_admin_v2
- **server**: ssh root@46.149.70.219 route on the server - /opt/ai-admin 
 
We use TodoWrite for task traction. 

## Architecture (v2)

### Old Architecture (v1):
```
Message → AI Service → NLU Service → EntityExtractor → ActionResolver → ResponseGenerator → Action
```

### New Architecture (v2):
```
Message → AI Admin v2 (full context) → Actions → Response
```

Key features:
- **Single AI Call**: One comprehensive AI request with full context
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

## Database Schema

The system uses Supabase (PostgreSQL) with the following key tables:
- `companies`: Multi-tenant company data
- `bookings`: Booking records and history
- `clients`: Client information and preferences
- `messages`: Message history and analytics
- `actions`: AI action tracking

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

## Common Development Tasks

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
```