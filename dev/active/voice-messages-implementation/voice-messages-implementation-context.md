# Voice Messages Implementation - Context

**Last Updated:** 2025-11-20

## 📋 Current Status

**Phase:** Planning Complete
**Status:** Ready to Start Implementation
**Branch:** N/A (not created yet)

---

## 🎯 Key Decisions

### Decision 1: Speech-to-Text Provider
**Date:** 2025-11-20
**Decision:** Use Google Cloud Speech-to-Text API
**Rationale:**
- Already using Google ecosystem (Gemini AI)
- Excellent Russian language support (95-98% accuracy)
- Same VPN/proxy infrastructure
- Competitive pricing: $0.006/15 seconds
- Native support for WhatsApp audio formats (opus/ogg)

**Alternatives Considered:**
- OpenAI Whisper: More expensive ($0.006/minute), separate API
- Yandex SpeechKit: Best Russian support, but Russia-based (compliance risk)

### Decision 2: Text-to-Speech Provider
**Date:** 2025-11-20
**Decision:** Use Google Cloud Text-to-Speech API (Neural voices)
**Rationale:**
- Consistent with STT choice
- Natural-sounding Russian neural voices
- Reasonable pricing: $4/1M characters
- Good prosody and intonation
- Same authentication/proxy setup

**Alternatives Considered:**
- ElevenLabs: Best quality, but expensive ($22/month starter)
- Yandex SpeechKit: Best Russian pronunciation, but compliance concerns

### Decision 3: Response Format Strategy
**Date:** 2025-11-20
**Decision:** "Mirror" strategy - respond in same format as received
**Rationale:**
- Client preference indicated by their message format
- Simple to implement
- No complex preference management needed
- Can add explicit preference setting later

**Implementation:**
- Voice message → Voice response (default)
- Text message → Text response (default)
- Store preference in Redis context for override

### Decision 4: Audio File Storage
**Date:** 2025-11-20
**Decision:** Use temporary local files in `/tmp/voice-messages/`
**Rationale:**
- Simple implementation
- No need for cloud storage costs
- Files deleted after processing (TTL: 5 minutes)
- Sufficient for processing pipeline

**Alternatives Considered:**
- Google Cloud Storage: Overkill, added complexity and cost
- In-memory buffers: Risk of memory exhaustion with concurrent processing

### Decision 5: Error Handling Strategy
**Date:** 2025-11-20
**Decision:** Always fallback to text responses on errors
**Rationale:**
- User experience priority - don't leave client hanging
- Better to respond with text than fail silently
- Clear error messages help debugging

**Fallback Scenarios:**
- STT fails → Send text: "Извините, не удалось распознать голосовое сообщение. Отправьте текстом, пожалуйста."
- TTS fails → Send text response from AI
- Upload fails → Send text response from AI

### Decision 6: Rate Limiting
**Date:** 2025-11-20
**Decision:** 10 voice messages per hour per client
**Rationale:**
- Prevent API cost abuse
- Reasonable limit for legitimate use
- Easy to adjust based on actual usage

**Implementation:**
- Store in Redis with 1-hour TTL
- Clear error message when exceeded
- No rate limit for text messages

---

## 📂 Key Files

### New Files to Create

**Voice Services:**
- `src/services/voice/voice-message-detector.js` - Detect voice messages from Baileys
- `src/services/voice/audio-file-manager.js` - Download/upload audio files
- `src/services/voice/speech-to-text-service.js` - STT integration
- `src/services/voice/text-to-speech-service.js` - TTS integration
- `src/services/voice/voice-processing-orchestrator.js` - Coordinate entire flow
- `src/services/voice/voice-rate-limiter.js` - Rate limiting logic

**Tests:**
- `src/services/voice/__tests__/` - Unit tests for all services
- `tests/integration/voice-messages.test.js` - End-to-end tests

**Configuration:**
- `docs/features/VOICE_MESSAGES.md` - User guide
- `docs/VOICE_MESSAGES_SETUP.md` - Setup instructions
- `docs/VOICE_MESSAGES_TROUBLESHOOTING.md` - Troubleshooting guide

### Files to Modify

**Integration Points:**
- `src/workers/message-worker-v2.js` - Add voice message detection and routing
- `src/integrations/whatsapp/client.js` - Add `sendVoiceMessage()` method
- `src/services/ai-admin-v2/modules/context-manager-v2.js` - Track voice in context
- `src/services/context/context-service-v2.js` - Store voice preferences
- `src/services/ai-admin-v2/modules/prometheus-metrics.js` - Add voice metrics

**Configuration:**
- `.env.example` - Add voice configuration options
- `config/index.js` - Add voice config section

---

## 🧩 Architecture Overview

### Message Flow

```
📱 WhatsApp Voice Message
    ↓
🔌 Baileys Service (port 3003)
    ↓
🎯 Voice Message Detector (NEW)
    ↓
📥 Audio File Manager - Download (NEW)
    ↓
🎤 Speech-to-Text Service (NEW)
    ↓ [transcribed text]
🤖 AI Admin v2 (existing)
    ↓ [AI response text]
🔊 Text-to-Speech Service (NEW)
    ↓
📤 Audio File Manager - Upload (NEW)
    ↓
🔌 Baileys Service
    ↓
📱 WhatsApp Voice Response
```

### Error Handling Flow

```
❌ Error at any step
    ↓
📝 Log error to Sentry
    ↓
💬 Fallback to text response
    ↓
📱 Send text to client
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Voice Messages Feature
ENABLE_VOICE_MESSAGES=true

# Google Cloud STT/TTS
GOOGLE_CLOUD_PROJECT_ID=ai-admin-v2-voice
GOOGLE_CLOUD_STT_API_KEY=<service-account-key>
GOOGLE_CLOUD_TTS_API_KEY=<service-account-key>
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Voice Processing
VOICE_MAX_DURATION_SECONDS=120
VOICE_MIN_DURATION_SECONDS=1
VOICE_RATE_LIMIT_PER_HOUR=10
VOICE_TEMP_DIR=/tmp/voice-messages
VOICE_FILE_TTL_MINUTES=5

# TTS Configuration
TTS_VOICE_NAME=ru-RU-Wavenet-A
TTS_VOICE_GENDER=FEMALE
TTS_SPEAKING_RATE=1.0
TTS_PITCH=0.0
TTS_VOLUME_GAIN_DB=0.0

# Proxy (reuse existing Gemini proxy)
SOCKS_PROXY=socks5://127.0.0.1:1080
```

### Feature Flags

```javascript
// config/index.js
module.exports = {
  voice: {
    enabled: process.env.ENABLE_VOICE_MESSAGES === 'true',
    maxDuration: parseInt(process.env.VOICE_MAX_DURATION_SECONDS || '120'),
    minDuration: parseInt(process.env.VOICE_MIN_DURATION_SECONDS || '1'),
    rateLimit: parseInt(process.env.VOICE_RATE_LIMIT_PER_HOUR || '10'),
    tempDir: process.env.VOICE_TEMP_DIR || '/tmp/voice-messages',
    fileTTL: parseInt(process.env.VOICE_FILE_TTL_MINUTES || '5'),
    tts: {
      voiceName: process.env.TTS_VOICE_NAME || 'ru-RU-Wavenet-A',
      gender: process.env.TTS_VOICE_GENDER || 'FEMALE',
      speakingRate: parseFloat(process.env.TTS_SPEAKING_RATE || '1.0'),
      pitch: parseFloat(process.env.TTS_PITCH || '0.0'),
      volumeGainDb: parseFloat(process.env.TTS_VOLUME_GAIN_DB || '0.0')
    }
  }
};
```

---

## 📊 Dependencies

### NPM Packages to Install

```bash
npm install @google-cloud/speech@latest
npm install @google-cloud/text-to-speech@latest
npm install file-type@latest
npm install tmp@latest
npm install fluent-ffmpeg@latest  # optional, for audio conversion
```

### System Dependencies

```bash
# FFmpeg (if needed for audio conversion)
# Server: apt-get install ffmpeg
# Local Mac: brew install ffmpeg
```

---

## 🧪 Testing Strategy

### Unit Tests
- Each service independently tested
- Mock Google Cloud APIs
- Mock Baileys APIs
- Test error scenarios

### Integration Tests
- End-to-end voice message flow
- Real audio files as fixtures
- Test with actual Google Cloud APIs (staging)
- Concurrent processing tests

### Manual Testing Checklist
- [ ] Send voice message, receive voice response
- [ ] Send text message, receive text response
- [ ] Voice message with background noise
- [ ] Very short voice message (<1 second)
- [ ] Long voice message (>60 seconds)
- [ ] Multiple concurrent voice messages
- [ ] Rate limit enforcement
- [ ] STT failure scenario
- [ ] TTS failure scenario
- [ ] Upload failure scenario

---

## 💰 Cost Estimates

### Monthly Cost Breakdown (500 voice interactions/month)

**Speech-to-Text:**
- Average voice message: 30 seconds
- Total audio: 500 × 30s = 15,000 seconds = 250 minutes
- Cost: 250 min × $0.006/min = **$1.50/month**

**Text-to-Speech:**
- Average response: 200 characters
- Total characters: 500 × 200 = 100,000 chars
- Cost (Neural): 100K × $4/1M = **$0.40/month**

**Storage:**
- Temporary files only (no cloud storage)
- Cost: **$0**

**Total: ~$1.90/month** for 500 voice interactions
**Per interaction: ~$0.0038**

### Scaling Costs

| Monthly Voice Interactions | STT Cost | TTS Cost | Total |
|---------------------------|----------|----------|-------|
| 500 | $1.50 | $0.40 | $1.90 |
| 1,000 | $3.00 | $0.80 | $3.80 |
| 2,000 | $6.00 | $1.60 | $7.60 |
| 5,000 | $15.00 | $4.00 | $19.00 |

---

## 🚨 Known Limitations

1. **Audio Duration:**
   - Max: 120 seconds (2 minutes) per message
   - Longer messages will be truncated or rejected

2. **Audio Quality:**
   - Requires clear audio for accurate transcription
   - Background noise may reduce accuracy

3. **Languages:**
   - Optimized for Russian only
   - English support possible but not primary

4. **Rate Limits:**
   - 10 voice messages per hour per client
   - Text messages not limited

5. **Latency:**
   - Expected: 12-15 seconds end-to-end
   - May be higher during peak times

6. **WhatsApp Limitations:**
   - Subject to WhatsApp rate limits
   - Voice messages must follow WhatsApp format specs

---

## 🔍 Monitoring Plan

### Key Metrics to Track

**Performance:**
- End-to-end latency (p50, p95, p99)
- STT processing time
- TTS generation time
- Audio download/upload time

**Quality:**
- STT accuracy (sample validation)
- TTS satisfaction (user feedback)
- Fallback to text rate

**Reliability:**
- Error rate by type (STT, TTS, upload)
- Retry success rate
- Google Cloud API availability

**Business:**
- Voice message adoption rate
- Voice vs text preference
- Booking completion rate (voice vs text)

### Alerts

- Error rate >2% (1 hour window)
- Latency >20 seconds (p95, 5 min window)
- Google Cloud API errors (immediate)
- Disk space <1GB (immediate)
- Daily cost >$1 (daily email)

---

## 📝 Open Questions

1. **Q:** Should we support multiple languages beyond Russian?
   **A:** Start with Russian only, add languages in future phases

2. **Q:** What if voice response is too long (>60 seconds)?
   **A:** Split into multiple voice messages, or fallback to text

3. **Q:** Should we store voice messages for audit/training?
   **A:** No - privacy concerns. Delete immediately after processing.

4. **Q:** Can clients request text response even if they sent voice?
   **A:** Phase 2 feature - add explicit "prefer text" command

5. **Q:** What about voice messages in groups?
   **A:** Out of scope - AI Admin only handles 1-on-1 conversations

---

## 🎯 Success Criteria

### Phase 1 Complete When:
- [x] Plan approved by stakeholders
- [x] Google Cloud APIs researched and tested
- [x] Architecture designed and documented
- [x] Technical specifications written

### Phase 2 Complete When:
- [ ] Voice messages detected correctly (100% test cases)
- [ ] Audio files downloaded successfully
- [ ] STT transcribes with >95% accuracy
- [ ] Unit tests passing (>90% coverage)

### Phase 3 Complete When:
- [ ] TTS generates natural voice
- [ ] Audio uploaded to WhatsApp
- [ ] Voice responses sent successfully
- [ ] Client preferences tracked

### Phase 4 Complete When:
- [ ] Full end-to-end flow working
- [ ] Error handling tested
- [ ] Fallbacks working correctly
- [ ] Integration tests passing (>80% coverage)

### Phase 5 Complete When:
- [ ] Deployed to production
- [ ] Monitoring and alerts active
- [ ] User documentation complete
- [ ] Successfully processed 100+ real voice messages

---

## 📚 Resources

### Learning Materials
- [Google Cloud STT Best Practices](https://cloud.google.com/speech-to-text/docs/best-practices)
- [Google Cloud TTS Voice Selection](https://cloud.google.com/text-to-speech/docs/voices)
- [Baileys Voice Message Handling](https://github.com/WhiskeySockets/Baileys/blob/master/docs/messages.md)
- [WhatsApp Audio Format Specs](https://developers.facebook.com/docs/whatsapp/api/media)

### Internal References
- `docs/03-development-diary/2025-10-19-gemini-integration-with-vpn.md` - Proxy setup example
- `dev/active/database-migration-supabase-timeweb/` - Large project structure example

---

**Context last updated:** 2025-11-20
**Next update:** After Phase 1 completion
