# Interactive AI Bot Demo Widget - Plan

**Created:** 2025-11-24 21:30
**Status:** 📋 Planning Phase
**Goal:** Add live AI bot demo widget to landing page for visitor engagement

## Overview

Create an interactive chat widget on the landing page that allows potential customers to experience the AI bot in real-time before signing up. The widget will use the actual AI backend (not simulation) to provide authentic conversations.

## Objectives

### Primary Objectives
1. Create engaging, WhatsApp-style chat interface on landing page
2. Connect to real AI backend for authentic demo experience
3. Provide quick-start template buttons for common scenarios
4. Prevent real bookings (demo mode only)
5. Convert more visitors to customers by showing actual capabilities

### Secondary Objectives
1. Mobile-responsive design
2. Theme support (dark/light matching site)
3. Rate limiting to prevent abuse
4. Analytics tracking for popular demo scenarios
5. A/B testing capability for placement

## User Requirements

From conversation:
- **Real AI integration** (not simulation - user explicitly requested)
- **Template buttons** for quick start:
  - "Записаться на стрижку"
  - "Узнать цены"
  - "Свободное время на завтра"
  - "Перенести запись"
- **WhatsApp-inspired interface** (user showed screenshot)
- **Placement:** Suggested "Как это работает" section or similar
- **Goal:** Let visitors build conversation and see bot responses

## Implementation Strategy

### Phase 1: Backend API (1-2 hours)
**Goal:** Create demo chat endpoint with AI integration

1. Create `/api/demo-chat` endpoint
2. Add demo mode flag to AI service
3. Implement session management (ephemeral)
4. Add rate limiting (max 10 messages per session, 100 sessions/day per IP)
5. Prevent real booking creation
6. Log demo interactions for analytics

**Technical Approach:**
- Reuse existing AI service integration
- Add `isDemoMode: true` flag to context
- Generate unique session IDs (UUID)
- Store in Redis with 1-hour TTL
- Return mock company data (e.g., "Demo Beauty Salon")

### Phase 2: Frontend Widget (2-3 hours)
**Goal:** Create chat UI matching site design

1. Design chat container with glass morphism
2. Create message bubbles (user/bot styling)
3. Add typing indicator animation
4. Implement message input with send button
5. Add scroll-to-bottom behavior
6. Make fully responsive (mobile/desktop)

**Design Elements:**
- Container: Glass morphism with backdrop blur
- User messages: Right-aligned, purple gradient
- Bot messages: Left-aligned, dark with glow
- Typing dots: Animated bouncing dots
- Input: Rounded corners, icon button to send

### Phase 3: Template Buttons (30 min)
**Goal:** Quick-start conversation starters

1. Create template button grid
2. Style matching site design (purple accent)
3. Implement click handlers
4. Add icons for each template
5. Show templates on widget open, hide after first message

**Templates:**
```javascript
[
  { text: "Записаться на стрижку", icon: "✂️" },
  { text: "Узнать цены", icon: "💰" },
  { text: "Свободное время на завтра", icon: "📅" },
  { text: "Перенести запись", icon: "🔄" }
]
```

### Phase 4: Integration & Testing (1 hour)
**Goal:** Connect all pieces and verify

1. Connect frontend to backend API
2. Test AI responses for quality
3. Verify rate limiting works
4. Test mobile responsiveness
5. Test both themes
6. User acceptance testing

### Phase 5: Placement & Analytics (30 min)
**Goal:** Deploy to optimal location

1. Get user confirmation on placement
2. Implement in chosen section
3. Add analytics events (widget_opened, message_sent, template_used)
4. Deploy to production
5. Monitor for errors

## Technical Approach

### Backend Architecture
```
POST /api/demo-chat
{
  "sessionId": "uuid",
  "message": "Записаться на стрижку"
}

Response:
{
  "response": "Конечно! На какую услугу вы хотите записаться?",
  "sessionId": "uuid"
}
```

**Rate Limiting:**
- Per session: 10 messages max
- Per IP: 100 sessions per day
- Implement with Redis counters

**Demo Mode Context:**
```javascript
{
  isDemoMode: true,
  companyId: null,
  demoCompany: {
    name: "Demo Beauty Salon",
    services: ["Стрижка", "Окрашивание", "Маникюр", "Педикюр"],
    prices: { "Стрижка": 1500, "Окрашивание": 3000 }
  }
}
```

### Frontend Architecture
```html
<!-- Demo Widget Container -->
<div class="demo-chat-widget">
  <div class="chat-header">
    <span>Попробуйте бота</span>
    <button class="close-btn">×</button>
  </div>

  <div class="chat-messages">
    <!-- Messages render here -->
  </div>

  <div class="chat-templates">
    <!-- Template buttons (shown initially) -->
  </div>

  <div class="chat-input">
    <input type="text" placeholder="Напишите сообщение..." />
    <button class="send-btn">➤</button>
  </div>
</div>
```

**State Management:**
```javascript
const chatState = {
  sessionId: generateUUID(),
  messages: [],
  isTyping: false,
  templatesVisible: true
};
```

### Styling Approach
- Glass morphism: `background: rgba(255,255,255,0.05)`, `backdrop-filter: blur(10px)`
- Theme support: `body[data-theme="dark"]` and `body[data-theme="light"]` selectors
- Animations: Typing dots, message slide-in, smooth scroll
- Mobile: Fullscreen on mobile, floating widget on desktop

## Placement Options

### Option A: In "Возможности" Section
**Pros:**
- Shows capabilities in action
- Contextual placement
- Users already reading about features

**Cons:**
- Below fold (need to scroll)
- Competes with other content

### Option B: New "Попробуйте сами" Section (RECOMMENDED)
**Pros:**
- Dedicated section, clear CTA
- Between features and pricing (optimal funnel position)
- Can add compelling copy around it
- High visibility

**Cons:**
- Adds page length
- Need to write section copy

### Option C: Hero Section
**Pros:**
- Maximum visibility
- Immediate engagement
- Bold, confident placement

**Cons:**
- Risky - may distract from hero CTA
- Technical load on first view
- May overwhelm new visitors

**DECISION NEEDED FROM USER**

## Files to Create/Modify

### Backend
- `src/api/routes/demo-chat.js` - Demo chat endpoint
- `src/services/ai-admin-v2/demo-mode.js` - Demo mode logic
- `src/middleware/rate-limit-demo.js` - Rate limiting middleware

### Frontend
- `public/landing/index.html` - Widget HTML and scripts
- `public/landing/demo-chat.css` - Widget styles (or add to styles.css)
- `public/landing/demo-chat.js` - Widget JavaScript logic

## Success Metrics

1. **Engagement:** 20%+ of visitors interact with demo
2. **Conversion:** 5%+ demo users submit contact form
3. **Quality:** Average 3+ messages per demo session
4. **Performance:** < 2s response time for AI messages
5. **Stability:** < 1% error rate

## Risks and Mitigations

### Risk: AI gives poor quality responses in demo
**Mitigation:** Add demo-specific prompt tuning, test extensively

### Risk: Users expect real booking to work
**Mitigation:** Clear "This is a demo" messaging, show mock data obviously

### Risk: Abuse/spam of demo endpoint
**Mitigation:** Aggressive rate limiting, IP blocking if needed

### Risk: Performance impact on page load
**Mitigation:** Lazy load widget, load scripts only when opened

### Risk: Users confused about what is/isn't demo
**Mitigation:** Visual styling differences, clear labeling

## Timeline

**Estimated Total:** 5-7 hours
1. Backend API: 1-2 hours
2. Frontend Widget: 2-3 hours
3. Template Buttons: 30 min
4. Integration & Testing: 1 hour
5. Placement & Analytics: 30 min

**Target Completion:** Next session after placement decision

## Dependencies

- Existing AI service (ai-admin-v2)
- Redis for session storage
- Rate limiting library (express-rate-limit)
- UUID generation library

## Next Steps

1. Get user decision on placement (A, B, or C)
2. Start with backend API development
3. Create frontend widget UI
4. Integrate and test
5. Deploy to production

---

**Status:** Waiting for user decision on placement before starting implementation
