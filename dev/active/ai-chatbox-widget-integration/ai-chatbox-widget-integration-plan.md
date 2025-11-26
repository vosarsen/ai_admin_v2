# AI Chatbox Widget Integration - Strategic Plan

**Last Updated:** 2025-11-26

---

## Executive Summary

### Objective
Создать универсальный, встраиваемый AI чат-виджет для интеграции на сторонние сайты клиентов, превращая существующий демо-чат с landing page в полноценный продукт.

### Business Value
- **Масштабирование бизнеса**: Клиенты смогут интегрировать AI бота на свои сайты без технических знаний
- **Снижение нагрузки**: Автоматизация 70-80% входящих обращений через сайт
- **Увеличение конверсии**: 24/7 доступность AI бота → больше записей клиентов
- **Дополнительная ценность**: Новая функциональность для существующих и потенциальных клиентов

### Current State
✅ **Существующие компоненты:**
- Demo chat на landing page (`public/landing/index.html`)
- Backend API endpoint `/api/demo-chat` (src/api/routes/demo-chat.js)
- AI Admin v2 service integration
- Rate limiting (10 msg/session, 100 msg/IP/day)
- Session management через Redis
- Contextual suggestions system

❌ **Отсутствующие компоненты:**
- Отдельный standalone widget (независимый от landing page)
- Embeddable JavaScript snippet для интеграции
- Multi-client support (сейчас только demo company ID)
- Client-specific configuration и брендинг
- Analytics и tracking виджета
- Admin panel для управления виджетами

### Proposed Future State
🎯 **Конечный результат:**
1. **Standalone Widget** - Независимый чат-бокс, загружаемый одной строкой кода
2. **Multi-tenant Architecture** - Поддержка множества клиентов с индивидуальными настройками
3. **Admin Panel** - UI для управления виджетами, настройками, статистикой
4. **Analytics Dashboard** - Метрики использования, конверсии, популярные запросы
5. **Customization System** - Брендинг (цвета, лого, приветствие) для каждого клиента

---

## Implementation Phases

### Phase 1: Widget Extraction & Standalone Build (Week 1)
**Цель:** Выделить демо-чат в отдельный переиспользуемый компонент

#### 1.1 Extract Widget Code
- [ ] **Задача 1.1.1**: Create standalone widget HTML template
  - **Файл**: `public/widget/chatbox-widget.html`
  - **Критерии**:
    - Минимальная HTML структура (только чат, без landing page контента)
    - Встроенные стили (inline или <style>)
    - Поддержка темной/светлой темы
  - **Зависимости**: None
  - **Усилия**: M

- [ ] **Задача 1.1.2**: Extract и optimize widget CSS
  - **Файл**: `public/widget/css/chatbox-widget.css`
  - **Критерии**:
    - Изолированные стили (prefix `.ai-chatbox-widget`)
    - Responsive design (mobile, tablet, desktop)
    - Dark/Light theme support
    - No conflicts с клиентским сайтом
  - **Зависимости**: 1.1.1
  - **Усилия**: M

- [ ] **Задача 1.1.3**: Create widget JavaScript bundle
  - **Файл**: `public/widget/js/chatbox-widget.js`
  - **Критерии**:
    - Vanilla JS (no dependencies на jQuery/React)
    - Module pattern (избежать global scope pollution)
    - API integration (`/api/demo-chat`)
    - Session management (UUID v4 generation)
    - Message handling (send/receive)
    - Contextual suggestions
  - **Зависимости**: 1.1.1, 1.1.2
  - **Усилия**: L

#### 1.2 Widget Loader Script
- [ ] **Задача 1.2.1**: Create embeddable loader script
  - **Файл**: `public/widget/loader.js`
  - **Критерии**:
    - Single `<script>` tag integration
    - Async loading (non-blocking)
    - Configuration via data attributes или global config object
    - Inject HTML/CSS/JS dynamically
    - Error handling (failed load, network issues)
  - **Пример интеграции**:
    ```html
    <script
      src="https://ai-admin.example.com/widget/loader.js"
      data-company-id="123456"
      data-theme="dark"
      async
    ></script>
    ```
  - **Зависимости**: 1.1.1, 1.1.2, 1.1.3
  - **Усилия**: M

#### 1.3 Widget UI/UX Enhancements
- [ ] **Задача 1.3.1**: Add minimized/maximized states
  - **Критерии**:
    - Floating button (bottom-right corner)
    - Expand/collapse animation
    - Notification badge (new messages count)
    - Sound notification (optional)
  - **Зависимости**: 1.1.3
  - **Усилия**: S

- [ ] **Задача 1.3.2**: Add position customization
  - **Критерии**:
    - Configurable position (bottom-left, bottom-right, custom)
    - Z-index management
    - Mobile responsive (full-screen on small devices)
  - **Зависимости**: 1.3.1
  - **Усилия**: S

---

### Phase 2: Backend Multi-Tenant Support (Week 2)
**Цель:** Адаптировать backend для поддержки множества клиентов

#### 2.1 Database Schema
- [ ] **Задача 2.1.1**: Create `widget_configs` table (Timeweb PostgreSQL)
  - **Файл**: `src/database/migrations/YYYY-MM-DD-create-widget-configs.sql`
  - **Структура**:
    ```sql
    CREATE TABLE widget_configs (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      widget_key VARCHAR(64) UNIQUE NOT NULL, -- API key для аутентификации
      enabled BOOLEAN DEFAULT true,

      -- Брендинг
      primary_color VARCHAR(7) DEFAULT '#667eea',
      secondary_color VARCHAR(7) DEFAULT '#764ba2',
      logo_url TEXT,
      company_name VARCHAR(255),
      welcome_message TEXT,

      -- Настройки
      theme VARCHAR(10) DEFAULT 'dark', -- dark/light/auto
      position VARCHAR(20) DEFAULT 'bottom-right',
      language VARCHAR(5) DEFAULT 'ru',
      show_branding BOOLEAN DEFAULT true, -- "Powered by AI Admin"

      -- Rate limits
      messages_per_session INTEGER DEFAULT 50,
      daily_messages_per_ip INTEGER DEFAULT 500,

      -- Статистика
      total_sessions INTEGER DEFAULT 0,
      total_messages INTEGER DEFAULT 0,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_widget_configs_company_id ON widget_configs(company_id);
    CREATE INDEX idx_widget_configs_widget_key ON widget_configs(widget_key);
    ```
  - **Зависимости**: None
  - **Усилия**: M

- [ ] **Задача 2.1.2**: Create `widget_sessions` table
  - **Файл**: Same migration file
  - **Структура**:
    ```sql
    CREATE TABLE widget_sessions (
      id SERIAL PRIMARY KEY,
      widget_id INTEGER NOT NULL REFERENCES widget_configs(id),
      session_id UUID NOT NULL UNIQUE,
      ip_address INET,
      user_agent TEXT,
      messages_count INTEGER DEFAULT 0,
      first_message_at TIMESTAMP,
      last_message_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_widget_sessions_widget_id ON widget_sessions(widget_id);
    CREATE INDEX idx_widget_sessions_session_id ON widget_sessions(session_id);
    CREATE INDEX idx_widget_sessions_created_at ON widget_sessions(created_at);
    ```
  - **Зависимости**: 2.1.1
  - **Усилия**: S

#### 2.2 Repository Pattern
- [ ] **Задача 2.2.1**: Create WidgetConfigsRepository
  - **Файл**: `src/repositories/WidgetConfigsRepository.js`
  - **Методы**:
    - `findByWidgetKey(widgetKey)` - Get config by API key
    - `findByCompanyId(companyId)` - Get all widgets for company
    - `create(companyId, config)` - Create new widget
    - `update(id, config)` - Update widget settings
    - `delete(id)` - Soft delete widget
    - `incrementStats(id, { sessions?, messages? })` - Update counters
  - **Зависимости**: 2.1.1
  - **Усилия**: M

- [ ] **Задача 2.2.2**: Create WidgetSessionsRepository
  - **Файл**: `src/repositories/WidgetSessionsRepository.js`
  - **Методы**:
    - `create(widgetId, sessionId, metadata)` - Create session
    - `findBySessionId(sessionId)` - Get session
    - `incrementMessages(sessionId)` - Update message count
    - `getSessionStats(widgetId, dateRange)` - Analytics data
  - **Зависимости**: 2.1.2
  - **Усилия**: S

#### 2.3 Widget API Endpoints
- [ ] **Задача 2.3.1**: Create `/api/widget/config` endpoint
  - **Файл**: `src/api/routes/widget-api.js`
  - **Метод**: GET `/api/widget/config`
  - **Query params**: `widgetKey`
  - **Response**:
    ```json
    {
      "success": true,
      "config": {
        "companyName": "Demo Beauty Salon",
        "welcomeMessage": "Здравствуйте! Чем могу помочь?",
        "primaryColor": "#667eea",
        "theme": "dark",
        "position": "bottom-right",
        "showBranding": true
      }
    }
    ```
  - **Критерии**:
    - Widget key validation
    - Rate limiting (100 req/min per widget)
    - Cache config in Redis (5 min TTL)
  - **Зависимости**: 2.2.1
  - **Усилия**: M

- [ ] **Задача 2.3.2**: Update `/api/demo-chat` → `/api/widget/chat`
  - **Файл**: `src/api/routes/widget-api.js`
  - **Метод**: POST `/api/widget/chat`
  - **Body**:
    ```json
    {
      "widgetKey": "abc123...",
      "sessionId": "uuid-v4",
      "message": "Записаться на стрижку"
    }
    ```
  - **Критерии**:
    - Widget key authentication
    - Session validation & tracking
    - Per-widget rate limits
    - Company-specific AI context (services, staff)
    - Analytics tracking
  - **Зависимости**: 2.2.1, 2.2.2, 2.3.1
  - **Усилия**: L

---

### Phase 3: Admin Panel & Management (Week 3)
**Цель:** Создать UI для управления виджетами

#### 3.1 Admin Dashboard UI
- [ ] **Задача 3.1.1**: Create widget management page
  - **Файл**: `public/admin/widgets.html` (или React компонент)
  - **Функционал**:
    - List all widgets for company
    - Create new widget (generate widget key)
    - Edit widget settings
    - Enable/disable widget
    - Copy embed code snippet
  - **Зависимости**: None (frontend only)
  - **Усилия**: L

- [ ] **Задача 3.1.2**: Widget configuration form
  - **Поля**:
    - Company name (text)
    - Welcome message (textarea)
    - Primary/Secondary colors (color picker)
    - Theme (select: dark/light/auto)
    - Position (select: bottom-right/bottom-left)
    - Logo upload
    - Show branding (checkbox)
    - Rate limits (numbers)
  - **Критерии**:
    - Real-time preview
    - Validation (required fields, color format)
  - **Зависимости**: 3.1.1
  - **Усилия**: M

#### 3.2 Admin API Endpoints
- [ ] **Задача 3.2.1**: Create widget management endpoints
  - **Файл**: `src/api/routes/admin/widgets.js`
  - **Endpoints**:
    - GET `/api/admin/widgets` - List widgets
    - POST `/api/admin/widgets` - Create widget
    - PUT `/api/admin/widgets/:id` - Update widget
    - DELETE `/api/admin/widgets/:id` - Delete widget
    - POST `/api/admin/widgets/:id/regenerate-key` - New API key
  - **Критерии**:
    - Authentication required (admin/company owner)
    - Input validation (Zod schemas)
    - Error handling & logging
  - **Зависимости**: 2.2.1
  - **Усилия**: M

#### 3.3 Analytics Dashboard
- [ ] **Задача 3.3.1**: Create analytics API endpoints
  - **Файл**: `src/api/routes/admin/widget-analytics.js`
  - **Endpoints**:
    - GET `/api/admin/widgets/:id/stats` - Widget statistics
    - GET `/api/admin/widgets/:id/sessions` - Recent sessions
    - GET `/api/admin/widgets/:id/popular-queries` - Top queries
  - **Response Example**:
    ```json
    {
      "totalSessions": 1234,
      "totalMessages": 5678,
      "avgMessagesPerSession": 4.6,
      "topQueries": [
        { "query": "Записаться на стрижку", "count": 456 },
        { "query": "Узнать цены", "count": 234 }
      ],
      "timeline": {
        "labels": ["2025-11-20", "2025-11-21", ...],
        "sessions": [45, 67, 89, ...],
        "messages": [234, 345, 456, ...]
      }
    }
    ```
  - **Зависимости**: 2.2.2
  - **Усилия**: M

- [ ] **Задача 3.3.2**: Create analytics dashboard UI
  - **Файл**: `public/admin/widget-analytics.html`
  - **Компоненты**:
    - Key metrics cards (sessions, messages, avg)
    - Timeline chart (Chart.js или similar)
    - Top queries table
    - Session history table
  - **Зависимости**: 3.3.1
  - **Усилия**: M

---

### Phase 4: Production Hardening & Testing (Week 4)
**Цель:** Подготовить виджет к production deployment

#### 4.1 Security & Performance
- [ ] **Задача 4.1.1**: Implement CORS configuration
  - **Файл**: `src/api/middleware/cors-config.js`
  - **Критерии**:
    - Whitelist клиентских доменов
    - Proper headers (Access-Control-Allow-Origin)
    - Preflight request handling
  - **Зависимости**: None
  - **Усилия**: S

- [ ] **Задача 4.1.2**: Add CSP (Content Security Policy) headers
  - **Критерии**:
    - Allow widget loading from authorized domains
    - Restrict inline scripts (use nonce)
  - **Зависимости**: 4.1.1
  - **Усилия**: S

- [ ] **Задача 4.1.3**: Minify & bundle widget assets
  - **Tools**: Webpack, Terser, cssnano
  - **Файлы**:
    - `public/widget/dist/chatbox-widget.min.js`
    - `public/widget/dist/chatbox-widget.min.css`
  - **Критерии**:
    - < 50KB gzipped total size
    - Sourcemaps для debugging
  - **Зависимости**: Phase 1 complete
  - **Усилия**: M

- [ ] **Задача 4.1.4**: Setup CDN delivery (Cloudflare/AWS CloudFront)
  - **Критерии**:
    - Widget assets served via CDN
    - Cache headers (1 hour TTL)
    - Version management (cache busting)
  - **Зависимости**: 4.1.3
  - **Усилия**: M

#### 4.2 Testing
- [ ] **Задача 4.2.1**: Widget integration tests
  - **Файл**: `tests/integration/widget-api.test.js`
  - **Тесты**:
    - Widget config API
    - Chat message flow
    - Rate limiting enforcement
    - Session tracking
  - **Зависимости**: Phase 2 complete
  - **Усилия**: M

- [ ] **Задача 4.2.2**: Cross-browser testing
  - **Браузеры**: Chrome, Firefox, Safari, Edge
  - **Устройства**: Desktop, Mobile, Tablet
  - **Критерии**:
    - Visual consistency
    - Functional correctness
    - No console errors
  - **Зависимости**: Phase 1 complete
  - **Усилия**: M

- [ ] **Задача 4.2.3**: Load testing
  - **Tool**: k6 или Artillery
  - **Сценарии**:
    - 100 concurrent widgets
    - 1000 messages per minute
    - Spike load (0 → 500 widgets instantly)
  - **Критерии**:
    - < 200ms avg response time
    - < 1% error rate
  - **Зависимости**: Phase 2 complete
  - **Усилия**: M

#### 4.3 Documentation
- [ ] **Задача 4.3.1**: Create integration guide
  - **Файл**: `docs/WIDGET_INTEGRATION_GUIDE.md`
  - **Содержание**:
    - Quick start (copy-paste snippet)
    - Configuration options
    - Customization examples
    - Troubleshooting
  - **Зависимости**: Phase 1-3 complete
  - **Усилия**: S

- [ ] **Задача 4.3.2**: Create API documentation
  - **Файл**: `docs/WIDGET_API_REFERENCE.md`
  - **Содержание**:
    - All endpoints (config, chat, analytics)
    - Request/response formats
    - Error codes
    - Rate limits
  - **Зависимости**: Phase 2 complete
  - **Усилия**: S

---

## Risk Assessment & Mitigation

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **CSS conflicts с клиентским сайтом** | High | Medium | Использовать CSS-in-JS или строгие prefixes (`.ai-chatbox-widget *`), Shadow DOM |
| **Slow widget load time** | Medium | Low | Async loading, lazy initialization, CDN delivery, < 50KB bundle size |
| **Session hijacking** | High | Low | Secure session IDs (UUID v4), HTTPS only, rate limiting, IP validation |
| **Rate limit bypass** | Medium | Medium | Multi-layer limits (IP, session, widget), Redis-based tracking с TTL |
| **Database performance degradation** | High | Low | Indexes на frequently queried columns, connection pooling, Redis caching |
| **Widget key leaks** | High | Low | Rotate keys on request, domain validation, usage monitoring |

### Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Low adoption by clients** | High | Medium | Clear value proposition, easy 1-minute integration, good docs |
| **Support overhead** | Medium | High | Self-service admin panel, comprehensive docs, automated monitoring |
| **Pricing model unclear** | Medium | Medium | Define pricing early (free tier + paid plans), usage-based billing |
| **Competitor launches similar product** | Medium | Medium | Fast execution (4 weeks), superior UX, tight YClients integration |

---

## Success Metrics

### Technical KPIs
- **Performance**:
  - Widget load time: < 1 second (p95)
  - API response time: < 200ms (p95)
  - Widget bundle size: < 50KB gzipped
  - Uptime: 99.9%

- **Quality**:
  - Zero critical bugs in production
  - Test coverage: > 80%
  - Cross-browser compatibility: 100% (Chrome, Firefox, Safari, Edge)

### Business KPIs
- **Adoption**:
  - 10+ client integrations in first month
  - 80% retention rate after 3 months

- **Usage**:
  - 10,000+ widget sessions per month
  - 50,000+ AI-handled messages per month
  - 70%+ automation rate (no human intervention needed)

- **Revenue** (если paid):
  - $5,000+ MRR within 3 months
  - 50%+ of clients upgrade from free tier

---

## Required Resources

### Team
- **Frontend Developer**: Phase 1, 3 (2-3 weeks)
- **Backend Developer**: Phase 2, 4 (2-3 weeks)
- **QA Engineer**: Phase 4 (1 week)
- **Designer**: Phase 1, 3 (UI/UX consultation, 0.5 week)

### Infrastructure
- **CDN**: Cloudflare Free tier (or upgrade $20/mo)
- **Database**: Timeweb PostgreSQL (existing)
- **Redis**: Timeweb Redis (existing)
- **Monitoring**: Sentry (existing)

### Tools & Libraries
- **Build**: Webpack 5
- **Testing**: Jest + k6
- **Analytics**: Chart.js
- **Minification**: Terser + cssnano

---

## Dependencies

### External
- **YClients API**: For fetching company data (services, staff, schedules)
- **AI Admin v2**: For AI message processing
- **Redis**: For session management & caching
- **PostgreSQL**: For widget configs & analytics

### Internal
- **Existing Demo Chat**: Code reuse from `public/landing/index.html`
- **AI Service**: `src/services/ai-admin-v2/`
- **Rate Limiting**: Middleware from `src/api/routes/demo-chat.js`

---

## Timeline Estimate

| Phase | Duration | Team Size |
|-------|----------|-----------|
| **Phase 1**: Widget Extraction | 5 days | 1 Frontend Dev |
| **Phase 2**: Backend Multi-Tenant | 7 days | 1 Backend Dev |
| **Phase 3**: Admin Panel | 5 days | 1 Frontend Dev + 1 Backend Dev |
| **Phase 4**: Production Hardening | 5 days | 1 Backend Dev + 1 QA |

**Total:** ~4 weeks (with 1-2 devs in parallel)

---

## Next Steps

1. **Approval**: Review this plan with stakeholders
2. **Kickoff**: Assign team members to phases
3. **Phase 1 Start**: Begin widget extraction (Day 1)
4. **Weekly Sync**: Progress reviews every Friday
5. **Beta Testing**: Week 3 (select 2-3 friendly clients)
6. **Production Launch**: End of Week 4

---

## Appendix

### Example Embed Code
```html
<!-- Minimal Integration -->
<script
  src="https://ai-admin.example.com/widget/loader.js"
  data-widget-key="your-widget-key-here"
  async
></script>

<!-- Advanced Integration -->
<script>
  window.AIChatboxConfig = {
    widgetKey: 'your-widget-key-here',
    theme: 'auto', // dark/light/auto
    position: 'bottom-right',
    language: 'ru',
    minimized: true, // Start minimized
    onReady: function() {
      console.log('AI Chatbox ready!');
    },
    onMessage: function(message, response) {
      // Custom analytics tracking
      ga('send', 'event', 'Chatbox', 'message', message);
    }
  };
</script>
<script
  src="https://ai-admin.example.com/widget/loader.js"
  async
></script>
```

### Tech Stack Summary
- **Frontend**: Vanilla JS, CSS3, HTML5
- **Backend**: Node.js, Express, Prisma
- **Database**: Timeweb PostgreSQL
- **Cache**: Timeweb Redis
- **AI**: Gemini 2.5 Flash (existing)
- **Deployment**: PM2, Nginx, Xray VPN
- **Monitoring**: Sentry
