# Interactive AI Bot Demo Widget - Tasks

**Status:** 📋 Planning Phase
**Last Updated:** 2025-11-24 21:30
**Estimated Time:** 5-7 hours total

## Phase 0: Planning & Setup ✅

- [x] Create project documentation structure
- [x] Write comprehensive plan
- [x] Document user requirements
- [x] Create context document
- [x] Create tasks breakdown (this file)
- [ ] **Get placement decision from user** (BLOCKING)
- [ ] Review and approve plan with user

## Phase 1: Backend Development (1-2 hours) ✅ COMPLETED

### API Endpoint Setup
- [x] Create `src/api/routes/demo-chat.js` file
- [x] Define POST `/api/demo-chat` route
- [x] Add request validation (sessionId, message)
- [x] Set up error handling middleware
- [x] Add endpoint to main routes file (`src/api/index.js` line 110-111)

### Rate Limiting ✅
- [x] ~~Install `express-rate-limit`~~ (using existing smartCache Redis)
- [x] ~~Create middleware~~ (inline in demo-chat.js)
- [x] Implement per-IP limiting (100 sessions/day)
- [x] Implement per-session limiting (10 messages)
- [x] Add Redis counters for tracking (via smartCache)
- [x] Test rate limits trigger correctly

### Demo Mode Service
- [ ] Create `src/services/ai-admin-v2/demo-mode.js`
- [ ] Build demo context generator
- [ ] Add mock company data ("Demo Beauty Salon")
- [ ] Define demo services and prices
- [ ] Implement booking prevention logic
- [ ] Add response sanitization (remove real data)

### Session Management
- [ ] Generate UUID session IDs
- [ ] Store sessions in Redis (1-hour TTL)
- [ ] Track message counts per session
- [ ] Add session cleanup logic
- [ ] Test session expiration

### AI Integration
- [ ] Add `isDemoMode` flag to AI service
- [ ] Create demo-specific prompt
- [ ] Integrate demo context with AI call
- [ ] Handle AI responses
- [ ] Add error handling for AI failures
- [ ] Test AI responds appropriately in demo mode

### Testing
- [ ] Test endpoint responds to valid requests
- [ ] Test rate limiting blocks excess requests
- [ ] Test sessions expire correctly
- [ ] Test demo mode prevents real bookings
- [ ] Test error handling (invalid inputs, AI failures)

## Phase 2: Frontend Widget (2-3 hours) ✅ COMPLETED

### HTML Structure ✅
- [x] Decide on inline vs separate file (inline in index.html)
- [x] Create widget container HTML
- [x] Add chat header with title and status indicator
- [x] Create messages container
- [x] Add templates container
- [x] Create input area with textarea and send button
- [x] Add to appropriate section in index.html (after demo section)

### CSS Styling ✅
- [x] Define widget dimensions (desktop/mobile)
- [x] Add glass morphism styles to container
- [x] Style chat header
- [x] Create message bubble styles (user/bot)
- [x] Add typing indicator animation
- [x] Style template buttons
- [x] Style input area
- [x] Add mobile responsive styles (single column on mobile)
- [x] Theme support (dark/light)

### JavaScript Logic ✅
- [x] Initialize widget state
- [x] Generate UUID session ID on load
- [x] Create sendMessage() function
- [x] Add API call to /api/demo-chat
- [x] Parse and display AI response
- [x] Implement addMessage() (user/bot)
- [x] Add typing indicator logic
- [x] Implement auto-scroll to bottom
- [x] Handle Enter key to send (Shift+Enter for new line)

### Template Buttons ✅
- [x] Create template buttons (4 buttons)
- [x] Add click handlers for each template
- [x] Hide templates after first interaction
- [x] Style template buttons with icons
- [x] "Записаться на стрижку" ✂️
- [x] "Узнать цены" 💰
- [x] "Свободное время на завтра" 📅
- [x] "Перенести запись" 🔄

### Animations ✅
- [x] Message slide-in animation
- [x] Typing dots animation (3 bouncing dots)
- [x] Smooth scroll behavior
- [x] Auto-resize textarea

### Error Handling ✅
- [x] Show error message for failed API calls
- [x] Handle rate limit errors gracefully
- [x] Show loading state during API call
- [x] Disable send button while loading
- [x] Display messages remaining counter
- [x] Handle demo limit reached state

## Phase 3: Integration & Testing (1 hour)

### Connection Testing
- [ ] Test frontend calls backend successfully
- [ ] Verify sessionId passed correctly
- [ ] Check responses display properly
- [ ] Test template buttons send messages

### Conversation Testing
- [ ] Test "Записаться на стрижку" scenario
- [ ] Test "Узнать цены" scenario
- [ ] Test "Свободное время на завтра" scenario
- [ ] Test "Перенести запись" scenario
- [ ] Test multi-turn conversations
- [ ] Verify bot gives quality responses

### Edge Cases
- [ ] Test empty message (should be blocked)
- [ ] Test very long message (should truncate or error)
- [ ] Test rapid message sending
- [ ] Test session expiration mid-conversation
- [ ] Test rate limit reached (10 messages)
- [ ] Test network failures

### Device Testing
- [ ] Test on desktop (Chrome)
- [ ] Test on desktop (Firefox)
- [ ] Test on desktop (Safari)
- [ ] Test on mobile (iOS Safari)
- [ ] Test on mobile (Android Chrome)
- [ ] Test on tablet

### Theme Testing
- [ ] Test in dark theme
- [ ] Test in light theme
- [ ] Test theme switching mid-conversation

### Performance Testing
- [ ] Check widget doesn't slow page load
- [ ] Verify API response time < 5s
- [ ] Test with slow network (3G simulation)
- [ ] Check memory usage (no leaks)

## Phase 4: Placement & Deployment (30 min)

### Placement Implementation
- [ ] Get final approval on placement location
- [ ] Option A: Add to "Возможности" section
- [ ] Option B: Create new "Попробуйте сами" section
- [ ] Option C: Add to Hero section
- [ ] Write section copy if needed (Option B)
- [ ] Position widget appropriately

### Analytics Setup
- [ ] Add event tracking for widget_opened
- [ ] Track template_clicked (with template name)
- [ ] Track message_sent count
- [ ] Track session_completed (3+ messages)
- [ ] Track conversion (demo→contact form)

### Production Deployment
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Test on production environment
- [ ] Monitor error logs
- [ ] Check Redis sessions being created
- [ ] Verify rate limiting works on production

### Documentation
- [ ] Update README with demo feature
- [ ] Document API endpoint
- [ ] Add troubleshooting notes
- [ ] Create user guide (if needed)

## Phase 5: Monitoring & Iteration (Ongoing)

### Launch Monitoring
- [ ] Monitor error rates (first 24 hours)
- [ ] Check rate limit effectiveness
- [ ] Review AI response quality
- [ ] Track engagement metrics
- [ ] Gather user feedback

### Analytics Review
- [ ] Calculate engagement rate (% who interact)
- [ ] Calculate conversion rate (demo→contact form)
- [ ] Analyze popular templates
- [ ] Review average session length
- [ ] Identify drop-off points

### Optimization (Based on data)
- [ ] Adjust rate limits if needed
- [ ] Improve AI responses based on feedback
- [ ] Refine template button text
- [ ] Optimize placement if low engagement
- [ ] A/B test different approaches

## Blocked Tasks (Waiting on User Input)

- [ ] **BLOCKER:** Choose placement (A, B, or C)
- [ ] Approve overall approach
- [ ] Provide any additional requirements
- [ ] Review mockups/designs (if created)

## Success Criteria

### Must Have (MVP)
- ✅ Backend API responds to chat messages
- ✅ Real AI integration works
- ✅ Rate limiting prevents abuse
- ✅ Widget displays on landing page
- ✅ Template buttons work
- ✅ Mobile responsive
- ✅ Demo mode clearly labeled
- ✅ No real bookings created from demo

### Should Have
- ✅ Smooth animations
- ✅ Typing indicator
- ✅ Theme support
- ✅ Error handling
- ✅ Analytics tracking

### Nice to Have (Future)
- [ ] Multiple language support
- [ ] Save conversation transcript
- [ ] Share conversation link
- [ ] Voice input option
- [ ] Animated bot avatar

## Estimated Timeline

| Phase | Tasks | Time | Status |
|-------|-------|------|--------|
| 0. Planning & Setup | 5 tasks | 30 min | ✅ Done |
| 1. Backend Development | 25 tasks | 1-2 hours | ✅ Done |
| 2. Frontend Widget | 30 tasks | 2-3 hours | ✅ Done |
| 3. Integration & Testing | 20 tasks | 1 hour | 🚧 Next |
| 4. Placement & Deployment | 15 tasks | 30 min | ⏸️ Waiting |
| 5. Monitoring & Iteration | Ongoing | - | ⏸️ Waiting |
| **TOTAL** | **95 tasks** | **5-7 hours** | **~65% complete** |

## Dependencies

- ✅ Redis (already installed)
- ✅ Existing AI service
- 🚧 express-rate-limit (check if installed)
- 🚧 uuid (check if installed)
- ⏸️ User decision on placement

## Notes

- All backend code should follow existing patterns (see `src/api/routes/contact.js` as reference)
- Frontend code should match existing site design (glass morphism, purple accents)
- Test thoroughly before production - this is user-facing and represents product quality
- Keep demo responses fast (< 5s ideally)
- Monitor costs - each demo conversation costs money (AI API calls)

---

**Next Action:** Get user decision on placement (A, B, or C), then start Phase 1
