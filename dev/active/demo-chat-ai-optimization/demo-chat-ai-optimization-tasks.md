# Demo Chat AI Optimization - Task Checklist

**Last Updated:** 2025-11-26

---

## Phase 1: AI Provider Switch ⚡ (2 hours)

### Task 1.1: Update Demo Chat API
- [ ] Open `src/api/routes/demo-chat.js`
- [ ] Find line 300: `aiProvider: 'deepseek'`
- [ ] Replace with: `aiProvider: 'gemini-flash'`
- [ ] Update comment to explain why (faster + cheaper)
- [ ] Save file

**Acceptance Criteria:**
- ✅ Code changed
- ✅ Comment added
- ✅ No syntax errors

**Status:** ⏳ Todo

---

### Task 1.2: Test Locally
- [ ] Run `npm run dev`
- [ ] Open http://localhost:3000
- [ ] Send test message: "Записаться на стрижку"
- [ ] Measure response time (should be < 10s)
- [ ] Verify response quality

**Acceptance Criteria:**
- ✅ Response received
- ✅ Response time < 10s
- ✅ No errors in console

**Status:** ⏳ Todo

---

### Task 1.3: Deploy to Production
- [ ] `git add src/api/routes/demo-chat.js`
- [ ] `git commit -m "fix: switch demo chat from DeepSeek to Gemini (2.6x faster)"`
- [ ] `git push origin main`
- [ ] SSH to server: `ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219`
- [ ] `cd /opt/ai-admin && git pull origin main`
- [ ] `pm2 restart ai-admin-worker-v2`

**Acceptance Criteria:**
- ✅ Git push successful
- ✅ Server updated
- ✅ PM2 restart successful

**Status:** ⏳ Todo

---

### Task 1.4: Production Smoke Test
- [ ] Visit https://www.ai-admin.app
- [ ] Send 3 test messages
- [ ] Verify all responses received
- [ ] Check PM2 logs: `pm2 logs ai-admin-worker-v2 --lines 50`
- [ ] Verify no errors

**Acceptance Criteria:**
- ✅ All messages processed
- ✅ Response times < 10s
- ✅ No errors in logs

**Status:** ⏳ Todo

---

## Phase 2: Welcome Message Improvement 👋 (1 hour)

### Task 2.1: Update Welcome Message
- [ ] Open `public/landing/index.html`
- [ ] Find line 4069 (welcome message)
- [ ] Replace with new personalized greeting:
  ```
  👋 Привет! Я Admin AI — ваш виртуальный администратор.

  Попробуйте меня в деле! Я могу:
  • Записать клиента на услугу
  • Узнать свободное время
  • Перенести или отменить запись
  • Ответить на вопросы о ценах

  Напишите что-нибудь или выберите быстрое действие ниже 👇
  ```

**Acceptance Criteria:**
- ✅ More engaging message
- ✅ Clear value proposition
- ✅ Call-to-action

**Status:** ⏳ Todo

---

### Task 2.2: Update Quick Actions
- [ ] Open `public/landing/index.html`
- [ ] Find lines 4098-4113 (shortcut buttons)
- [ ] Update button messages to be more specific:
  - ✂️ "Записать клиента на стрижку завтра в 14:00"
  - 💰 "Сколько стоит окрашивание волос?"
  - 📅 "Какое свободное время у мастера Анны на эту неделю?"
  - 🔄 "Перенести запись клиента Ивановой на другой день"

**Acceptance Criteria:**
- ✅ More specific queries
- ✅ Better AI responses expected

**Status:** ⏳ Todo

---

### Task 2.3: Deploy Welcome Message Updates
- [ ] `git add public/landing/index.html`
- [ ] `git commit -m "feat: improve demo chat welcome message and quick actions"`
- [ ] `git push origin main`
- [ ] SSH and pull: `ssh root@46.149.70.219 "cd /opt/ai-admin && git pull"`
- [ ] Test on production site

**Acceptance Criteria:**
- ✅ Changes deployed
- ✅ Welcome message displays correctly
- ✅ Quick actions work

**Status:** ⏳ Todo

---

## Phase 3: Analytics Integration 📊 (3 hours)

### Task 3.1: Create Analytics Table
- [ ] Create file: `src/database/migrations/2025-11-27-create-demo-chat-analytics.sql`
- [ ] Add SQL schema for `demo_chat_events` table
- [ ] Include indexes on session_id, created_at, event_type

**Acceptance Criteria:**
- ✅ Migration file created
- ✅ SQL syntax valid

**Status:** ⏳ Todo

---

### Task 3.2: Run Migration
- [ ] SSH to server
- [ ] Run migration: `psql $DATABASE_URL < src/database/migrations/2025-11-27-create-demo-chat-analytics.sql`
- [ ] Verify table created: `\d demo_chat_events`

**Acceptance Criteria:**
- ✅ Migration executed
- ✅ Table exists
- ✅ Indexes created

**Status:** ⏳ Todo

---

### Task 3.3: Create Analytics Repository
- [ ] Create file: `src/repositories/DemoChatAnalyticsRepository.js`
- [ ] Implement methods:
  - `logEvent()`
  - `getSessionCount()`
  - `getPopularQueries()`
  - `getAverageResponseTime()`

**Acceptance Criteria:**
- ✅ All methods implemented
- ✅ Error handling
- ✅ Uses existing DB connection pattern

**Status:** ⏳ Todo

---

### Task 3.4: Integrate Analytics into API
- [ ] Open `src/api/routes/demo-chat.js`
- [ ] Import `DemoChatAnalyticsRepository`
- [ ] Log events:
  - `session_start` (line 280)
  - `message_sent` (line 310)
  - `error` (line 340)

**Acceptance Criteria:**
- ✅ All events logged
- ✅ No performance impact
- ✅ Error handling intact

**Status:** ⏳ Todo

---

### Task 3.5: Create Analytics Endpoint
- [ ] Create file: `src/api/routes/demo-chat-analytics.js`
- [ ] Add GET `/api/demo-chat/analytics` endpoint
- [ ] Return stats: sessions, messages, avg response time, popular queries
- [ ] Add authentication (admin only)

**Acceptance Criteria:**
- ✅ Endpoint returns correct data
- ✅ Query params validated
- ✅ Authentication required

**Status:** ⏳ Todo

---

### Task 3.6: Test Analytics
- [ ] Send 10 test messages
- [ ] Call `GET /api/demo-chat/analytics`
- [ ] Verify stats are correct
- [ ] Check database: `SELECT * FROM demo_chat_events LIMIT 20;`

**Acceptance Criteria:**
- ✅ Events logged correctly
- ✅ Stats accurate
- ✅ No errors

**Status:** ⏳ Todo

---

## Phase 4: Error Handling Improvements 💬 (1 hour)

### Task 4.1: Update Rate Limit Error Messages
- [ ] Open `src/api/routes/demo-chat.js`
- [ ] Update session limit message (line 54):
  ```
  Вы достигли лимита демо-версии (10 сообщений). Хотите протестировать без ограничений? Оставьте заявку — подключим бесплатно на 14 дней! 🎁
  ```
- [ ] Update IP limit message (line 89):
  ```
  Превышен дневной лимит (100 сообщений). Впечатлило? Подключите Admin AI для вашего салона — первый месяц бесплатно! 🚀
  ```
- [ ] Add `ctaText` and `contactUrl` fields to responses

**Acceptance Criteria:**
- ✅ More engaging error messages
- ✅ Clear CTA
- ✅ No negative tone

**Status:** ⏳ Todo

---

### Task 4.2: Update Frontend Error Handling
- [ ] Open `public/landing/index.html`
- [ ] Find `showLimitReachedMessage()` function
- [ ] Update to accept `message`, `ctaText`, `contactUrl`
- [ ] Add CTA button rendering logic

**Acceptance Criteria:**
- ✅ CTA button displays
- ✅ Click navigates to contact form
- ✅ Works for both error types

**Status:** ⏳ Todo

---

### Task 4.3: Add CTA Button CSS
- [ ] Open `public/landing/index.html`
- [ ] Add `.cta-button` styles to `<style>` section
- [ ] Include hover and active states
- [ ] Match overall design (gradient, border-radius)

**Acceptance Criteria:**
- ✅ Button looks professional
- ✅ Hover effect works
- ✅ Matches design system

**Status:** ⏳ Todo

---

### Task 4.4: Deploy Error Handling Updates
- [ ] `git add src/api/routes/demo-chat.js public/landing/index.html`
- [ ] `git commit -m "feat: improve demo chat error messages with CTAs"`
- [ ] `git push origin main`
- [ ] SSH and pull
- [ ] Test by hitting rate limits

**Acceptance Criteria:**
- ✅ Changes deployed
- ✅ Error messages display correctly
- ✅ CTA buttons work

**Status:** ⏳ Todo

---

## Phase 5: AB Testing (Optional) 🧪 (2 hours)

### Task 5.1: Create AB Test Logic
- [ ] Open `src/api/routes/demo-chat.js`
- [ ] Add AB test group assignment (50/50 Gemini vs DeepSeek)
- [ ] Store assignment in session
- [ ] Log assignment to analytics

**Acceptance Criteria:**
- ✅ 50/50 split
- ✅ Consistent per session
- ✅ Assignment logged

**Status:** ⏳ Todo (Optional)

---

### Task 5.2: Analyze AB Test Results
- [ ] Wait 7 days for data
- [ ] Query analytics table
- [ ] Compare avg response time, messages per session
- [ ] Determine winner

**Acceptance Criteria:**
- ✅ >100 sessions per group
- ✅ Statistical significance
- ✅ Clear winner

**Status:** ⏳ Todo (Optional)

---

## Progress Summary

**Total Tasks:** 22 (18 core + 4 optional)

**Completed:** 0 / 22 (0%)

**Phases:**
- ⏳ Phase 1: AI Provider Switch (4 tasks)
- ⏳ Phase 2: Welcome Message (3 tasks)
- ⏳ Phase 3: Analytics (6 tasks)
- ⏳ Phase 4: Error Handling (4 tasks)
- ⏳ Phase 5: AB Testing (2 tasks - optional)

**Next Action:** Start Phase 1, Task 1.1 (Update AI provider from DeepSeek to Gemini)
