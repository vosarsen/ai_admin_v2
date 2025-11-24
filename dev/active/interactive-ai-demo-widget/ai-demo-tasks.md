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

## Phase 1: Backend Development (1-2 hours)

### API Endpoint Setup
- [ ] Create `src/api/routes/demo-chat.js` file
- [ ] Define POST `/api/demo-chat` route
- [ ] Add request validation (sessionId, message)
- [ ] Set up error handling middleware
- [ ] Add endpoint to main routes file

### Rate Limiting
- [ ] Install `express-rate-limit` if needed
- [ ] Create `src/middleware/rate-limit-demo.js`
- [ ] Implement per-IP limiting (100 sessions/day)
- [ ] Implement per-session limiting (10 messages)
- [ ] Add Redis counters for tracking
- [ ] Test rate limits trigger correctly

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

## Phase 2: Frontend Widget (2-3 hours)

### HTML Structure
- [ ] Decide on inline vs separate file
- [ ] Create widget container HTML
- [ ] Add chat header with title and close button
- [ ] Create messages container
- [ ] Add templates container
- [ ] Create input area with textarea and send button
- [ ] Add to appropriate section in index.html

### CSS Styling
- [ ] Define widget dimensions (desktop/mobile)
- [ ] Add glass morphism styles to container
- [ ] Style chat header
- [ ] Create message bubble styles (user/bot)
- [ ] Add typing indicator animation
- [ ] Style template buttons
- [ ] Style input area
- [ ] Add mobile responsive styles (fullscreen on mobile)
- [ ] Theme support (dark/light)

### JavaScript Logic
- [ ] Initialize widget state
- [ ] Generate UUID session ID on load
- [ ] Implement widget open/close
- [ ] Create sendMessage() function
- [ ] Add API call to /api/demo-chat
- [ ] Parse and display AI response
- [ ] Implement addMessage() (user/bot)
- [ ] Add typing indicator logic
- [ ] Implement auto-scroll to bottom
- [ ] Handle Enter key to send

### Template Buttons
- [ ] Create template data array
- [ ] Render template buttons dynamically
- [ ] Add click handlers for each template
- [ ] Hide templates after first interaction
- [ ] Style template buttons with icons

### Animations
- [ ] Message slide-in animation
- [ ] Typing dots animation (3 bouncing dots)
- [ ] Widget open/close animation
- [ ] Smooth scroll behavior

### Error Handling
- [ ] Show error message for failed API calls
- [ ] Handle rate limit errors gracefully
- [ ] Show loading state during API call
- [ ] Disable send button while loading

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
| 1. Backend Development | 25 tasks | 1-2 hours | ⏸️ Waiting |
| 2. Frontend Widget | 30 tasks | 2-3 hours | ⏸️ Waiting |
| 3. Integration & Testing | 20 tasks | 1 hour | ⏸️ Waiting |
| 4. Placement & Deployment | 15 tasks | 30 min | ⏸️ Waiting |
| 5. Monitoring & Iteration | Ongoing | - | ⏸️ Waiting |
| **TOTAL** | **95 tasks** | **5-7 hours** | **5% complete** |

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
