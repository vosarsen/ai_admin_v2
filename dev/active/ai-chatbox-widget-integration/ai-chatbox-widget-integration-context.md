# AI Chatbox Widget Integration - Context

**Last Updated:** 2025-11-26

---

## Project Overview

**Goal:** Превратить существующий demo chat на landing page в полноценный встраиваемый AI виджет для сторонних сайтов клиентов.

**Status:** Planning → Ready for implementation

---

## Key Files & Locations

### Existing Components (Reuse)

#### Frontend
- **`public/landing/index.html`** (Lines ~3000-4200)
  - Demo chat UI (currently embedded in landing page)
  - Chat container, messages, input, send button
  - Shortcuts bar with quick actions
  - Typing indicator
  - Contextual suggestions system
  - Theme switcher (dark/light)
  - **Reuse for**: Widget HTML structure, styles, JavaScript logic

#### Backend API
- **`src/api/routes/demo-chat.js`**
  - POST `/api/demo-chat` endpoint
  - Session management (UUID-based)
  - Rate limiting:
    - 10 messages per session (1 hour TTL)
    - 100 messages per IP per day (24 hour TTL)
  - IP limiter middleware
  - Contextual suggestions generator
  - Integration with AI Admin v2
  - **Reuse for**: Widget API foundation, rate limiting logic

#### Services
- **`src/services/ai-admin-v2/`**
  - AI message processing (`processMessage()`)
  - Two-stage processing (command extraction + response generation)
  - Context management (Redis-based)
  - **Reuse as-is**: AI processing logic

- **`src/services/cache/smart-cache.js`**
  - Redis connection management
  - Session storage
  - **Reuse for**: Widget session caching, config caching

### New Components (To Create)

#### Widget Core
- **`public/widget/chatbox-widget.html`**
  - Standalone widget HTML template
  - Minimal structure (no landing page baggage)

- **`public/widget/css/chatbox-widget.css`**
  - Isolated styles with `.ai-chatbox-widget` prefix
  - Dark/light theme support
  - Responsive design

- **`public/widget/js/chatbox-widget.js`**
  - Vanilla JS widget logic
  - Module pattern (IIFE)
  - API integration
  - Session management
  - Message handling
  - Minimize/maximize states

- **`public/widget/loader.js`**
  - Embeddable loader script
  - Async asset injection
  - Configuration handling

#### Backend Extensions
- **`src/database/migrations/YYYY-MM-DD-create-widget-configs.sql`**
  - `widget_configs` table (widget settings, branding)
  - `widget_sessions` table (session tracking, analytics)

- **`src/repositories/WidgetConfigsRepository.js`**
  - CRUD operations for widget configs
  - Stats tracking methods

- **`src/repositories/WidgetSessionsRepository.js`**
  - Session tracking
  - Analytics queries

- **`src/api/routes/widget-api.js`**
  - GET `/api/widget/config` - Widget configuration
  - POST `/api/widget/chat` - Widget chat endpoint (replaces `/api/demo-chat`)

- **`src/api/routes/admin/widgets.js`**
  - Admin widget management endpoints
  - CRUD operations for widgets

- **`src/api/routes/admin/widget-analytics.js`**
  - Analytics API endpoints
  - Session stats, top queries, timeline data

#### Admin Panel
- **`public/admin/widgets.html`** (or React component)
  - Widget list, create, edit, delete
  - Embed code generator
  - Configuration form

- **`public/admin/widget-analytics.html`**
  - Analytics dashboard
  - Charts (Chart.js)
  - Top queries, session history

---

## Architecture Decisions

### 1. **Vanilla JS vs Framework**
**Decision:** Vanilla JavaScript
**Reasoning:**
- Zero dependencies → smaller bundle size (< 50KB)
- No version conflicts with client sites
- Faster load time
- Simpler maintenance

**Trade-off:** More manual DOM manipulation code

---

### 2. **Multi-Tenant Strategy**
**Decision:** Widget Key Authentication
**Implementation:**
- Each client gets unique `widget_key` (generated on widget creation)
- Widget key passed in all API requests (`/api/widget/chat`)
- Backend fetches company-specific config from DB
- Config cached in Redis (5 min TTL)

**Benefits:**
- Secure (keys can be rotated)
- Scalable (no hardcoded company IDs)
- Analytics-friendly (track per widget)

---

### 3. **CSS Isolation Strategy**
**Decision:** Strict prefixing + scoped styles
**Implementation:**
```css
.ai-chatbox-widget * {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.ai-chatbox-widget .message {
  /* Widget styles */
}
```

**Alternatives Considered:**
- **Shadow DOM**: Better isolation but poor browser support, harder to customize
- **CSS-in-JS**: Adds runtime overhead, larger bundle

**Trade-off:** Need careful prefix discipline, but best compatibility

---

### 4. **Session Management**
**Decision:** Client-side UUID v4 + Server-side Redis tracking
**Implementation:**
- Widget generates UUID v4 on first load
- Stores in `localStorage` (`ai-chatbox-session-id`)
- Sends with every message
- Server tracks in `widget_sessions` table + Redis cache

**Benefits:**
- Persistent across page reloads
- No cookies (GDPR-friendly)
- Analytics-ready

---

### 5. **Rate Limiting Hierarchy**
**Decision:** Three-tier limiting
**Levels:**
1. **IP-based**: 500 messages/day (global abuse prevention)
2. **Widget-based**: Configurable per widget (default: 50/session)
3. **Session-based**: Configurable TTL (default: 1 hour)

**Storage:** Redis with TTL

---

### 6. **Asset Delivery**
**Decision:** CDN + Versioned URLs
**Implementation:**
```html
<!-- Version in URL for cache busting -->
<script src="https://cdn.ai-admin.com/widget/v1.2.3/loader.min.js"></script>
```

**Benefits:**
- Fast global delivery
- Cache-friendly (1 hour TTL)
- Easy rollback (change version)

---

## Dependencies

### External Services
1. **YClients API**
   - Purpose: Fetch company services, staff, schedules
   - Used in: AI context building
   - Status: ✅ Already integrated

2. **Google Gemini 2.5 Flash**
   - Purpose: AI message processing
   - Via: Xray VPN (SOCKS5 proxy)
   - Cost: ~$29/month
   - Status: ✅ Already integrated

3. **Timeweb PostgreSQL**
   - Purpose: Widget configs, sessions, analytics
   - Connection: External SSL endpoint
   - Status: ✅ Already available

4. **Timeweb Redis**
   - Purpose: Session cache, config cache, rate limiting
   - Connection: SSH tunnel (localhost:6380)
   - Status: ✅ Already available

### Internal Dependencies
1. **AI Admin v2 Service**
   - File: `src/services/ai-admin-v2/`
   - Status: ✅ Fully functional (two-stage processing)

2. **Smart Cache Service**
   - File: `src/services/cache/smart-cache.js`
   - Status: ✅ Redis connection working

3. **Repository Pattern**
   - Files: `src/repositories/*.js`
   - Status: ⚠️ Need to create WidgetConfigsRepository, WidgetSessionsRepository

---

## Data Flow

### Widget Load Flow
```
1. Client website includes loader.js with data-widget-key="abc123"
   ↓
2. Loader.js fetches widget config from /api/widget/config?widgetKey=abc123
   ↓
3. Server validates widget key, returns config (colors, welcome message, etc.)
   ↓
4. Loader injects HTML/CSS/JS into client page
   ↓
5. Widget initializes with config, generates session ID (or loads from localStorage)
   ↓
6. Widget displays welcome message
```

### Chat Message Flow
```
1. User types message "Записаться на стрижку"
   ↓
2. Widget JavaScript sends POST /api/widget/chat
   Body: { widgetKey, sessionId, message }
   ↓
3. Server validates widget key, checks rate limits
   ↓
4. Server fetches widget config → company_id
   ↓
5. Server fetches company data (YClients API)
   ↓
6. Server calls AI Admin v2 with company context
   ↓
7. AI processes message (two-stage: extract commands → execute → generate response)
   ↓
8. Server returns AI response + suggestions
   ↓
9. Widget displays bot message + suggestions
   ↓
10. Server tracks session stats (messages_count++, last_message_at)
```

---

## Key Design Patterns

### 1. **Module Pattern** (Widget JS)
```javascript
(function(window) {
  'use strict';

  const AIChatboxWidget = {
    config: {},
    sessionId: null,

    init: function(config) {
      this.config = config;
      this.loadSession();
      this.render();
      this.attachEventListeners();
    },

    // ... methods
  };

  window.AIChatboxWidget = AIChatboxWidget;
})(window);
```

**Benefits:**
- No global scope pollution
- Encapsulation
- Easy to test

---

### 2. **Repository Pattern** (Backend)
```javascript
class WidgetConfigsRepository {
  constructor(db) {
    this.db = db;
  }

  async findByWidgetKey(widgetKey) {
    return await this.db.widget_configs.findUnique({
      where: { widget_key: widgetKey }
    });
  }

  // ... more methods
}
```

**Benefits:**
- Database abstraction
- Testable (mock DB)
- Consistent error handling

---

### 3. **Middleware Chaining** (Express)
```javascript
router.post('/widget/chat',
  authenticateWidget,      // Validate widget key
  rateLimitWidget,         // Check rate limits
  trackSession,            // Update session stats
  processMessage           // Handle chat
);
```

**Benefits:**
- Separation of concerns
- Reusable middleware
- Clean error handling

---

## Technical Constraints

1. **Bundle Size**: < 50KB gzipped (fast load on slow networks)
2. **Browser Support**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
3. **Response Time**: < 200ms p95 (excluding AI processing)
4. **Uptime**: 99.9% (Redis HA, PostgreSQL backups)
5. **Rate Limits**: Strict enforcement (prevent abuse)

---

## Security Considerations

### 1. **Widget Key Security**
- ✅ Store widget keys hashed in DB (SHA-256)
- ✅ Rotate keys on demand via admin panel
- ✅ Monitor for unusual usage patterns
- ❌ Don't log widget keys in plaintext

### 2. **CORS Configuration**
- ✅ Allow widget.js to be loaded cross-origin
- ✅ Restrict API endpoints to whitelisted domains (optional)
- ✅ Proper preflight (OPTIONS) handling

### 3. **Rate Limiting**
- ✅ Multi-layer (IP, widget, session)
- ✅ Redis-based (atomic counters with TTL)
- ✅ Graceful error messages (no 500s, only 429)

### 4. **Input Validation**
- ✅ Zod schemas for all inputs
- ✅ Max message length (500 chars)
- ✅ UUID validation (session IDs)
- ✅ Sanitize HTML in bot responses (XSS prevention)

### 5. **HTTPS Only**
- ✅ Force SSL for all API requests
- ✅ CSP headers (prevent inline scripts)

---

## Performance Optimizations

1. **Caching Strategy**:
   - Widget configs: Redis (5 min TTL)
   - Static assets: CDN (1 hour TTL)
   - API responses: No cache (real-time data)

2. **Database Indexing**:
   - `widget_configs.widget_key` (UNIQUE)
   - `widget_configs.company_id` (frequent JOIN)
   - `widget_sessions.session_id` (UUID lookups)
   - `widget_sessions.created_at` (analytics queries)

3. **Asset Optimization**:
   - Minify JS/CSS (Terser, cssnano)
   - Gzip compression (Nginx)
   - Lazy load non-critical resources

4. **Connection Pooling**:
   - PostgreSQL: Max 21 connections
   - Redis: Persistent connection per worker

---

## Testing Strategy

### Unit Tests
- Widget JavaScript (message handling, session management)
- Repositories (CRUD operations)
- Middleware (rate limiting, authentication)

### Integration Tests
- Widget API endpoints (config, chat)
- Admin API endpoints (widget management)
- Analytics endpoints (stats queries)

### E2E Tests
- Widget load on test page
- Complete chat flow (send message → receive response)
- Theme switching
- Minimize/maximize

### Load Tests
- k6 scenarios:
  - 100 concurrent widgets
  - 1000 messages/min
  - Spike load (0 → 500 widgets)

---

## Monitoring & Logging

### Metrics to Track
- Widget load time (p50, p95, p99)
- API response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Active sessions (gauge)
- Messages per minute (rate)

### Logging
- **Sentry**: Errors, exceptions
- **Console**: Info, warnings (development)
- **PM2 Logs**: Request logs (production)

### Alerts
- Error rate > 1% (10 min window)
- Response time p95 > 500ms
- Redis connection failures
- Database connection pool exhausted

---

## Open Questions

1. **Pricing Model**:
   - Free tier: 1 widget, 1000 messages/month?
   - Paid tier: Unlimited widgets, unlimited messages?
   - Usage-based billing?

2. **White-labeling**:
   - Allow clients to remove "Powered by AI Admin" branding?
   - Premium feature?

3. **Customization Limits**:
   - How much CSS customization to allow?
   - Custom fonts, animations?

4. **Multi-language Support**:
   - Start with Russian only?
   - Add English, other languages later?

---

## Next Actions

1. ✅ **Plan Created** (this document)
2. ⏳ **Stakeholder Review** (get approval to proceed)
3. ⏳ **Team Assignment** (assign devs to phases)
4. ⏳ **Phase 1 Kickoff** (start widget extraction)

---

## References

- **Demo Chat Code**: `public/landing/index.html` (lines 3000-4200, 5400-5700)
- **Demo API**: `src/api/routes/demo-chat.js`
- **AI Service**: `src/services/ai-admin-v2/`
- **Repository Pattern Examples**: `src/repositories/WebhookEventsRepository.js`
- **Database Migration Example**: `src/database/migrations/`
