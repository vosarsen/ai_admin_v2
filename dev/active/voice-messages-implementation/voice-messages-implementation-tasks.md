# Voice Messages Implementation - Task Checklist

**Last Updated:** 2025-11-20
**Status:** Planning Phase Complete

---

## 📊 Progress Overview

- **Total Tasks:** 39
- **Completed:** 4 (10%)
- **In Progress:** 0 (0%)
- **Pending:** 35 (90%)

**Current Phase:** Phase 1 - Research & Architecture Design
**Est. Completion:** TBD

---

## Phase 1: Research & Architecture Design (2-3 days)

**Phase Status:** ✅ Planning Complete | ⏳ Ready to Start
**Effort:** Medium (M)

### 1.1 Research STT/TTS Services
**Effort:** M | **Status:** ⏳ Todo

- [ ] **1.1.1** Test Google Cloud Speech-to-Text API with sample Russian audio
  - Create Google Cloud project (or use existing)
  - Enable Speech-to-Text API
  - Generate test audio samples (5-10 Russian phrases)
  - Test transcription accuracy
  - Measure latency (<3s target)

- [ ] **1.1.2** Test Google Cloud Text-to-Speech API with Russian text
  - Enable Text-to-Speech API
  - Test ru-RU-Wavenet-A voice
  - Test ru-RU-Wavenet-B voice (male alternative)
  - Compare quality and naturalness
  - Measure generation time (<2s target)

- [ ] **1.1.3** Test with WhatsApp audio formats (opus/ogg)
  - Download sample WhatsApp voice message
  - Test STT with opus format
  - Test STT with ogg format
  - Verify compatibility

- [ ] **1.1.4** Document API authentication and setup
  - Create service account
  - Generate JSON key file
  - Document authentication flow
  - Test authentication from server

**Acceptance Criteria:**
- ✅ Successfully transcribed 10+ Russian voice samples
- ✅ Generated 10+ natural-sounding Russian voice responses
- ✅ Latency measured: STT <3s, TTS <2s
- ✅ API keys and authentication documented

---

### 1.2 Design System Architecture
**Effort:** M | **Status:** ✅ Done

- [x] **1.2.1** Create detailed architecture diagram
  - Created in plan document
  - Shows message flow
  - Shows error handling flow

- [x] **1.2.2** Define message flow for voice messages
  - Documented in plan and context

- [x] **1.2.3** Design error handling and fallback strategies
  - Fallback to text on all errors
  - Documented in plan

- [x] **1.2.4** Plan audio file storage strategy
  - Temporary files in `/tmp/voice-messages/`
  - 5-minute TTL
  - Automatic cleanup

**Acceptance Criteria:**
- ✅ Architecture diagram created
- ✅ Error scenarios documented with fallback paths
- ✅ File cleanup strategy defined

---

### 1.3 Research Baileys Voice Message Handling
**Effort:** S | **Status:** ⏳ Todo

- [ ] **1.3.1** Study Baileys documentation for voice messages
  - Read message types documentation
  - Understand audio message structure

- [ ] **1.3.2** Understand message types and metadata
  - Identify voice message type
  - List all metadata fields
  - Document required fields

- [ ] **1.3.3** Test voice message download/upload APIs
  - Test downloadMediaMessage()
  - Test sending audio message
  - Document API parameters

- [ ] **1.3.4** Document required message properties
  - Create API examples
  - Document message structure

**Acceptance Criteria:**
- ✅ Can detect voice message events in Baileys
- ✅ Can download voice audio files
- ✅ Can upload audio files as voice messages
- ✅ API examples documented

---

### 1.4 Create Technical Specifications
**Effort:** M | **Status:** ✅ Done

- [x] **1.4.1** Write API contracts for new services
  - Documented in plan

- [x] **1.4.2** Define data structures and interfaces
  - Documented in plan

- [x] **1.4.3** Document configuration requirements
  - Environment variables defined
  - Config structure defined

- [x] **1.4.4** Create sequence diagrams for voice flow
  - Flow diagrams in plan

**Acceptance Criteria:**
- ✅ Technical spec document created
- ✅ All new services have defined interfaces
- ✅ Configuration options documented

---

## Phase 2: Voice Message Transcription (3-4 days)

**Phase Status:** ⏳ Not Started
**Effort:** Large (L)

### 2.1 Implement Voice Message Detector
**Effort:** M | **Status:** ⏳ Todo

- [ ] **2.1.1** Create `voice-message-detector.js`
- [ ] **2.1.2** Detect voice messages from Baileys events
- [ ] **2.1.3** Extract audio metadata (duration, mimeType, size)
- [ ] **2.1.4** Validate audio file accessibility
- [ ] **2.1.5** Add unit tests
- [ ] **2.1.6** Test with edge cases (missing metadata, invalid format)

**Files:** `src/services/voice/voice-message-detector.js`

**Acceptance Criteria:**
- ✅ Detects voice messages correctly (100% test accuracy)
- ✅ Extracts all metadata fields
- ✅ Handles edge cases
- ✅ Unit tests passing (>90% coverage)

---

### 2.2 Implement Audio File Manager
**Effort:** L | **Status:** ⏳ Todo

- [ ] **2.2.1** Create `audio-file-manager.js`
- [ ] **2.2.2** Implement audio download from WhatsApp
- [ ] **2.2.3** Handle temporary file storage in `/tmp/voice-messages/`
- [ ] **2.2.4** Implement file cleanup (TTL: 5 minutes)
- [ ] **2.2.5** Support multiple audio formats (ogg, opus, mp3)
- [ ] **2.2.6** Add error handling (download failures, disk space)
- [ ] **2.2.7** Add unit tests

**Files:** `src/services/voice/audio-file-manager.js`

**Acceptance Criteria:**
- ✅ Can download voice messages successfully
- ✅ Temporary files cleaned up after processing
- ✅ Handles download errors gracefully
- ✅ Supports all WhatsApp audio formats
- ✅ Unit tests passing

---

### 2.3 Implement Speech-to-Text Service
**Effort:** L | **Status:** ⏳ Todo

- [ ] **2.3.1** Create `speech-to-text-service.js`
- [ ] **2.3.2** Integrate Google Cloud Speech-to-Text API
- [ ] **2.3.3** Configure Russian language settings
- [ ] **2.3.4** Handle audio format conversion (if needed)
- [ ] **2.3.5** Return transcription with confidence score
- [ ] **2.3.6** Add error handling (API errors, low confidence)
- [ ] **2.3.7** Add retry logic with exponential backoff
- [ ] **2.3.8** Add unit and integration tests
- [ ] **2.3.9** Create test fixtures (sample audio files)

**Files:** `src/services/voice/speech-to-text-service.js`

**Acceptance Criteria:**
- ✅ Transcribes Russian voice messages with >95% accuracy
- ✅ Returns confidence scores
- ✅ Handles API errors with retries
- ✅ Processing time <3 seconds for 30-second audio
- ✅ Integration tests passing

---

### 2.4 Update Message Worker for Voice Detection
**Effort:** M | **Status:** ⏳ Todo

- [ ] **2.4.1** Modify `message-worker-v2.js` to detect voice messages
- [ ] **2.4.2** Route voice messages to voice processing pipeline
- [ ] **2.4.3** Add voice message logging and metrics
- [ ] **2.4.4** Handle voice processing errors
- [ ] **2.4.5** Add integration tests

**Files:** `src/workers/message-worker-v2.js`

**Acceptance Criteria:**
- ✅ Voice messages detected and routed correctly
- ✅ Text messages still processed normally
- ✅ Logs include voice message metadata
- ✅ Error handling tested

---

### 2.5 Add Configuration and Environment Variables
**Effort:** S | **Status:** ⏳ Todo

- [ ] **2.5.1** Add Google Cloud credentials setup
- [ ] **2.5.2** Add voice processing feature flag
- [ ] **2.5.3** Document environment variables
- [ ] **2.5.4** Update `.env.example`

**Files:** `.env.example`, `config/index.js`, `docs/VOICE_MESSAGES_SETUP.md`

**Acceptance Criteria:**
- ✅ `ENABLE_VOICE_MESSAGES=true/false` flag works
- ✅ `GOOGLE_CLOUD_STT_API_KEY` documented
- ✅ All config options in `.env.example`

---

## Phase 3: Voice Response Generation (3-4 days)

**Phase Status:** ⏳ Not Started
**Effort:** Large (L)

### 3.1 Implement Text-to-Speech Service
**Effort:** L | **Status:** ⏳ Todo

- [ ] **3.1.1** Create `text-to-speech-service.js`
- [ ] **3.1.2** Integrate Google Cloud Text-to-Speech API
- [ ] **3.1.3** Configure Russian neural voice
- [ ] **3.1.4** Handle long text splitting (max 60 seconds audio)
- [ ] **3.1.5** Generate audio in WhatsApp-compatible format (opus/ogg)
- [ ] **3.1.6** Add error handling and retries
- [ ] **3.1.7** Add unit and integration tests

**Files:** `src/services/voice/text-to-speech-service.js`

**Acceptance Criteria:**
- ✅ Generates natural-sounding Russian voice
- ✅ Audio quality meets WhatsApp standards
- ✅ Handles long texts (splits if needed)
- ✅ Processing time <2 seconds for 200 characters
- ✅ Integration tests passing

---

### 3.2 Extend Audio File Manager for Upload
**Effort:** M | **Status:** ⏳ Todo

- [ ] **3.2.1** Add audio upload to WhatsApp functionality
- [ ] **3.2.2** Handle audio file preparation (format, metadata)
- [ ] **3.2.3** Implement upload retries
- [ ] **3.2.4** Add cleanup after successful upload
- [ ] **3.2.5** Add integration tests

**Files:** `src/services/voice/audio-file-manager.js`

**Acceptance Criteria:**
- ✅ Can upload audio files as voice messages
- ✅ Upload succeeds with proper metadata
- ✅ Retry logic works for failed uploads
- ✅ Files cleaned up after upload

---

### 3.3 Update WhatsApp Client for Voice Messages
**Effort:** M | **Status:** ⏳ Todo

- [ ] **3.3.1** Add `sendVoiceMessage()` method to WhatsApp client
- [ ] **3.3.2** Handle voice message metadata
- [ ] **3.3.3** Add error handling
- [ ] **3.3.4** Add unit tests

**Files:** `src/integrations/whatsapp/client.js`

**Acceptance Criteria:**
- ✅ `sendVoiceMessage()` sends voice successfully
- ✅ Error handling tested
- ✅ Maintains backward compatibility

---

### 3.4 Implement Voice Preference Management
**Effort:** M | **Status:** ⏳ Todo

- [ ] **3.4.1** Add client preference: `prefer_voice_responses`
- [ ] **3.4.2** Store in Redis context
- [ ] **3.4.3** Update context service to track preference
- [ ] **3.4.4** Add preference detection logic

**Files:** `src/services/context/context-service-v2.js`

**Acceptance Criteria:**
- ✅ Client preference stored and retrieved
- ✅ Preference persists across conversations
- ✅ Default: respond in same format as received

---

### 3.5 Configure TTS Voice Selection
**Effort:** S | **Status:** ⏳ Todo

- [ ] **3.5.1** Research best Google Cloud Russian voices
- [ ] **3.5.2** Configure voice parameters (pitch, speed, volume)
- [ ] **3.5.3** Add voice selection to config
- [ ] **3.5.4** Document voice options

**Files:** `config/index.js`, `docs/VOICE_MESSAGES_SETUP.md`

**Acceptance Criteria:**
- ✅ Natural-sounding voice selected
- ✅ Voice parameters optimized
- ✅ Configurable via environment variables

---

## Phase 4: Integration & Orchestration (4-5 days)

**Phase Status:** ⏳ Not Started
**Effort:** Extra Large (XL)

### 4.1 Implement Voice Processing Orchestrator
**Effort:** XL | **Status:** ⏳ Todo

- [ ] **4.1.1** Create `voice-processing-orchestrator.js`
- [ ] **4.1.2** Orchestrate full voice message flow
- [ ] **4.1.3** Implement state management for processing steps
- [ ] **4.1.4** Add comprehensive error handling
- [ ] **4.1.5** Implement fallback strategies
- [ ] **4.1.6** Add retry logic for transient failures
- [ ] **4.1.7** Add processing metrics (Prometheus)
- [ ] **4.1.8** Add unit and integration tests

**Files:** `src/services/voice/voice-processing-orchestrator.js`

**Acceptance Criteria:**
- ✅ Full voice flow works end-to-end
- ✅ Error handling tested for all failure scenarios
- ✅ Fallback to text works correctly
- ✅ Processing metrics tracked
- ✅ Integration tests passing (>80% coverage)

---

### 4.2 Update Message Worker Integration
**Effort:** M | **Status:** ⏳ Todo

- [ ] **4.2.1** Route voice messages through orchestrator
- [ ] **4.2.2** Add voice processing to job data
- [ ] **4.2.3** Handle voice processing results
- [ ] **4.2.4** Add error logging
- [ ] **4.2.5** Update worker metrics

**Files:** `src/workers/message-worker-v2.js`

**Acceptance Criteria:**
- ✅ Voice messages processed end-to-end
- ✅ Job queue handles voice messages
- ✅ Errors logged with full context
- ✅ Metrics tracked

---

### 4.3 Add Context Tracking for Voice Messages
**Effort:** M | **Status:** ⏳ Todo

- [ ] **4.3.1** Track voice messages in conversation context
- [ ] **4.3.2** Include transcription in context history
- [ ] **4.3.3** Add voice metadata to context
- [ ] **4.3.4** Ensure AI sees transcribed text, not audio

**Files:** `src/services/ai-admin-v2/modules/context-manager-v2.js`

**Acceptance Criteria:**
- ✅ Voice messages included in conversation context
- ✅ AI processes transcribed text correctly
- ✅ Context history shows voice indicator

---

### 4.4 Implement Voice Message Rate Limiting
**Effort:** S | **Status:** ⏳ Todo

- [ ] **4.4.1** Create `voice-rate-limiter.js`
- [ ] **4.4.2** Implement rate limit logic (10 per hour)
- [ ] **4.4.3** Add rate limit error message
- [ ] **4.4.4** Store rate limit in Redis

**Files:** `src/services/voice/voice-rate-limiter.js`

**Acceptance Criteria:**
- ✅ Rate limiting enforced correctly
- ✅ Clear error message when limit exceeded
- ✅ Rate limit resets after 1 hour

---

### 4.5 Add Monitoring and Logging
**Effort:** M | **Status:** ⏳ Todo

- [ ] **4.5.1** Add Prometheus metrics for voice processing
- [ ] **4.5.2** Add detailed logging at each step
- [ ] **4.5.3** Add Sentry error tracking
- [ ] **4.5.4** Create monitoring dashboard queries

**Files:** `src/services/ai-admin-v2/modules/prometheus-metrics.js`

**Acceptance Criteria:**
- ✅ All metrics tracked correctly
- ✅ Logs include full processing trace
- ✅ Errors captured in Sentry with context

---

### 4.6 Create End-to-End Integration Tests
**Effort:** L | **Status:** ⏳ Todo

- [ ] **4.6.1** Test full voice message flow with real audio
- [ ] **4.6.2** Test error scenarios (STT fail, TTS fail, upload fail)
- [ ] **4.6.3** Test fallback to text responses
- [ ] **4.6.4** Test rate limiting
- [ ] **4.6.5** Test concurrent voice message processing

**Files:** `tests/integration/voice-messages.test.js`

**Acceptance Criteria:**
- ✅ All happy path tests passing
- ✅ All error scenarios tested
- ✅ Concurrent processing works
- ✅ Test coverage >80%

---

## Phase 5: Production Deployment & Monitoring (2-3 days)

**Phase Status:** ⏳ Not Started
**Effort:** Medium (M)

### 5.1 Setup Google Cloud Services
**Effort:** M | **Status:** ⏳ Todo

- [ ] **5.1.1** Create Google Cloud project (or use existing)
- [ ] **5.1.2** Enable Speech-to-Text API
- [ ] **5.1.3** Enable Text-to-Speech API
- [ ] **5.1.4** Create service account and credentials
- [ ] **5.1.5** Setup billing and quotas
- [ ] **5.1.6** Configure VPN/proxy access (same as Gemini)

**Acceptance Criteria:**
- ✅ APIs enabled and accessible
- ✅ Credentials working from server
- ✅ Proxy routing configured

---

### 5.2 Deploy to Staging Environment
**Effort:** M | **Status:** ⏳ Todo

- [ ] **5.2.1** Deploy voice processing services to staging
- [ ] **5.2.2** Configure environment variables
- [ ] **5.2.3** Test with real WhatsApp account
- [ ] **5.2.4** Verify audio quality
- [ ] **5.2.5** Test error scenarios

**Acceptance Criteria:**
- ✅ Voice messages work end-to-end in staging
- ✅ Audio quality acceptable
- ✅ Error handling works

---

### 5.3 Performance Testing
**Effort:** M | **Status:** ⏳ Todo

- [ ] **5.3.1** Test with high volume (100 concurrent voice messages)
- [ ] **5.3.2** Measure end-to-end latency
- [ ] **5.3.3** Test memory usage and cleanup
- [ ] **5.3.4** Test disk space management
- [ ] **5.3.5** Identify bottlenecks

**Acceptance Criteria:**
- ✅ Can handle 100 concurrent messages
- ✅ End-to-end latency <15 seconds (95th percentile)
- ✅ No memory leaks
- ✅ Disk cleanup working

---

### 5.4 Create User Documentation
**Effort:** S | **Status:** ⏳ Todo

- [ ] **5.4.1** Create user guide for voice messages
- [ ] **5.4.2** Add FAQ section
- [ ] **5.4.3** Document limitations
- [ ] **5.4.4** Create troubleshooting guide

**Files:** `docs/features/VOICE_MESSAGES.md`, `docs/VOICE_MESSAGES_TROUBLESHOOTING.md`

**Acceptance Criteria:**
- ✅ User guide created
- ✅ FAQ covers common questions
- ✅ Limitations clearly stated

---

### 5.5 Production Deployment
**Effort:** M | **Status:** ⏳ Todo

- [ ] **5.5.1** Create feature branch `feature/voice-messages`
- [ ] **5.5.2** Code review with checklist
- [ ] **5.5.3** Merge to main
- [ ] **5.5.4** Deploy to production with feature flag OFF
- [ ] **5.5.5** Enable for test phone number (89686484488)
- [ ] **5.5.6** Monitor logs and metrics
- [ ] **5.5.7** Gradual rollout (10% → 50% → 100%)

**Acceptance Criteria:**
- ✅ Feature deployed behind flag
- ✅ Test phone works correctly
- ✅ No errors in production logs
- ✅ Gradual rollout plan executed

---

### 5.6 Monitoring and Optimization
**Effort:** M | **Status:** ⏳ Todo

- [ ] **5.6.1** Setup Grafana dashboard for voice metrics
- [ ] **5.6.2** Configure alerts (error rate >2%, latency >20s)
- [ ] **5.6.3** Monitor costs (should be <$10/month)
- [ ] **5.6.4** Collect user feedback
- [ ] **5.6.5** Iterate based on metrics

**Acceptance Criteria:**
- ✅ Dashboard created with key metrics
- ✅ Alerts configured and tested
- ✅ Cost tracking active
- ✅ Feedback collection process defined

---

### 5.7 Create Development Diary Entry
**Effort:** S | **Status:** ⏳ Todo

- [ ] **5.7.1** Document implementation journey
- [ ] **5.7.2** Include lessons learned
- [ ] **5.7.3** Document final architecture
- [ ] **5.7.4** Add performance benchmarks

**Files:** `docs/03-development-diary/YYYY-MM-DD-voice-messages-implementation.md`

**Acceptance Criteria:**
- ✅ Diary entry created

---

## 📈 Progress Tracking

### Weekly Goals

**Week 1:**
- Complete Phase 1 (Research & Architecture)
- Start Phase 2 (Voice Transcription)

**Week 2:**
- Complete Phase 2 (Voice Transcription)
- Start Phase 3 (Voice Generation)

**Week 3:**
- Complete Phase 3 (Voice Generation)
- Complete Phase 4 (Integration)

**Week 4:**
- Complete Phase 5 (Deployment)
- Monitor and iterate

---

## 🚀 Quick Commands

```bash
# Start work
cd /Users/arbakvoskanyan/Documents/GitHub/ai_admin_v2
git checkout -b feature/voice-messages-implementation

# Run tests
npm run test:unit
npm run test:integration

# Deploy
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin
git pull origin main
pm2 restart all
```

---

**Last task update:** 2025-11-20
**Next review:** After Phase 1 completion
