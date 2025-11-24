# Voice Messages Implementation Plan

**Last Updated:** 2025-11-20

## 📋 Executive Summary

Implement voice message support in AI Admin v2 WhatsApp bot, allowing clients to send voice messages and receive voice responses. This feature will improve accessibility, convenience, and user experience, especially for clients who prefer speaking over typing.

### Key Objectives
- ✅ Receive and transcribe incoming voice messages from WhatsApp
- ✅ Process transcribed text through AI Admin v2 pipeline
- ✅ Generate voice responses using Text-to-Speech (TTS)
- ✅ Send voice responses back to WhatsApp
- ✅ Maintain conversation context and quality
- ✅ Handle errors gracefully with fallback to text

### Success Metrics
- Voice message transcription accuracy: >95%
- Voice response generation time: <5 seconds
- End-to-end processing time: <15 seconds (transcribe + process + TTS + send)
- Error rate: <2%
- Client satisfaction with voice quality: >90%

### Timeline Estimate
- **Phase 1 (Research & Architecture):** 2-3 days
- **Phase 2 (Voice Transcription):** 3-4 days
- **Phase 3 (Text-to-Speech):** 3-4 days
- **Phase 4 (Integration & Testing):** 4-5 days
- **Phase 5 (Production Deployment):** 2-3 days
- **Total:** 14-19 days (2.8-3.8 weeks)

---

## 🔍 Current State Analysis

### Existing Architecture

**Message Flow:**
```
WhatsApp → Baileys Service → Message Queue (BullMQ) → Message Worker → AI Admin v2 → WhatsApp
```

**Key Components:**
1. **Baileys Service** (`src/integrations/whatsapp/`)
   - Handles WhatsApp connection via @whiskeysockets/baileys
   - Currently processes text messages only
   - No voice message handling implemented

2. **Message Worker** (`src/workers/message-worker-v2.js`)
   - Processes messages from BullMQ queue
   - Validates phone numbers and message content
   - Routes to AI Admin v2 service

3. **AI Admin v2** (`src/services/ai-admin-v2/`)
   - Two-stage processing with Gemini AI
   - Handles text input/output only
   - No audio processing capabilities

4. **WhatsApp Client** (`src/integrations/whatsapp/client.js`)
   - Sends text messages via Baileys API
   - No voice message sending implemented

### Current Limitations
- ❌ No voice message detection or handling
- ❌ No Speech-to-Text (STT) integration
- ❌ No Text-to-Speech (TTS) integration
- ❌ No audio file download/upload capability
- ❌ No voice message type validation

### Dependencies
- **@whiskeysockets/baileys:** ^7.0.0-rc.3 (WhatsApp integration)
- **axios:** ^1.11.0 (HTTP requests)
- **bullmq:** ^5.58.5 (Message queue)
- Node.js environment with file system access

---

## 🎯 Proposed Future State

### Enhanced Architecture

**Voice Message Flow:**
```
WhatsApp Voice → Baileys → Voice Detector → Audio Downloader → STT Service →
AI Admin v2 (text processing) → TTS Service → Audio Uploader → Baileys → WhatsApp Voice
```

### New Components

#### 1. Voice Message Detector
- Detect incoming voice messages from Baileys events
- Extract audio metadata (duration, format, size)
- Validate audio file accessibility
- **Location:** `src/services/voice/voice-message-detector.js`

#### 2. Audio File Manager
- Download voice messages from WhatsApp servers
- Upload generated audio files to WhatsApp
- Handle temporary file storage and cleanup
- Support multiple audio formats (ogg, opus, mp3)
- **Location:** `src/services/voice/audio-file-manager.js`

#### 3. Speech-to-Text Service
- Transcribe voice messages to text
- Support Russian language (primary)
- Handle background noise and audio quality issues
- Return confidence scores
- **Location:** `src/services/voice/speech-to-text-service.js`

#### 4. Text-to-Speech Service
- Generate natural-sounding voice responses
- Support Russian language with natural intonation
- Handle long text splitting (max audio duration)
- Optimize for WhatsApp voice message format
- **Location:** `src/services/voice/text-to-speech-service.js`

#### 5. Voice Processing Orchestrator
- Coordinate voice message processing pipeline
- Handle errors and fallbacks
- Manage processing state and retries
- **Location:** `src/services/voice/voice-processing-orchestrator.js`

### Technology Stack Options

#### Speech-to-Text (STT) Options

**Option 1: Google Cloud Speech-to-Text** (RECOMMENDED)
- ✅ Excellent Russian language support
- ✅ High accuracy (95-98%)
- ✅ Real-time and batch processing
- ✅ Already using Google ecosystem (Gemini)
- ✅ Supports opus/ogg (WhatsApp formats)
- 💰 Cost: $0.006/15 seconds (~$0.024/minute)
- 🔧 Easy integration with existing proxy setup
- **Estimated monthly cost (500 voice messages, 30 sec avg):** $3-5

**Option 2: OpenAI Whisper API**
- ✅ Excellent multilingual support
- ✅ Very high accuracy
- ✅ Simple API
- ❌ More expensive: $0.006/minute
- ❌ Requires separate API key
- 💰 **Estimated monthly cost:** $5-7

**Option 3: Yandex SpeechKit**
- ✅ Best Russian language support (native)
- ✅ Lower cost for Russian: $0.0016/15 sec
- ❌ Russia-based service (compliance risk)
- ❌ Requires separate account
- 💰 **Estimated monthly cost:** $1-2

**Recommendation:** **Google Cloud Speech-to-Text**
- Synergy with existing Gemini integration
- Good cost/quality balance
- Same proxy infrastructure
- Reliable and proven

#### Text-to-Speech (TTS) Options

**Option 1: Google Cloud Text-to-Speech** (RECOMMENDED)
- ✅ Natural-sounding Russian voices
- ✅ Neural voices (WaveNet) available
- ✅ Good prosody and intonation
- ✅ Same ecosystem as STT
- ✅ Multiple voice options
- 💰 Cost: $4/1M characters (Neural), $16/1M characters (WaveNet)
- 🔧 Consistent with existing infrastructure
- **Estimated monthly cost (500 responses, 200 chars avg):** $0.40-1.60

**Option 2: ElevenLabs**
- ✅ Best quality voices
- ✅ Very natural intonation
- ❌ More expensive: $22/month (starter)
- ❌ API rate limits
- 💰 **Estimated monthly cost:** $22-30

**Option 3: Yandex SpeechKit**
- ✅ Best Russian pronunciation
- ✅ Lower cost: $0.0016/1000 chars
- ❌ Russia-based service
- ❌ Separate integration
- 💰 **Estimated monthly cost:** $0.16

**Recommendation:** **Google Cloud Text-to-Speech (Neural)**
- Best cost/quality ratio
- Consistent infrastructure
- Reliable and scalable

### Total Estimated Monthly Cost
- **STT:** $3-5/month (500 messages)
- **TTS:** $0.40-1.60/month (500 responses)
- **Total:** ~$3.40-6.60/month
- **Per voice interaction:** ~$0.007-0.013

---

## 📐 Implementation Phases

### Phase 1: Research & Architecture Design (2-3 days)

**Objective:** Research technologies, design architecture, and create detailed technical specifications.

#### Tasks

**1.1 Research STT/TTS Services** (Effort: M)
- [ ] Test Google Cloud Speech-to-Text API with sample Russian audio
- [ ] Test Google Cloud Text-to-Speech API with Russian text
- [ ] Compare audio quality and latency
- [ ] Test with WhatsApp audio formats (opus/ogg)
- [ ] Document API authentication and setup

**Acceptance Criteria:**
- Successfully transcribed 10+ Russian voice samples
- Generated 10+ natural-sounding Russian voice responses
- Latency measured: STT <3s, TTS <2s
- API keys and authentication documented

**1.2 Design System Architecture** (Effort: M)
- [ ] Create detailed architecture diagram
- [ ] Define message flow for voice messages
- [ ] Design error handling and fallback strategies
- [ ] Plan audio file storage strategy (temporary files)
- [ ] Design database schema changes (if needed)

**Acceptance Criteria:**
- Architecture diagram created in `docs/01-architecture/voice-messages/`
- Error scenarios documented with fallback paths
- File cleanup strategy defined

**1.3 Research Baileys Voice Message Handling** (Effort: S)
- [ ] Study Baileys documentation for voice messages
- [ ] Understand message types and metadata
- [ ] Test voice message download/upload APIs
- [ ] Document required message properties

**Acceptance Criteria:**
- Can detect voice message events in Baileys
- Can download voice audio files
- Can upload audio files as voice messages
- API examples documented

**1.4 Create Technical Specifications** (Effort: M)
- [ ] Write API contracts for new services
- [ ] Define data structures and interfaces
- [ ] Document configuration requirements
- [ ] Create sequence diagrams for voice flow

**Acceptance Criteria:**
- Technical spec document created
- All new services have defined interfaces
- Configuration options documented

---

### Phase 2: Voice Message Transcription (3-4 days)

**Objective:** Implement voice message detection, download, and transcription to text.

#### Tasks

**2.1 Implement Voice Message Detector** (Effort: M)
- [ ] Create `voice-message-detector.js`
- [ ] Detect voice messages from Baileys events
- [ ] Extract audio metadata (duration, mimeType, size)
- [ ] Validate audio file accessibility
- [ ] Add unit tests

**Acceptance Criteria:**
- Detects voice messages correctly (100% accuracy on test cases)
- Extracts all metadata fields
- Handles edge cases (missing metadata, invalid format)
- Unit tests passing (>90% coverage)

**Files to Create:**
- `src/services/voice/voice-message-detector.js`
- `src/services/voice/__tests__/voice-message-detector.test.js`

**2.2 Implement Audio File Manager** (Effort: L)
- [ ] Create `audio-file-manager.js`
- [ ] Implement audio download from WhatsApp
- [ ] Handle temporary file storage in `/tmp/voice-messages/`
- [ ] Implement file cleanup (TTL: 5 minutes)
- [ ] Support multiple audio formats (ogg, opus, mp3)
- [ ] Add error handling (download failures, disk space)
- [ ] Add unit tests

**Acceptance Criteria:**
- Can download voice messages successfully
- Temporary files cleaned up after processing
- Handles download errors gracefully
- Supports all WhatsApp audio formats
- Unit tests passing

**Files to Create:**
- `src/services/voice/audio-file-manager.js`
- `src/services/voice/__tests__/audio-file-manager.test.js`

**2.3 Implement Speech-to-Text Service** (Effort: L)
- [ ] Create `speech-to-text-service.js`
- [ ] Integrate Google Cloud Speech-to-Text API
- [ ] Configure Russian language settings
- [ ] Handle audio format conversion (if needed)
- [ ] Return transcription with confidence score
- [ ] Add error handling (API errors, low confidence)
- [ ] Add retry logic with exponential backoff
- [ ] Add unit and integration tests

**Acceptance Criteria:**
- Transcribes Russian voice messages with >95% accuracy
- Returns confidence scores
- Handles API errors with retries
- Processing time <3 seconds for 30-second audio
- Integration tests passing with real audio files

**Files to Create:**
- `src/services/voice/speech-to-text-service.js`
- `src/services/voice/__tests__/speech-to-text-service.test.js`
- `src/services/voice/__tests__/fixtures/sample-voice-messages/` (test audio files)

**2.4 Update Message Worker for Voice Detection** (Effort: M)
- [ ] Modify `message-worker-v2.js` to detect voice messages
- [ ] Route voice messages to voice processing pipeline
- [ ] Add voice message logging and metrics
- [ ] Handle voice processing errors
- [ ] Add integration tests

**Acceptance Criteria:**
- Voice messages detected and routed correctly
- Text messages still processed normally
- Logs include voice message metadata
- Error handling tested

**Files to Modify:**
- `src/workers/message-worker-v2.js`

**2.5 Add Configuration and Environment Variables** (Effort: S)
- [ ] Add Google Cloud credentials setup
- [ ] Add voice processing feature flag
- [ ] Document environment variables
- [ ] Update `.env.example`

**Acceptance Criteria:**
- `ENABLE_VOICE_MESSAGES=true/false` flag works
- `GOOGLE_CLOUD_STT_API_KEY` documented
- All config options in `.env.example`

**Files to Modify:**
- `.env.example`
- `config/index.js`
- `docs/VOICE_MESSAGES_SETUP.md` (create)

---

### Phase 3: Voice Response Generation (3-4 days)

**Objective:** Implement Text-to-Speech and voice response sending.

#### Tasks

**3.1 Implement Text-to-Speech Service** (Effort: L)
- [ ] Create `text-to-speech-service.js`
- [ ] Integrate Google Cloud Text-to-Speech API
- [ ] Configure Russian neural voice
- [ ] Handle long text splitting (max 60 seconds audio)
- [ ] Generate audio in WhatsApp-compatible format (opus/ogg)
- [ ] Add error handling and retries
- [ ] Add unit and integration tests

**Acceptance Criteria:**
- Generates natural-sounding Russian voice
- Audio quality meets WhatsApp standards
- Handles long texts (splits if needed)
- Processing time <2 seconds for 200 characters
- Integration tests passing

**Files to Create:**
- `src/services/voice/text-to-speech-service.js`
- `src/services/voice/__tests__/text-to-speech-service.test.js`

**3.2 Extend Audio File Manager for Upload** (Effort: M)
- [ ] Add audio upload to WhatsApp functionality
- [ ] Handle audio file preparation (format, metadata)
- [ ] Implement upload retries
- [ ] Add cleanup after successful upload
- [ ] Add integration tests

**Acceptance Criteria:**
- Can upload audio files as voice messages
- Upload succeeds with proper metadata
- Retry logic works for failed uploads
- Files cleaned up after upload

**Files to Modify:**
- `src/services/voice/audio-file-manager.js`
- `src/services/voice/__tests__/audio-file-manager.test.js`

**3.3 Update WhatsApp Client for Voice Messages** (Effort: M)
- [ ] Add `sendVoiceMessage()` method to WhatsApp client
- [ ] Handle voice message metadata
- [ ] Add error handling
- [ ] Add unit tests

**Acceptance Criteria:**
- `sendVoiceMessage()` sends voice successfully
- Error handling tested
- Maintains backward compatibility

**Files to Modify:**
- `src/integrations/whatsapp/client.js`
- `src/integrations/whatsapp/__tests__/client.test.js` (create if needed)

**3.4 Implement Voice Preference Management** (Effort: M)
- [ ] Add client preference: `prefer_voice_responses`
- [ ] Store in Redis context
- [ ] Update context service to track preference
- [ ] Add preference detection logic

**Acceptance Criteria:**
- Client preference stored and retrieved
- Preference persists across conversations
- Default: respond in same format as received

**Files to Modify:**
- `src/services/context/context-service-v2.js`
- `src/services/context/__tests__/context-service-v2.test.js`

**3.5 Configure TTS Voice Selection** (Effort: S)
- [ ] Research best Google Cloud Russian voices
- [ ] Configure voice parameters (pitch, speed, volume)
- [ ] Add voice selection to config
- [ ] Document voice options

**Acceptance Criteria:**
- Natural-sounding voice selected
- Voice parameters optimized
- Configurable via environment variables

**Files to Modify:**
- `config/index.js`
- `docs/VOICE_MESSAGES_SETUP.md`

---

### Phase 4: Integration & Orchestration (4-5 days)

**Objective:** Integrate all components, implement orchestration, and comprehensive testing.

#### Tasks

**4.1 Implement Voice Processing Orchestrator** (Effort: XL)
- [ ] Create `voice-processing-orchestrator.js`
- [ ] Orchestrate full voice message flow:
  - Detect → Download → Transcribe → Process AI → Generate TTS → Upload → Send
- [ ] Implement state management for processing steps
- [ ] Add comprehensive error handling
- [ ] Implement fallback strategies:
  - STT fails → send error message (text)
  - TTS fails → send text response
  - Upload fails → send text response
- [ ] Add retry logic for transient failures
- [ ] Add processing metrics (Prometheus)
- [ ] Add unit and integration tests

**Acceptance Criteria:**
- Full voice flow works end-to-end
- Error handling tested for all failure scenarios
- Fallback to text works correctly
- Processing metrics tracked
- Integration tests passing (>80% coverage)

**Files to Create:**
- `src/services/voice/voice-processing-orchestrator.js`
- `src/services/voice/__tests__/voice-processing-orchestrator.test.js`

**4.2 Update Message Worker Integration** (Effort: M)
- [ ] Route voice messages through orchestrator
- [ ] Add voice processing to job data
- [ ] Handle voice processing results
- [ ] Add error logging
- [ ] Update worker metrics

**Acceptance Criteria:**
- Voice messages processed end-to-end
- Job queue handles voice messages
- Errors logged with full context
- Metrics tracked

**Files to Modify:**
- `src/workers/message-worker-v2.js`

**4.3 Add Context Tracking for Voice Messages** (Effort: M)
- [ ] Track voice messages in conversation context
- [ ] Include transcription in context history
- [ ] Add voice metadata to context
- [ ] Ensure AI sees transcribed text, not audio

**Acceptance Criteria:**
- Voice messages included in conversation context
- AI processes transcribed text correctly
- Context history shows voice indicator

**Files to Modify:**
- `src/services/ai-admin-v2/modules/context-manager-v2.js`
- `src/services/context/context-service-v2.js`

**4.4 Implement Voice Message Rate Limiting** (Effort: S)
- [ ] Add rate limits for voice processing (prevent abuse)
- [ ] Limit: 10 voice messages per hour per client
- [ ] Add rate limit error message
- [ ] Store rate limit in Redis

**Acceptance Criteria:**
- Rate limiting enforced correctly
- Clear error message when limit exceeded
- Rate limit resets after 1 hour

**Files to Create:**
- `src/services/voice/voice-rate-limiter.js`

**4.5 Add Monitoring and Logging** (Effort: M)
- [ ] Add Prometheus metrics for voice processing
  - `voice_messages_received_total`
  - `voice_messages_processed_total`
  - `voice_transcription_duration_seconds`
  - `voice_generation_duration_seconds`
  - `voice_processing_errors_total`
- [ ] Add detailed logging at each step
- [ ] Add Sentry error tracking
- [ ] Create monitoring dashboard queries

**Acceptance Criteria:**
- All metrics tracked correctly
- Logs include full processing trace
- Errors captured in Sentry with context

**Files to Modify:**
- `src/services/ai-admin-v2/modules/prometheus-metrics.js`
- `src/services/voice/*.js` (add logging)

**4.6 Create End-to-End Integration Tests** (Effort: L)
- [ ] Test full voice message flow with real audio
- [ ] Test error scenarios (STT fail, TTS fail, upload fail)
- [ ] Test fallback to text responses
- [ ] Test rate limiting
- [ ] Test concurrent voice message processing

**Acceptance Criteria:**
- All happy path tests passing
- All error scenarios tested
- Concurrent processing works
- Test coverage >80%

**Files to Create:**
- `tests/integration/voice-messages.test.js`

---

### Phase 5: Production Deployment & Monitoring (2-3 days)

**Objective:** Deploy to production, monitor performance, and iterate based on feedback.

#### Tasks

**5.1 Setup Google Cloud Services** (Effort: M)
- [ ] Create Google Cloud project (or use existing)
- [ ] Enable Speech-to-Text API
- [ ] Enable Text-to-Speech API
- [ ] Create service account and credentials
- [ ] Setup billing and quotas
- [ ] Configure VPN/proxy access (same as Gemini)

**Acceptance Criteria:**
- APIs enabled and accessible
- Credentials working from server
- Proxy routing configured

**5.2 Deploy to Staging Environment** (Effort: M)
- [ ] Deploy voice processing services to staging
- [ ] Configure environment variables
- [ ] Test with real WhatsApp account
- [ ] Verify audio quality
- [ ] Test error scenarios

**Acceptance Criteria:**
- Voice messages work end-to-end in staging
- Audio quality acceptable
- Error handling works

**5.3 Performance Testing** (Effort: M)
- [ ] Test with high volume (100 concurrent voice messages)
- [ ] Measure end-to-end latency
- [ ] Test memory usage and cleanup
- [ ] Test disk space management
- [ ] Identify bottlenecks

**Acceptance Criteria:**
- Can handle 100 concurrent messages
- End-to-end latency <15 seconds (95th percentile)
- No memory leaks
- Disk cleanup working

**5.4 Create User Documentation** (Effort: S)
- [ ] Create user guide for voice messages
- [ ] Add FAQ section
- [ ] Document limitations
- [ ] Create troubleshooting guide

**Acceptance Criteria:**
- User guide created in `docs/features/VOICE_MESSAGES.md`
- FAQ covers common questions
- Limitations clearly stated

**Files to Create:**
- `docs/features/VOICE_MESSAGES.md`
- `docs/VOICE_MESSAGES_TROUBLESHOOTING.md`

**5.5 Production Deployment** (Effort: M)
- [ ] Create feature branch `feature/voice-messages`
- [ ] Code review with checklist
- [ ] Merge to main
- [ ] Deploy to production with feature flag OFF
- [ ] Enable for test phone number (89686484488)
- [ ] Monitor logs and metrics
- [ ] Gradual rollout (10% → 50% → 100%)

**Acceptance Criteria:**
- Feature deployed behind flag
- Test phone works correctly
- No errors in production logs
- Gradual rollout plan executed

**5.6 Monitoring and Optimization** (Effort: M)
- [ ] Setup Grafana dashboard for voice metrics
- [ ] Configure alerts (error rate >2%, latency >20s)
- [ ] Monitor costs (should be <$10/month)
- [ ] Collect user feedback
- [ ] Iterate based on metrics

**Acceptance Criteria:**
- Dashboard created with key metrics
- Alerts configured and tested
- Cost tracking active
- Feedback collection process defined

**5.7 Create Development Diary Entry** (Effort: S)
- [ ] Document implementation journey
- [ ] Include lessons learned
- [ ] Document final architecture
- [ ] Add performance benchmarks

**Acceptance Criteria:**
- Diary entry created in `docs/03-development-diary/YYYY-MM-DD-voice-messages-implementation.md`

---

## ⚠️ Risk Assessment and Mitigation

### Technical Risks

#### Risk 1: High Latency (>15 seconds end-to-end)
**Probability:** Medium
**Impact:** High
**Mitigation:**
- Use streaming STT if available (Google supports it)
- Parallel processing where possible (don't wait for cleanup to respond)
- Cache TTS responses for common phrases
- Optimize audio file handling
- Use fastest Google Cloud region (closest to Moscow)

#### Risk 2: Poor Transcription Accuracy
**Probability:** Medium
**Impact:** High
**Mitigation:**
- Use Google Cloud STT with Russian language model
- Implement confidence score threshold (>80%)
- Add manual retry option for clients
- Fallback to text if confidence too low
- Test with various accents and audio quality

#### Risk 3: Unnatural Voice Quality
**Probability:** Low
**Impact:** Medium
**Mitigation:**
- Use Google Cloud Neural voices (not Standard)
- Test multiple voice options
- Allow voice selection configuration
- Adjust speed/pitch/volume parameters

#### Risk 4: API Cost Overruns
**Probability:** Low
**Impact:** Medium
**Mitigation:**
- Implement strict rate limiting (10 voice msgs/hour)
- Monitor costs daily
- Set Google Cloud budget alerts
- Consider cheaper alternatives if needed (Yandex)

#### Risk 5: WhatsApp Rate Limits
**Probability:** Low
**Impact:** Medium
**Mitigation:**
- Follow WhatsApp Business API guidelines
- Implement exponential backoff
- Queue voice responses if rate limited
- Monitor WhatsApp connection health

### Operational Risks

#### Risk 6: Disk Space Exhaustion
**Probability:** Low
**Impact:** High
**Mitigation:**
- Aggressive file cleanup (5-minute TTL)
- Use `/tmp` with automatic cleanup
- Monitor disk space usage
- Implement max file size limits (10MB)

#### Risk 7: Google Cloud API Downtime
**Probability:** Low
**Impact:** High
**Mitigation:**
- Implement fallback to text responses
- Add retry logic with exponential backoff
- Monitor Google Cloud status page
- Have Yandex SpeechKit as backup plan

#### Risk 8: Privacy and Data Security
**Probability:** Low
**Impact:** High
**Mitigation:**
- Delete audio files immediately after processing
- Don't log audio content (only metadata)
- Use encrypted connections (HTTPS)
- Add data retention policy
- Comply with GDPR/152-ФЗ

---

## 📊 Success Metrics

### Performance Metrics
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| STT Accuracy | >95% | Manual validation of 100 samples |
| TTS Quality | >90% satisfaction | User survey |
| End-to-End Latency (p50) | <12 seconds | Prometheus metrics |
| End-to-End Latency (p95) | <15 seconds | Prometheus metrics |
| Error Rate | <2% | Error logs / total messages |
| Fallback to Text Rate | <5% | Fallback counter / total voice msgs |

### Business Metrics
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Voice Message Adoption | >30% of users | Usage analytics |
| Client Satisfaction | >90% | Post-interaction survey |
| Booking Completion Rate | No decrease | Compare before/after |
| Support Ticket Reduction | >20% | Ticket volume comparison |

### Cost Metrics
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Monthly Voice Processing Cost | <$10 | Google Cloud billing |
| Cost per Voice Interaction | <$0.015 | Total cost / interactions |

---

## 📦 Required Resources

### APIs and Services
- ✅ **Google Cloud Speech-to-Text API**
  - Pricing: $0.006/15 seconds
  - Setup time: 1 hour
- ✅ **Google Cloud Text-to-Speech API**
  - Pricing: $4/1M characters (Neural)
  - Setup time: 30 minutes
- ✅ **Google Cloud Storage** (optional, for audio backup)
  - Pricing: $0.020/GB/month
  - Setup time: 30 minutes

### Infrastructure
- ✅ Existing VPN/Proxy (Xray) - already configured for Gemini
- ✅ Server disk space: 5GB free (for temp audio files)
- ✅ Redis: already available

### Tools and Libraries
- `@google-cloud/speech` - Google Cloud STT client
- `@google-cloud/text-to-speech` - Google Cloud TTS client
- `fluent-ffmpeg` (optional) - Audio format conversion
- `file-type` - Audio file type detection
- `tmp` - Temporary file management

### Team and Time
- 1 developer (full-time)
- 14-19 days (2.8-3.8 weeks)
- Code review time: 2-3 days
- QA testing time: 2-3 days

---

## 📝 Dependencies

### External Dependencies
- Google Cloud Speech-to-Text API availability
- Google Cloud Text-to-Speech API availability
- WhatsApp server stability
- Baileys library voice message support

### Internal Dependencies
- AI Admin v2 service operational
- Message Worker v2 functional
- BullMQ queue healthy
- Redis connection stable
- Baileys service running

### Pre-requisites
- Google Cloud account with billing enabled
- Service account credentials
- VPN/Proxy configured (already done)
- Test WhatsApp account with voice capability

---

## 🚀 Next Steps

1. **Review and Approve Plan**
   - Stakeholder review
   - Technical team review
   - Budget approval

2. **Create Feature Branch**
   - `git checkout -b feature/voice-messages-implementation`

3. **Begin Phase 1: Research & Architecture**
   - Setup Google Cloud APIs
   - Test STT/TTS services
   - Design detailed architecture

4. **Track Progress**
   - Update `voice-messages-implementation-tasks.md` daily
   - Update `voice-messages-implementation-context.md` with decisions
   - Daily standup updates

---

## 📚 References

### Documentation
- [Google Cloud Speech-to-Text Docs](https://cloud.google.com/speech-to-text/docs)
- [Google Cloud Text-to-Speech Docs](https://cloud.google.com/text-to-speech/docs)
- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)

### Internal Docs
- `docs/ARCHITECTURE.md` - Current system architecture
- `docs/CLAUDE_CODE_MASTER_GUIDE.md` - Development guidelines
- `CLAUDE.md` - Project quick reference
- `docs/TROUBLESHOOTING.md` - Common issues

### Related Features
- AI Admin v2 Two-Stage Processing
- Message Worker v2
- Context Service v2

---

**Plan created:** 2025-11-20
**Created by:** Claude Code
**Status:** Ready for Review
