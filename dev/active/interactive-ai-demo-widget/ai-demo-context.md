# Interactive AI Bot Demo Widget - Context

**Status:** ✅ PRODUCTION READY - All Bugs Fixed & Deployed
**Last Updated:** 2025-11-25 (z-index overlay fix)
**Phase:** Backend + Frontend complete, all bugs fixed, deployed to production

## Current State

**FULLY OPERATIONAL ✅** - Bug fixed and deployed to production

Completed:
- ✅ Backend API endpoint `/api/demo-chat` (POST)
- ✅ Backend status endpoint `/api/demo-chat/status` (GET)
- ✅ Rate limiting (10 msg/session, 100 sessions/day per IP)
- ✅ Integration with AI Admin v2 service (fixed import bug)
- ✅ Redis session management via smartCache
- ✅ Frontend chat widget UI with glass morphism design
- ✅ 4 template quick-start buttons
- ✅ Complete JavaScript logic (UUID, typing, scroll, animations)
- ✅ Mobile responsive design
- ✅ Theme support (dark/light)
- ✅ Bug fixed: AIAdminV2 import corrected (instance vs constructor)
- ✅ Deployed to production and tested
- ✅ Committed and pushed to GitHub:
  - Backend: commit 4831390
  - Frontend: commit c658db7
  - Bug fix: commit 3bf1cc4
  - Overlay shortcuts: commit 88859e3
  - Z-index fix: commit 8cf7784

## Bugs Fixed

### Bug 1: AIAdminV2 Constructor Error
**Issue:** `TypeError: AIAdminV2 is not a constructor`
**Root Cause:** In `src/services/ai-admin-v2/index.js`, the module exports an instance (`module.exports = new AIAdminV2()`), not a class. Was incorrectly trying to create `new AIAdminV2()` in demo-chat route.
**Fix:** Changed from `const AIAdminV2 = require('...'); new AIAdminV2()` to `const aiAdminV2 = require('...'); aiAdminV2.processMessage()`
**Status:** Fixed in commit 3bf1cc4, deployed to production

### Bug 2: Z-Index Overlay Issue
**Issue:** Chat messages (bot bubbles) were overlaying on top of shortcut buttons despite shortcuts having `position: absolute` and `z-index: 10`
**Root Cause:** `.chat-messages` container had no positioning context or z-index, causing individual message elements to render on the same stacking layer as `.chat-templates`
**Fix:** Added `position: relative` and `z-index: 1` to `.chat-messages` to create proper stacking hierarchy (messages: z-index 1, shortcuts: z-index 10)
**File:** `public/landing/index.html` (lines 3271-3282)
**Status:** Fixed in commit 8cf7784, deployed to production

Next Steps:
- 🚧 Monitor real user interactions
- 🚧 Gather analytics and feedback
- 🚧 Optimize based on usage patterns
- 🚧 A/B test different approaches if needed

Documentation:
- ✅ Plan document with full implementation strategy
- ✅ Context document (this file)
- ✅ Tasks document (updated with backend progress)

## User Requirements Summary

### What User Wants
"Мы можем на сайте сделать штуку, чтобы люди пробовали, как пойдет диалог с ботом... окошко для ввода текста, где люди могут написать что-то и посмотреть, как бот ответит. Например... несколько темплейт-вариантов. Чтобы они нажимали - бот им в браузере отвечал, и они строили диалог таким образом"

**Key Requirements:**
1. **Real AI** - User explicitly confirmed: "Я бы хотел реального ИИ бота" then "Давай с реальным ИИ ботом"
2. **Template buttons** - Quick start options for common scenarios
3. **Chat interface** - Similar to WhatsApp (user showed screenshot)
4. **Location** - Suggested "Как это работает" section
5. **Interactive** - Let users build actual conversation

### Why This Feature
- Show potential customers actual bot capabilities
- Reduce skepticism by letting them try before buying
- Demonstrate conversation quality and understanding
- Convert more visitors to signups

## Key Decisions

### Decision 1: Real AI vs Simulation
**Chosen:** Real AI integration
**Rationale:** User explicitly requested real AI. More authentic, shows actual quality, builds trust.
**Trade-offs:** Slower responses, needs rate limiting, costs per demo
**Implementation:** Reuse existing AI service with `isDemoMode: true` flag

### Decision 2: Demo Mode Design
**Approach:** Ephemeral sessions with mock company data
**Details:**
- Generate UUID session IDs
- Store in Redis with 1-hour TTL
- Use fake company ("Demo Beauty Salon")
- Prevent real booking creation
- Return realistic but obviously fake data

**Why:** Provides authentic conversation experience without affecting real data or confusing users about what's demo vs real.

### Decision 3: Rate Limiting Strategy
**Limits:**
- 10 messages per session (prevent lengthy chats)
- 100 sessions per day per IP (prevent abuse)
- Block suspicious patterns (rapid requests, repeated sessions)

**Why:** Protect backend resources, prevent cost overrun from AI calls, deter malicious use while allowing legitimate testing.

### Decision 4: Template Button Design
**Templates:**
1. "Записаться на стрижку" ✂️
2. "Узнать цены" 💰
3. "Свободное время на завтра" 📅
4. "Перенести запись" 🔄

**Behavior:** Show initially, hide after first interaction
**Why:** Lower barrier to entry, guide users to interesting scenarios, showcase bot's range of capabilities.

## Technical Approach

### Backend Architecture
**New Endpoint:** `POST /api/demo-chat`
**Request:**
```json
{
  "sessionId": "uuid-v4",
  "message": "user message text"
}
```

**Response:**
```json
{
  "response": "AI bot response",
  "sessionId": "uuid-v4",
  "isDemoMode": true
}
```

**Flow:**
1. Frontend generates session ID on first message
2. Backend checks rate limits (Redis counters)
3. If allowed, create demo context with fake company
4. Call AI service with `isDemoMode: true`
5. AI processes with special demo prompt
6. Return response (prevent real bookings)
7. Log interaction for analytics

### Frontend Architecture
**Component:** `DemoChatWidget`
**State:**
- `sessionId`: UUID generated client-side
- `messages`: Array of {sender, text, timestamp}
- `isTyping`: Boolean for bot typing indicator
- `templatesVisible`: Boolean (hide after first message)
- `isOpen`: Boolean widget visibility

**Styling:**
- Glass morphism container
- User messages: right-aligned, purple gradient
- Bot messages: left-aligned, dark with glow
- Smooth animations (message slide-in, typing dots)
- Mobile-responsive (fullscreen on small screens)

## Files to Create

### Backend
1. **`src/api/routes/demo-chat.js`**
   - Express route handler
   - Session validation
   - AI service integration
   - Error handling

2. **`src/services/ai-admin-v2/demo-mode.js`**
   - Demo mode context builder
   - Mock company data
   - Booking prevention logic
   - Response sanitization

3. **`src/middleware/rate-limit-demo.js`**
   - IP-based rate limiting
   - Session counting
   - Redis integration
   - Abuse detection

### Frontend
1. **`public/landing/demo-chat.js`** (or inline in index.html)
   - Widget component
   - API communication
   - State management
   - Template button handlers

2. **CSS additions to `public/landing/index.html`** (or separate file)
   - Widget container styles
   - Message bubble styles
   - Animation keyframes
   - Mobile responsiveness

3. **HTML in `public/landing/index.html`**
   - Widget structure
   - Template buttons
   - Chat interface elements

## Placement Decision Pending

**User needs to choose:**

### Option A: In "Возможности" Section
Place widget within existing features section
- Contextual
- Shows capabilities in action
- Below fold (requires scroll)

### Option B: New "Попробуйте сами" Section (RECOMMENDED)
Create dedicated section between features and pricing
- High visibility
- Clear CTA
- Optimal funnel position
- Can add compelling copy

### Option C: Hero Section
Place in hero area for maximum visibility
- First thing visitors see
- Bold, confident
- May distract from main CTA
- Risky placement

**WAITING FOR USER INPUT**

## Dependencies

- ✅ Existing AI service (ai-admin-v2)
- ✅ Redis (already in use)
- ✅ Express backend
- 🚧 express-rate-limit (may need to install)
- 🚧 uuid library (may need to install)

## Success Criteria

1. **Functionality:**
   - Widget loads without errors
   - AI responds within 5 seconds
   - Template buttons work
   - Rate limiting prevents abuse
   - Mobile fully functional

2. **UX:**
   - Smooth animations
   - Clear it's a demo
   - Intuitive interface
   - Accessible on all devices

3. **Business:**
   - 20%+ engagement rate
   - 5%+ demo→contact form conversion
   - Average 3+ messages per session

## Next Steps (After Placement Decision)

1. Install any missing dependencies
2. Create backend endpoint
3. Implement demo mode in AI service
4. Build frontend widget
5. Add template buttons
6. Test thoroughly
7. Deploy to production
8. Monitor analytics

## Important Notes

- **Demo data:** Use obviously fake company name and data
- **Clear labeling:** Show "DEMO MODE" prominently
- **No real bookings:** Hard-code prevention of actual booking creation
- **Privacy:** Don't store demo conversations long-term
- **Cost control:** Aggressive rate limiting to control AI API costs

## Questions to Resolve

1. **Placement:** Where should widget go? (Awaiting user decision)
2. **Styling details:** Exact colors, sizes? (Can match existing design)
3. **Analytics:** Which events to track? (Propose: widget_open, template_click, message_sent, session_complete)
4. **Error messages:** What to show if rate limited? (Propose: "Demo limit reached. Please contact us to try the full version.")

---

**Status:** Ready to implement once placement is decided
**Next Session:** Get placement decision, start backend development
