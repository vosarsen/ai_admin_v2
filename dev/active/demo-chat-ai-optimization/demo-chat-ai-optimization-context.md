# Demo Chat AI Optimization - Context

**Last Updated:** 2025-11-26

---

## Project Overview

**Current State:** ✅ **Демо-чат УЖЕ РАБОТАЕТ с AI на https://www.ai-admin.app**

**Problem:** Используется DeepSeek вместо Gemini (медленнее, дороже)

**Goal:** Оптимизировать демо-чат для лучшей производительности и UX

---

## Key Discovery

### What I Found
Демо-чат **полностью функционален** и интегрирован с AI:
- ✅ Frontend: Complete chat UI с messages, input, quick actions
- ✅ Backend: API endpoint `/api/demo-chat` working
- ✅ AI Integration: `aiAdminV2.processMessage()` active
- ✅ Rate Limiting: 10 msg/session, 100 msg/IP/day
- ✅ Session Management: UUID-based via localStorage

### The Issue
**Line 300 in `src/api/routes/demo-chat.js`:**
```javascript
aiProvider: 'deepseek' // Use DeepSeek for demo chat
```

**Impact:**
- DeepSeek: ~24s response time (slow!)
- Gemini: ~9s response time (2.6x faster!)
- Cost: DeepSeek $106/mo vs Gemini $29/mo (3.6x cheaper!)

**Solution:** Change `'deepseek'` → `'gemini-flash'` (one-line fix!)

---

## Key Files

### Frontend
**`public/landing/index.html`**

#### Chat UI (Lines 4050-4130)
```html
<!-- Chat Container -->
<div class="chat-container">
    <!-- Chat Header -->
    <div class="chat-header">
        <div class="chat-title">Admin AI Бот</div>
        <div class="chat-status">
            <span class="status-indicator"></span>
            <span class="status-text">Онлайн</span>
        </div>
    </div>

    <!-- Chat Messages -->
    <div class="chat-messages" id="demoMessages">
        <div class="message bot">
            <div class="message-bubble">
                <div class="message-content">
                    Здравствуйте! Я AI бот Demo Beauty Salon. Чем могу помочь?
                    ⬅️ TODO: Update this message (Phase 2)
                </div>
            </div>
        </div>
    </div>

    <!-- Typing Indicator -->
    <div class="typing-indicator" id="demoTyping">
        <div class="typing-bubble">
            <div class="typing-dots">...</div>
        </div>
    </div>

    <!-- Chat Input -->
    <div class="chat-input-area">
        <textarea id="demoInput" placeholder="Напишите ваш вопрос..."></textarea>
        <button id="demoSend">Send</button>
    </div>
</div>
```

#### Quick Actions (Lines 4098-4113)
```html
<div class="shortcuts-list" id="shortcutsList">
    <button class="shortcut-chip" data-message="Записаться на стрижку">
        <span class="chip-icon">✂️</span>
        <span class="chip-text">Записаться на стрижку</span>
    </button>
    <!-- TODO: Make messages more specific (Phase 2) -->
    ...
</div>
```

#### JavaScript Logic (Lines 5462-5540)
```javascript
// Send message function
async function sendDemoMessage(message) {
    if (!message.trim() || isProcessing) return;

    // Add user message to UI
    addMessage('user', message);

    // Show typing indicator
    demoTyping.classList.add('active');

    try {
        // Call API
        const response = await fetch('/api/demo-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: demoSessionId,  // UUID v4 from localStorage
                message: message
            })
        });

        const data = await response.json();

        // Hide typing indicator
        demoTyping.classList.remove('active');

        if (data.success) {
            // Add bot response
            addMessage('bot', data.response);

            // Update contextual suggestions
            if (data.suggestions) {
                updateSuggestions(data.suggestions);
            }
        } else {
            // Handle errors (rate limits, etc.)
            if (data.error === 'demo_limit_reached') {
                showLimitReachedMessage(data.message);
                // TODO: Add CTA button (Phase 4)
            }
        }
    } catch (error) {
        console.error('Demo chat error:', error);
        addMessage('bot', 'Не удалось отправить сообщение.');
    }
}
```

---

### Backend
**`src/api/routes/demo-chat.js`**

#### Rate Limiters (Lines 25-106)
```javascript
// Session Limiter: 10 messages per session (1 hour TTL)
const sessionLimiter = async (req, res, next) => {
    const { sessionId } = req.body;
    const key = `demo:session:${sessionId}:count`;
    const count = await redis.get(key) || 0;

    if (parseInt(count) >= 10) {
        return res.status(429).json({
            success: false,
            error: 'demo_limit_reached',
            message: 'Вы достигли лимита демо-версии (10 сообщений).',
            contactUrl: '#contact-section'
            // TODO: Add ctaText (Phase 4)
        });
    }

    await redis.setex(key, 3600, parseInt(count) + 1);
    next();
};

// IP Limiter: 100 messages per IP per day (24 hour TTL)
const ipLimiter = async (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const key = `demo:ip:${ip}:daily`;
    const count = await redis.get(key) || 0;

    if (parseInt(count) >= 100) {
        return res.status(429).json({
            success: false,
            error: 'ip_limit_reached',
            message: 'Слишком много запросов с вашего IP.',
            contactUrl: '#contact-section'
            // TODO: Add ctaText (Phase 4)
        });
    }

    if (parseInt(count) === 0) {
        await redis.setex(key, 86400, 1);
    } else {
        await redis.incr(key);
    }

    next();
};
```

#### Demo Chat Endpoint (Lines 251-360)
```javascript
router.post('/demo-chat',
  ipLimiter,
  sessionLimiter,
  [
    body('sessionId').trim().notEmpty().isUUID(4),
    body('message').trim().notEmpty().isLength({ max: 500 })
  ],
  async (req, res) => {
    const { sessionId, message } = req.body;

    // Format session as phone number for context management
    const demoPhone = `demo_${sessionId}`;

    // 🚨 THE PROBLEM IS HERE (Line 300):
    const result = await aiAdminV2.processMessage(
        message,
        demoPhone,
        DEMO_COMPANY_ID,  // 999999
        {
          isDemoMode: true,
          demoCompanyData: DEMO_COMPANY_DATA,
          aiProvider: 'deepseek'  // ⬅️ TODO: Change to 'gemini-flash'
        }
    );

    // Get messages remaining
    const count = await redis.get(`demo:session:${sessionId}:count`) || 0;
    const messagesRemaining = Math.max(0, 10 - parseInt(count));

    // Return response
    res.json({
        success: true,
        response: result.message || result.response || result,
        sessionId,
        isDemoMode: true,
        messagesRemaining,
        suggestions: generateSuggestions(message, result) // Contextual
    });
  }
);
```

#### Contextual Suggestions Generator (Lines 108-192)
```javascript
function generateSuggestions(userMessage, botResponse) {
    const lowerMessage = userMessage.toLowerCase();
    const lowerResponse = botResponse.toLowerCase();

    // If user asked about booking/appointment
    if (lowerMessage.includes('запис') || lowerMessage.includes('хочу')) {
        return [
            "Стрижка",
            "Окрашивание",
            "Маникюр",
            "Узнать цены на все услуги"
        ];
    }

    // If bot is asking about time/date
    if (lowerResponse.includes('какое время') || lowerResponse.includes('когда')) {
        return [
            "Завтра утром",
            "Завтра вечером",
            "Послезавтра",
            "Свободное время на неделю"
        ];
    }

    // Default suggestions
    return [
        "Записаться на стрижку",
        "Узнать цены",
        "Свободное время на завтра",
        "Перенести запись"
    ];
}
```

---

### AI Service
**`src/services/ai-admin-v2/`**

#### Entry Point
```javascript
// src/services/ai-admin-v2/index.js
async function processMessage(message, phone, companyId, options = {}) {
    const { isDemoMode, demoCompanyData, aiProvider } = options;

    // Demo mode handling
    if (isDemoMode) {
        context.company = demoCompanyData;
        context.phone = phone; // demo_uuid
    }

    // Two-stage processing
    const result = await twoStageProcessor.processTwoStage(
        message,
        context,
        aiService,
        aiProvider  // 'deepseek' or 'gemini-flash'
    );

    return result;
}
```

#### Two-Stage Processor
**`src/services/ai-admin-v2/modules/two-stage-processor.js`**

Lines 56-59: Stage 1 (Command Extraction)
```javascript
const commandsResponse = await aiService.callAI(
    commandPromptText,
    { message, promptName: 'two-stage-command' },
    aiProvider  // Uses passed provider
);
```

Lines 141-144: Stage 2 (Response Generation)
```javascript
const finalResponse = await aiService.callAI(
    responsePromptText,
    { message, promptName: 'two-stage-response' },
    aiProvider  // Uses passed provider
);
```

#### AI Service Wrapper
**`src/services/ai-service.js`**

```javascript
async function callAI(prompt, context, provider = 'gemini-flash') {
    if (provider === 'deepseek') {
        return await deepseekService.chat(prompt, context);
    } else if (provider === 'gemini-flash') {
        return await geminiService.chat(prompt, context);
    }
}
```

---

## Configuration

### Demo Company Data
**`src/api/routes/demo-chat.js` Lines 9-23:**
```javascript
const DEMO_COMPANY_ID = 999999; // Special company ID

const DEMO_COMPANY_DATA = {
  name: "Demo Beauty Salon",
  services: [
    { id: 1, title: "Стрижка", price: 1500 },
    { id: 2, title: "Окрашивание", price: 3000 },
    { id: 3, title: "Маникюр", price: 1200 },
    { id: 4, title: "Педикюр", price: 1500 }
  ],
  staff: [
    { id: 1, name: "Анна Мастер" },
    { id: 2, name: "Ольга Стилист" }
  ]
};
```

### Rate Limits
- **Session Limit**: 10 messages per session (1 hour TTL)
- **IP Limit**: 100 messages per IP per day (24 hour TTL)
- **Message Length**: Max 500 characters
- **Storage**: Redis keys `demo:session:{uuid}:count` and `demo:ip:{ip}:daily`

### Session Management
- **ID Generation**: UUID v4 via `crypto.randomUUID()` (frontend)
- **Storage**: `localStorage.getItem('demo-session-id')`
- **Format**: `demo_{uuid}` when passing to AI service
- **Persistence**: Survives page reloads

---

## Architecture Decisions

### 1. Why Gemini over DeepSeek?
**Performance:**
- Gemini: 9s avg response time (Stage 1: 5s, Stage 2: 4s)
- DeepSeek: 24s avg response time (Stage 1: 12s, Stage 2: 12s)
- **2.6x faster** with Gemini

**Cost:**
- Gemini: $29/month (via Xray VPN)
- DeepSeek: $106/month
- **$77/month savings** (3.6x cheaper)

**Quality:**
- Both use same prompts (two-stage processing)
- Comparable response quality
- Gemini already tested in production

**Infrastructure:**
- Gemini already configured ✅
- Xray VPN already running ✅
- No additional setup needed

**Decision:** Switch to Gemini (no-brainer)

---

### 2. Demo Mode Design
**Isolated Environment:**
- Separate company ID (999999)
- Fake company data (services, staff)
- No real YClients API calls
- Prevents pollution of production data

**Context Isolation:**
- Session ID format: `demo_{uuid}` (not real phone number)
- Redis keys prefixed with `demo:` (easy cleanup)
- No booking records created in database
- Pure AI simulation

---

### 3. Rate Limiting Strategy
**Two-Tier Approach:**
1. **Session-based** (10 msg/session):
   - Prevents single user abuse
   - Encourages sign-up for full access
   - Fair usage policy

2. **IP-based** (100 msg/day):
   - Prevents bot attacks
   - Multiple users behind same IP (office/cafe)
   - Daily reset

**Storage:**
- Redis with TTL (auto-expiry)
- Atomic operations (INCR, SETEX)
- No database writes needed

---

### 4. Contextual Suggestions
**Dynamic Generation:**
- Analyzes user message + bot response
- Suggests relevant next actions
- Improves engagement

**Examples:**
- After booking question → Show service options
- After time slots shown → Suggest time choices
- After booking confirmed → Suggest other services

**Benefits:**
- Guides user through conversation
- Reduces typing (mobile-friendly)
- Increases demo completion rate

---

## Data Flow

### User Sends Message
```
1. User types "Записаться на стрижку" in chat input
   ↓
2. Frontend: sendDemoMessage() called
   ↓
3. Frontend: UUID session ID retrieved from localStorage (or generated)
   ↓
4. Frontend: POST /api/demo-chat { sessionId, message }
   ↓
5. Backend: ipLimiter checks IP limit (100/day)
   ↓
6. Backend: sessionLimiter checks session limit (10/session)
   ↓
7. Backend: Validation (UUID format, message length)
   ↓
8. Backend: aiAdminV2.processMessage() called with aiProvider='deepseek'
   ↓
9. AI Service: Two-stage processing
   - Stage 1: Extract commands (e.g., SEARCH_SLOTS) [~12s with DeepSeek]
   - Execute commands (fake data, no real API calls)
   - Stage 2: Generate natural response [~12s with DeepSeek]
   ↓
10. Backend: Generate contextual suggestions based on message + response
   ↓
11. Backend: Return { success, response, suggestions, messagesRemaining }
   ↓
12. Frontend: addMessage('bot', response)
   ↓
13. Frontend: updateSuggestions(suggestions)
   ↓
14. User sees bot response + suggestion chips
```

### Rate Limit Hit
```
1. User sends 11th message in same session
   ↓
2. Backend: sessionLimiter detects count >= 10
   ↓
3. Backend: Return 429 { error: 'demo_limit_reached', message: '...' }
   ↓
4. Frontend: showLimitReachedMessage() displays error
   ↓
5. User sees message + contact form link (no CTA button yet - TODO Phase 4)
```

---

## Performance Characteristics

### Current (DeepSeek)
- **Total Response Time**: ~24 seconds
  - Stage 1 (Command Extraction): ~12s
  - Command Execution: ~0.01s (fake data)
  - Stage 2 (Response Generation): ~12s
- **Cost**: $106/month
- **User Experience**: Slow, frustrating wait

### After Optimization (Gemini)
- **Total Response Time**: ~9 seconds
  - Stage 1: ~5s
  - Command Execution: ~0.01s
  - Stage 2: ~4s
- **Cost**: $29/month
- **User Experience**: Acceptable, modern chat app speed

### Metrics to Track (Phase 3)
- Average response time (should be < 10s)
- Error rate (should be < 1%)
- Session completion rate (messages per session)
- Conversion rate (demo → sign-up)

---

## Open Questions

### 1. Analytics Scope
**Question:** What metrics are most valuable?
**Options:**
- A) Basic: sessions, messages, avg response time
- B) Advanced: + popular queries, conversion funnel, user journey
- C) Full: + heatmaps, A/B testing, cohort analysis

**Recommendation:** Start with (A), expand to (B) if useful

---

### 2. Error Message Tone
**Question:** How aggressive should CTA be in error messages?
**Options:**
- A) Soft: "Хотите попробовать без ограничений? Свяжитесь с нами"
- B) Medium: "Оставьте заявку — подключим бесплатно на 14 дней!"
- C) Hard: "Подпишитесь сейчас и получите 1 месяц бесплатно!"

**Recommendation:** Start with (B), A/B test vs (A)

---

### 3. AB Testing
**Question:** Should we run Gemini vs DeepSeek AB test?
**Pros:**
- Data-driven decision
- Quantify improvement
- Discover unexpected insights

**Cons:**
- 50% users still get slow experience
- Need 7+ days for statistical significance
- Gemini already proven faster

**Recommendation:** Skip AB test, just switch (we have enough data)

---

## Technical Constraints

### Browser Compatibility
- **Frontend**: Vanilla JS (ES6+)
- **Supported**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile**: iOS 14+, Android 10+

### Performance Targets
- **Response Time**: < 10s (p95)
- **API Response**: < 500ms (excluding AI processing)
- **Bundle Size**: N/A (inline in HTML)
- **First Paint**: < 2s (already fast)

### Security
- **Rate Limiting**: Enforced via Redis
- **Input Validation**: express-validator
- **XSS Prevention**: Text-only messages (no HTML rendering)
- **CORS**: Allowed for same-origin only

---

## Deployment Process

### Local Testing
```bash
# Start server
npm run dev

# Visit
http://localhost:3000

# Test demo chat
# Open browser console to see network requests
```

### Production Deployment
```bash
# Commit changes
git add [files]
git commit -m "fix: [description]"
git push origin main

# Deploy to server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin
git pull origin main
pm2 restart ai-admin-worker-v2

# Verify
# Visit https://www.ai-admin.app
# Send test messages
# Check logs: pm2 logs ai-admin-worker-v2 --lines 50
```

### Rollback (if needed)
```bash
# On server
cd /opt/ai-admin
git log --oneline -5  # Find previous commit hash
git reset --hard <commit-hash>
pm2 restart ai-admin-worker-v2
```

---

## Next Actions

### Immediate (Phase 1)
1. Change `aiProvider: 'deepseek'` → `'gemini-flash'` in `src/api/routes/demo-chat.js:300`
2. Test locally (verify < 10s response time)
3. Deploy to production
4. Monitor for 24 hours (check logs for errors)

### Short-term (Phase 2-4)
5. Update welcome message (more engaging)
6. Update quick actions (more specific)
7. Add analytics table + repository
8. Integrate analytics logging
9. Update error messages with CTAs

### Medium-term (Optional)
10. Create analytics dashboard UI
11. Run AB test (if decided)
12. Implement advanced analytics (popular queries, conversion funnel)

---

## References

- **Demo Chat Code**: `public/landing/index.html` (lines 4050-4200, 5400-5700)
- **Demo API**: `src/api/routes/demo-chat.js`
- **AI Service**: `src/services/ai-admin-v2/`
- **Two-Stage Processor**: `src/services/ai-admin-v2/modules/two-stage-processor.js`
- **Gemini Config**: `src/services/gemini-service.js`
- **DeepSeek Config**: `src/services/deepseek-service.js`
