# AI Admin v2 - Task Tracker

## 🎯 Current Sprint

### 🔴 High Priority
- [ ] Test booking flow (Phase 2) - полный процесс записи
- [ ] Test modification and cancellation (Phase 3)
- [ ] Test edge cases and error handling (Phase 4)
- [ ] Implement webhook integration for real-time updates from YClients
- [ ] Add Redis caching for slot availability

### 🟡 Medium Priority
- [ ] Fix Redis configuration (remove temporary hacks)
- [ ] Create integration tests for booking flow
- [ ] Add monitoring dashboard improvements
- [ ] Implement webhook retry mechanism

### 🟢 Low Priority
- [ ] Add more business types to `business-types.js`
- [ ] Create admin panel for configuration
- [ ] Add analytics tracking

## ✅ Completed Tasks

### Migration v1 → v2 (July 2024)
- [x] Implement AI Admin v2 architecture
- [x] Replace 5-step pipeline with single AI call
- [x] Add command-based approach
- [x] Implement business type detection
- [x] Add 5-minute context caching
- [x] Update PM2 configuration to use v2 worker

### Bug Fixes
- [x] Fixed `context is not defined` error
- [x] Fixed `query.from is not a function`
- [x] Fixed table name: schedules → staff_schedules
- [x] Fixed missing clients handling with maybeSingle()
- [x] Fixed undefined checks in sortServicesForClient
- [x] Fixed `AIService.generateResponse is not a function` - using `_callAI` instead (July 18, 2024)
- [x] Fixed Redis port 6380 issues - temporary override to 6379 (July 18, 2024)
- [x] Fixed git merge conflicts on server deployment (July 18, 2024)
- [x] Fixed "no working masters" issue - removed company_id filter from staff_schedules (July 19, 2024)
- [x] Fixed incorrect working hours (21:00 → 22:00) (July 19, 2024)

### Optimizations
- [x] Created database indexes for performance
- [x] Added MCP Supabase integration
- [x] Optimized YClients API documentation access
- [x] Implemented Context Engineering structure
- [x] Increased schedule sync frequency from 2x to 48x daily (July 21, 2024)
- [x] Implemented smart slot filtering with 1-hour intervals (July 21, 2024)

### Features Added (July 20-21, 2024)
- [x] ServiceMatcher scoring algorithm with penalties for complex services
- [x] Relative date parsing ("завтра", "послезавтра", days of week)
- [x] Automatic booking creation without confirmation when specific time provided
- [x] Fixed booking number display (correct extraction from YClients response)
- [x] Price list improvements - filtering, sorting, compact format
- [x] Staff availability sync script (sync-staff-schedules.js)
- [x] API endpoints for manual sync control
- [x] Smart slot filtering - 3 slots per time period with 1-hour gaps

### Features
- [x] Implemented automatic company data parsing from YClients API (July 19, 2024)
- [x] Added business type auto-detection based on company description
- [x] Made system scalable - new companies auto-configure from YClients
- [x] Implemented relative date parsing ("завтра" → "2025-07-21") (July 20, 2024)
- [x] Added improved service matching algorithm with penalties for complex services (July 20, 2024)

## 🚀 Upcoming Features

### Phase 1: Performance
- [ ] Redis caching layer for Supabase queries
- [ ] Local data replication for critical tables
- [ ] Batch processing for YClients sync

### Phase 2: Features
- [ ] Multi-language support
- [ ] Voice message handling
- [ ] Automated reminders
- [ ] Loyalty program integration

### Phase 3: Scale
- [ ] Horizontal scaling support
- [ ] Multi-region deployment
- [ ] Advanced analytics dashboard
- [ ] API for external integrations

## 📝 Technical Debt

1. **Database**
   - Missing foreign key constraints
   - No cascade delete rules
   - Incomplete migration scripts

2. **Code**
   - Some services exceed 500 lines
   - Inconsistent error handling
   - Mixed async/callback patterns

3. **Testing**
   - Low test coverage (~40%)
   - Missing integration tests
   - No performance tests

4. **Documentation**
   - API documentation incomplete
   - Missing deployment guide
   - No troubleshooting guide

## 🐛 Known Issues

1. **ServiceMatcher**
   - Алгоритм scoring не применяет штрафы правильно
   - Все услуги со словом "стрижка" получают одинаковый score (130)
   - Выбирается первая услуга из списка вместо наиболее подходящей

2. **Booking Flow**
   - Ошибка "Сотрудник не оказывает выбранную услугу"
   - lastSearch сохраняет несовместимую пару service_id + staff_id
   - Нет проверки совместимости услуга-мастер перед созданием записи

3. **Performance**
   - High latency to Supabase from Russia (150-200ms)
   - Context loading can be slow for busy salons
   - No connection pooling

4. **Configuration**
   - Redis port hardcoded with temporary hacks (6380 → 6379)

   - Need separate configs for local vs production

5. **YClients API Permissions**
   - API возвращает ошибку 403 при попытке управления клиентами
   - Невозможно найти клиента по телефону (`POST company/962302/clients/search`)
   - Невозможно создать нового клиента (`POST clients/962302`)
   - Но создание записи работает (`POST book_record/962302`)
   - В результате в YClients отображается "Клиент" вместо реального имени
   - **Важно**: Код AI Admin v2 работает правильно - проблема в правах доступа API ключа

6. **Reliability**
   - WhatsApp session can expire
   - No automatic reconnection
   - Queue can get stuck on errors

6. **UX**
   - Error messages not user-friendly
   - No typing indicators
   - Limited formatting options
   - Prices not showing correctly (format issues)

## 📊 Metrics to Track

- Average response time
- Daily active users
- Booking conversion rate
- Error rate by type
- Cache hit ratio
- Worker memory usage

## 🔄 Update History

- **2024-07-20**: Added relative date parsing, improved ServiceMatcher (issues remain)
- **2024-07-19**: Implemented auto-parsing from YClients, fixed working hours
- **2024-07-16**: Added Context Engineering structure
- **2024-07-13**: Completed v1 → v2 migration
- **2024-07-11**: Fixed database sync issues
- **2024-07-10**: Initial v2 architecture implementation