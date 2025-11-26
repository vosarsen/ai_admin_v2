# Demo Chat AI Optimization - Strategic Plan

**Last Updated:** 2025-11-26

---

## Executive Summary

### Current Situation
✅ **Чат-бокс УЖЕ РАБОТАЕТ на https://www.ai-admin.app** с AI интеграцией!
- Frontend: Полностью функциональный UI (`public/landing/index.html`)
- Backend: API endpoint `/api/demo-chat` (src/api/routes/demo-chat.js)
- AI: Подключен через `aiAdminV2.processMessage()`
- Rate Limiting: 10 сообщений/сессия, 100/IP/день

⚠️ **Проблема**: Используется DeepSeek вместо Gemini
- DeepSeek медленнее (24s vs 9s)
- DeepSeek дороже ($106/month vs $29/month)
- Gemini уже настроен и работает в production

### Objective
**Оптимизировать демо-чат** для лучшей производительности и снижения costs:
1. Переключить с DeepSeek на Gemini (2.6x быстрее, 3.6x дешевле)
2. Улучшить UX (приветствие, подсказки, онбординг)
3. Добавить analytics (отслеживание usage, популярные запросы)
4. Настроить AB-тестирование (Gemini vs DeepSeek)

### Business Value
- **Экономия**: $77/месяц (переход на Gemini)
- **Скорость**: ~15 секунд выигрыша на сообщение
- **Конверсия**: Лучший UX → больше trial sign-ups
- **Insights**: Данные для улучшения AI промптов

---

## Current State Analysis

### ✅ Что работает
1. **Frontend (public/landing/index.html)**:
   - Lines 4050-4130: Chat UI (messages, input, send button)
   - Lines 5462-5540: `sendDemoMessage()` function
   - Lines 5425-5700: Session management (UUID generation, localStorage)
   - Typing indicator, contextual suggestions
   - Dark/light theme support
   - Mobile responsive

2. **Backend (src/api/routes/demo-chat.js)**:
   - POST `/api/demo-chat` endpoint (lines 251-360)
   - Session limiter (10 msg/session)
   - IP limiter (100 msg/day)
   - AI integration via `aiAdminV2.processMessage()`
   - Contextual suggestions generator (lines 108-192)
   - Error handling (429, 400, 500)

3. **AI Service (src/services/ai-admin-v2/)**:
   - Two-stage processing (command extraction + response generation)
   - Context management (Redis)
   - Demo mode support (lines 293-302)

### ⚠️ Что нужно улучшить

#### 1. AI Provider (HIGH PRIORITY)
**Текущее состояние**:
```javascript
// src/api/routes/demo-chat.js:300
aiProvider: 'deepseek' // Use DeepSeek for demo chat
```

**Проблемы**:
- DeepSeek: ~24s response time (Stage 1: 12s, Stage 2: 12s)
- Gemini: ~9s response time (Stage 1: 5s, Stage 2: 4s)
- Cost: DeepSeek $106/mo vs Gemini $29/mo

**Решение**: Заменить `'deepseek'` на `'gemini-flash'`

#### 2. Welcome Message (MEDIUM PRIORITY)
**Текущее**:
```html
Здравствуйте! Я AI бот Demo Beauty Salon. Чем могу помочь?
```

**Проблемы**:
- Generic greeting (не специфично для Admin AI)
- Не объясняет что можно спросить
- Не мотивирует к действию

**Решение**: Персонализированное приветствие + примеры запросов

#### 3. Analytics (MEDIUM PRIORITY)
**Текущее**: Нет отслеживания
**Нужно**:
- Сколько сессий/день
- Популярные запросы
- Средняя длина диалога
- Conversion rate (demo → sign-up)

#### 4. Error Messages (LOW PRIORITY)
**Текущее**: Generic "Произошла ошибка"
**Нужно**: Helpful error messages с next steps

---

## Proposed Future State

### Goal
**Production-ready demo chat** с оптимальным AI provider, улучшенным UX и analytics.

### Success Criteria
- ✅ Response time < 10s (p95)
- ✅ AI costs < $30/month
- ✅ Analytics dashboard работает
- ✅ Conversion rate tracking
- ✅ Zero critical bugs

---

## Implementation Phases

### Phase 1: AI Provider Switch (Day 1 - 2 hours)
**Цель:** Переключить с DeepSeek на Gemini

#### Task 1.1: Update Demo Chat API
- [ ] **Файл**: `src/api/routes/demo-chat.js`
- [ ] **Изменение**: Line 300
  ```javascript
  // OLD:
  aiProvider: 'deepseek' // Use DeepSeek for demo chat

  // NEW:
  aiProvider: 'gemini-flash' // Use Gemini for demo chat (2.6x faster, 3.6x cheaper)
  ```
- [ ] **Критерии**:
  - Code change committed
  - No syntax errors
  - Comment explains why Gemini
- [ ] **Зависимости**: None
- [ ] **Усилия**: S (5 min)

#### Task 1.2: Test Locally
- [ ] **Шаги**:
  1. Start local server: `npm run dev`
  2. Open https://www.ai-admin.app
  3. Send test message: "Записаться на стрижку"
  4. Verify response time < 10s
  5. Verify response quality (coherent, relevant)
- [ ] **Критерии**:
  - Response received successfully
  - No errors in console
  - Response time acceptable
- [ ] **Зависимости**: 1.1
- [ ] **Усилия**: S (10 min)

#### Task 1.3: Deploy to Production
- [ ] **Команды**:
  ```bash
  git add src/api/routes/demo-chat.js
  git commit -m "fix: switch demo chat from DeepSeek to Gemini (2.6x faster, 3.6x cheaper)"
  git push origin main
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && git pull origin main && pm2 restart ai-admin-worker-v2"
  ```
- [ ] **Критерии**:
  - Git commit created
  - Deployed to production server
  - PM2 restart successful
  - No errors in logs
- [ ] **Зависимости**: 1.2
- [ ] **Усилия**: S (5 min)

#### Task 1.4: Production Smoke Test
- [ ] **Шаги**:
  1. Visit https://www.ai-admin.app
  2. Send 3 test messages
  3. Verify responses are coherent
  4. Check PM2 logs: `ssh root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 50"`
- [ ] **Критерии**:
  - All messages processed successfully
  - No errors in logs
  - Response times < 10s
- [ ] **Зависимости**: 1.3
- [ ] **Усилия**: S (10 min)

---

### Phase 2: Welcome Message Improvement (Day 1 - 1 hour)
**Цель:** Персонализировать приветствие для Admin AI

#### Task 2.1: Update Welcome Message
- [ ] **Файл**: `public/landing/index.html`
- [ ] **Изменение**: Line 4069
  ```html
  <!-- OLD -->
  Здравствуйте! Я AI бот Demo Beauty Salon. Чем могу помочь?
  Выберите один из вариантов ниже или напишите свой вопрос.

  <!-- NEW -->
  👋 Привет! Я Admin AI — ваш виртуальный администратор.

  Попробуйте меня в деле! Я могу:
  • Записать клиента на услугу
  • Узнать свободное время
  • Перенести или отменить запись
  • Ответить на вопросы о ценах

  Напишите что-нибудь или выберите быстрое действие ниже 👇
  ```
- [ ] **Критерии**:
  - Message более engaging
  - Clear value proposition
  - Call-to-action visible
- [ ] **Зависимости**: None
- [ ] **Усилия**: S (5 min)

#### Task 2.2: Update Quick Actions
- [ ] **Файл**: `public/landing/index.html`
- [ ] **Изменение**: Lines 4098-4113
  ```html
  <!-- Более понятные action names -->
  <button class="shortcut-chip" data-message="Записать клиента на стрижку завтра в 14:00">
      <span class="chip-icon">✂️</span>
      <span class="chip-text">Записать на стрижку</span>
  </button>
  <button class="shortcut-chip" data-message="Сколько стоит окрашивание волос?">
      <span class="chip-icon">💰</span>
      <span class="chip-text">Узнать цены</span>
  </button>
  <button class="shortcut-chip" data-message="Какое свободное время у мастера Анны на эту неделю?">
      <span class="chip-icon">📅</span>
      <span class="chip-text">Свободное время</span>
  </button>
  <button class="shortcut-chip" data-message="Перенести запись клиента Ивановой на другой день">
      <span class="chip-icon">🔄</span>
      <span class="chip-text">Перенести запись</span>
  </button>
  ```
- [ ] **Критерии**:
  - More specific queries (better AI response)
  - Clear expectations
- [ ] **Зависимости**: None
- [ ] **Усилия**: S (5 min)

#### Task 2.3: Deploy Welcome Message Updates
- [ ] **Команды**:
  ```bash
  git add public/landing/index.html
  git commit -m "feat: improve demo chat welcome message and quick actions"
  git push origin main
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && git pull origin main"
  ```
- [ ] **Критерии**:
  - Changes deployed
  - No broken HTML
  - Welcome message displays correctly
- [ ] **Зависимости**: 2.1, 2.2
- [ ] **Усилия**: S (5 min)

---

### Phase 3: Analytics Integration (Day 2 - 3 hours)
**Цель:** Отслеживать usage демо-чата

#### Task 3.1: Create Analytics Events Table
- [ ] **Файл**: `src/database/migrations/2025-11-27-create-demo-chat-analytics.sql`
- [ ] **Schema**:
  ```sql
  CREATE TABLE demo_chat_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- 'session_start', 'message_sent', 'error'
    session_id UUID NOT NULL,
    message_text TEXT,
    ai_response TEXT,
    response_time_ms INTEGER,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX idx_demo_chat_events_session_id ON demo_chat_events(session_id);
  CREATE INDEX idx_demo_chat_events_created_at ON demo_chat_events(created_at);
  CREATE INDEX idx_demo_chat_events_event_type ON demo_chat_events(event_type);
  ```
- [ ] **Критерии**:
  - Migration файл создан
  - Schema валидна (SQL syntax check)
- [ ] **Зависимости**: None
- [ ] **Усилия**: S (10 min)

#### Task 3.2: Run Migration
- [ ] **Команды**:
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && psql $DATABASE_URL < src/database/migrations/2025-11-27-create-demo-chat-analytics.sql"
  ```
- [ ] **Критерии**:
  - Migration executed successfully
  - Table created in database
  - Indexes created
- [ ] **Зависимости**: 3.1
- [ ] **Усилия**: S (5 min)

#### Task 3.3: Create Analytics Repository
- [ ] **Файл**: `src/repositories/DemoChatAnalyticsRepository.js`
- [ ] **Методы**:
  ```javascript
  class DemoChatAnalyticsRepository {
    async logEvent({ eventType, sessionId, messageText, aiResponse, responseTimeMs, errorMessage, ipAddress, userAgent }) {
      // INSERT INTO demo_chat_events...
    }

    async getSessionCount(dateRange) {
      // COUNT DISTINCT session_id WHERE created_at BETWEEN...
    }

    async getPopularQueries(limit = 10) {
      // SELECT message_text, COUNT(*) as count
      // GROUP BY message_text ORDER BY count DESC LIMIT...
    }

    async getAverageResponseTime(dateRange) {
      // SELECT AVG(response_time_ms)...
    }
  }
  ```
- [ ] **Критерии**:
  - All methods implemented
  - Uses Prisma или pg (consistent with existing repos)
  - Error handling
- [ ] **Зависимости**: 3.2
- [ ] **Усилия**: M (30 min)

#### Task 3.4: Integrate Analytics into Demo Chat API
- [ ] **Файл**: `src/api/routes/demo-chat.js`
- [ ] **Изменения**:
  ```javascript
  // Line 1: Import
  const DemoChatAnalyticsRepository = require('../../repositories/DemoChatAnalyticsRepository');
  const analytics = new DemoChatAnalyticsRepository(postgres);

  // Line 280: Log session start
  await analytics.logEvent({
    eventType: 'session_start',
    sessionId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  // Line 310: Log message sent
  const startTime = Date.now();
  const result = await aiAdminV2.processMessage(...);
  const responseTimeMs = Date.now() - startTime;

  await analytics.logEvent({
    eventType: 'message_sent',
    sessionId,
    messageText: message,
    aiResponse: result.message || result.response,
    responseTimeMs,
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  // Line 340: Log errors
  catch (error) {
    await analytics.logEvent({
      eventType: 'error',
      sessionId,
      errorMessage: error.message,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    // ... existing error handling
  }
  ```
- [ ] **Критерии**:
  - All events logged
  - No performance degradation (async logging)
  - Error handling doesn't break
- [ ] **Зависимости**: 3.3
- [ ] **Усилия**: M (20 min)

#### Task 3.5: Create Analytics Dashboard Endpoint
- [ ] **Файл**: `src/api/routes/demo-chat-analytics.js`
- [ ] **Endpoints**:
  ```javascript
  // GET /api/demo-chat/analytics
  router.get('/analytics', async (req, res) => {
    const dateRange = { start: req.query.startDate, end: req.query.endDate };

    const stats = {
      totalSessions: await analytics.getSessionCount(dateRange),
      totalMessages: await analytics.getMessageCount(dateRange),
      avgResponseTime: await analytics.getAverageResponseTime(dateRange),
      popularQueries: await analytics.getPopularQueries(10),
      timeline: await analytics.getTimeline(dateRange) // sessions per day
    };

    res.json({ success: true, stats });
  });
  ```
- [ ] **Критерии**:
  - Endpoint returns correct data
  - Query params validated
  - Authentication required (admin only)
- [ ] **Зависимости**: 3.4
- [ ] **Усилия**: M (30 min)

#### Task 3.6: Test Analytics
- [ ] **Шаги**:
  1. Send 10 demo chat messages
  2. Call `GET /api/demo-chat/analytics?startDate=2025-11-26&endDate=2025-11-27`
  3. Verify stats are correct
  4. Check database: `SELECT * FROM demo_chat_events ORDER BY created_at DESC LIMIT 20;`
- [ ] **Критерии**:
  - Events logged correctly
  - Stats calculated correctly
  - No errors
- [ ] **Зависимости**: 3.5
- [ ] **Усилия**: S (15 min)

---

### Phase 4: Error Handling Improvements (Day 2 - 1 hour)
**Цель:** Better error messages с actionable next steps

#### Task 4.1: Update Rate Limit Error Messages
- [ ] **Файл**: `src/api/routes/demo-chat.js`
- [ ] **Изменения**: Lines 51-56, 86-91
  ```javascript
  // Session limit (OLD)
  message: 'Вы достигли лимита демо-версии (10 сообщений). Пожалуйста, свяжитесь с нами для полного доступа.'

  // Session limit (NEW)
  message: 'Вы достигли лимита демо-версии (10 сообщений). Хотите протестировать без ограничений? Оставьте заявку — подключим бесплатно на 14 дней! 🎁',
  contactUrl: '#contact-section',
  ctaText: 'Попробовать бесплатно'

  // IP limit (OLD)
  message: 'Слишком много запросов с вашего IP. Попробуйте завтра или свяжитесь с нами напрямую.'

  // IP limit (NEW)
  message: 'Превышен дневной лимит запросов (100 сообщений). Впечатлило? Подключите Admin AI для вашего салона — первый месяц бесплатно! 🚀',
  contactUrl: '#contact-section',
  ctaText: 'Подключить Admin AI'
  ```
- [ ] **Критерии**:
  - Error messages более engaging
  - Clear CTA
  - No negative tone
- [ ] **Зависимости**: None
- [ ] **Усилия**: S (10 min)

#### Task 4.2: Update Frontend Error Handling
- [ ] **Файл**: `public/landing/index.html`
- [ ] **Изменения**: Lines 5526-5530
  ```javascript
  // Handle errors
  if (data.error === 'demo_limit_reached' || data.error === 'ip_limit_reached') {
      // Show error message + CTA button
      showLimitReachedMessage(data.message, data.ctaText, data.contactUrl);
  }

  // Update showLimitReachedMessage() function
  function showLimitReachedMessage(message, ctaText, contactUrl) {
      addMessage('bot', message);

      // Add CTA button after message
      const ctaButton = document.createElement('button');
      ctaButton.className = 'cta-button';
      ctaButton.textContent = ctaText || 'Связаться с нами';
      ctaButton.onclick = () => {
          window.location.href = contactUrl || '#contact-section';
      };
      // ... append button to chat
  }
  ```
- [ ] **Критерии**:
  - CTA button displays correctly
  - Click navigates to contact form
  - Button styled nicely
- [ ] **Зависимости**: 4.1
- [ ] **Усилия**: M (20 min)

#### Task 4.3: Add CSS for CTA Button
- [ ] **Файл**: `public/landing/index.html`
- [ ] **Изменение**: Add to <style> section
  ```css
  .cta-button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 12px;
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 12px;
      transition: transform 0.2s, box-shadow 0.2s;
  }

  .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
  }

  .cta-button:active {
      transform: translateY(0);
  }
  ```
- [ ] **Критерии**:
  - Button looks professional
  - Hover effect works
  - Matches overall design
- [ ] **Зависимости**: 4.2
- [ ] **Усилия**: S (5 min)

---

### Phase 5: AB Testing Setup (Optional - Day 3)
**Цель:** Compare Gemini vs DeepSeek performance

#### Task 5.1: Create AB Test Logic
- [ ] **Файл**: `src/api/routes/demo-chat.js`
- [ ] **Изменение**:
  ```javascript
  // Randomly assign 50% to Gemini, 50% to DeepSeek
  const abTestGroup = Math.random() < 0.5 ? 'gemini' : 'deepseek';
  const aiProvider = abTestGroup === 'gemini' ? 'gemini-flash' : 'deepseek';

  // Log AB test assignment
  await analytics.logEvent({
      eventType: 'ab_test_assignment',
      sessionId,
      metadata: { abTestGroup, aiProvider }
  });

  const result = await aiAdminV2.processMessage(..., { aiProvider });
  ```
- [ ] **Критерии**:
  - 50/50 split
  - Assignment logged
  - Consistent per session
- [ ] **Зависимости**: Phase 3 complete
- [ ] **Усилия**: M (30 min)

#### Task 5.2: Analyze AB Test Results
- [ ] **Query**:
  ```sql
  SELECT
      abTestGroup,
      COUNT(*) as sessions,
      AVG(response_time_ms) as avg_response_time,
      AVG(messages_per_session) as avg_messages
  FROM demo_chat_events
  WHERE event_type = 'message_sent'
  GROUP BY abTestGroup;
  ```
- [ ] **Критерии**:
  - Data collected for 7 days
  - Statistical significance (>100 sessions per group)
  - Clear winner (Gemini or DeepSeek)
- [ ] **Зависимости**: 5.1
- [ ] **Усилия**: S (analyze data)

---

## Risk Assessment & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Gemini slower than expected** | Medium | Low | Keep DeepSeek as fallback, AB test |
| **Gemini response quality lower** | High | Low | Monitor first 100 messages, rollback if needed |
| **Analytics slows down API** | Medium | Low | Async logging, DB indexes, Redis cache |
| **Database migration fails** | High | Low | Test on dev first, backup prod DB |
| **Error messages too pushy** | Low | Medium | A/B test CTA text, monitor conversion |

---

## Success Metrics

### Technical KPIs
- **Performance**:
  - Response time: < 10s (p95) ✅ Target
  - API response time: < 500ms (excluding AI) ✅ Target
  - Error rate: < 1% ✅ Target

- **Cost**:
  - AI costs: < $30/month ✅ Target (Gemini)

### Business KPIs
- **Usage**:
  - 100+ unique sessions/week
  - 500+ messages/week
  - 5+ messages/session (avg engagement)

- **Conversion**:
  - 10%+ contact form submission rate (from demo users)
  - 5%+ sign-up rate

- **Quality**:
  - 90%+ positive feedback (if we add thumbs up/down)
  - < 5% error/confusion rate

---

## Timeline Estimate

| Phase | Duration | Team Size |
|-------|----------|-----------|
| Phase 1: AI Provider Switch | 2 hours | 1 Backend Dev |
| Phase 2: Welcome Message | 1 hour | 1 Frontend Dev |
| Phase 3: Analytics | 3 hours | 1 Backend Dev |
| Phase 4: Error Handling | 1 hour | 1 Full-Stack Dev |
| Phase 5: AB Testing (Optional) | 2 hours | 1 Backend Dev |

**Total Core (1-4):** ~7 hours (1 working day)
**Total with AB:** ~9 hours (1-2 days)

---

## Required Resources

### Team
- **Backend Developer**: 1 person, 1 day (Phases 1, 3, 4)
- **Frontend Developer**: 1 person, 2 hours (Phase 2)

### Infrastructure
- **Existing**:
  - Gemini API (already configured) ✅
  - Timeweb PostgreSQL ✅
  - Timeweb Redis ✅
  - PM2 на production server ✅

- **New**:
  - None! (все уже есть)

---

## Dependencies

### External
- **Google Gemini API**: Already working ✅
- **Xray VPN**: Already configured ✅

### Internal
- **AI Admin v2 Service**: Working ✅
- **Demo Chat Frontend**: Working ✅
- **Demo Chat Backend**: Working ✅

**No blockers!** Все зависимости уже resolved.

---

## Next Steps

1. ✅ **Plan Created** (этот документ)
2. ⏳ **Get Approval** (утвердить с заказчиком)
3. ⏳ **Start Phase 1** (переключить на Gemini - 2 часа)
4. ⏳ **Monitor Results** (первые 50 сообщений)
5. ⏳ **Continue Phases 2-4** (если Phase 1 успешна)

---

## Appendix

### Example Usage

#### Before (DeepSeek):
```
User: "Записаться на стрижку"
⏱️ 24 seconds later...
Bot: "На какую дату вы хотите записаться?"
💰 Cost: ~$0.50 per 100 messages
```

#### After (Gemini):
```
User: "Записаться на стрижку"
⏱️ 9 seconds later... (2.6x faster!)
Bot: "На какую дату вы хотите записаться?"
💰 Cost: ~$0.14 per 100 messages (3.6x cheaper!)
```

### Analytics Dashboard (Future)
```
📊 Demo Chat Analytics (Last 7 days)

Sessions: 234
Messages: 1,456
Avg Response Time: 8.2s
Conversion Rate: 12.3%

Popular Queries:
1. "Записаться на стрижку" (89 times)
2. "Узнать цены" (67 times)
3. "Свободное время" (56 times)

Timeline:
Mon: 34 sessions
Tue: 45 sessions
Wed: 38 sessions
...
```
