# Intermediate Context Guide

## Overview
The Intermediate Context module solves the race condition problem when users send messages quickly, before the previous message's context is saved.

## Problem it Solves

### Before (Context Loss)
```
14:08:40 Bot: "Which complex interests you?"
14:08:58 User: "Beard and head" (18 seconds later)
14:09:15 Context from FIRST message saved
14:09:15 Bot: "What service would you like?" (forgot context!)
```

### After (Context Preserved)
```
14:08:40 Bot: "Which complex interests you?"
         → Intermediate context saved immediately
14:08:58 User: "Beard and head"
         → Sees previous question in context
14:09:15 Bot: "Great! Beard and head complex..." (understands!)
```

## Architecture

### Module Location
```
src/services/context/intermediate-context.js
```

### Key Components

#### 1. Save Processing Start
```javascript
await intermediateContext.saveProcessingStart(phone, message, context);
```
Saves immediately when message received:
- Current message
- Last bot question
- Expected reply type
- Processing status

#### 2. Wait for Completion
```javascript
const waitResult = await intermediateContext.waitForCompletion(phone, 3000);
```
Waits up to 3 seconds for previous message to complete.

#### 3. Update After AI Analysis
```javascript
await intermediateContext.updateAfterAIAnalysis(phone, aiResponse, commands);
```
Updates context with AI's understanding of the message.

## Data Structure

### Redis Key Format
```
intermediate:{phone}
```

### Stored Data
```javascript
{
  // Metadata
  timestamp: 1754045678000,
  processingStatus: 'started|ai_analyzed|completed',
  
  // Current Message
  currentMessage: "Beard and head",
  messageLength: 14,
  
  // Dialog Context
  lastBotMessage: "Which complex interests you?",
  lastBotQuestion: "Which complex?",
  expectedReplyType: "service_selection",
  
  // Extracted Information
  mentionedServices: ["beard modeling"],
  mentionedStaff: ["Bari"],
  mentionedDates: ["tomorrow"],
  mentionedTimes: ["10:00"]
}
```

## Integration Points

### 1. In processMessage (ai-admin-v2/index.js)
```javascript
// Check and wait for previous message
const intermediate = await intermediateContext.getIntermediateContext(phone);
if (intermediate && intermediate.isRecent && intermediate.processingStatus === 'started') {
  await intermediateContext.waitForCompletion(phone, 3000);
}

// Save current message context immediately
await intermediateContext.saveProcessingStart(phone, message, context);
```

### 2. In AI Prompt
```javascript
if (context.intermediateContext && context.intermediateContext.isRecent) {
  prompt += `
  🔴 CONTEXT OF PREVIOUS MESSAGE (sent ${age} seconds ago):
  Previous message: "${ic.currentMessage}"
  Your last question: "${ic.lastBotQuestion}"
  Expected reply type: ${ic.expectedReplyType}
  
  CRITICALLY IMPORTANT: This is a conversation continuation!
  `;
}
```

## Configuration

### TTL Settings
- Intermediate context: 5 minutes (300 seconds)
- Completed context: 1 minute (60 seconds)

### Wait Timeout
- Default: 3000ms (3 seconds)
- Configurable per call

## Methods Reference

### saveProcessingStart(phone, message, context)
Saves initial context when message received.

### getIntermediateContext(phone)
Retrieves intermediate context with age calculation.

### updateAfterAIAnalysis(phone, aiResponse, commands)
Updates context after AI processes message.

### markAsCompleted(phone, result)
Marks processing as complete with results.

### waitForCompletion(phone, maxWait)
Waits for previous message to complete (soft lock).

### isProcessing(phone)
Checks if a message is currently being processed.

### Helper Methods
- `extractLastBotMessage(conversation)`
- `extractLastBotQuestion(conversation)`
- `detectExpectedReplyType(conversation)`

## Usage Example

### Scenario: Quick Service Selection
```
User: "I want to book"
Bot: "What service?" → saves intermediate context
User: "Haircut" (sent 2 seconds later)
→ Bot sees previous question
→ Understands "Haircut" is answer to "What service?"
→ Continues booking flow correctly
```

## Monitoring

### Redis Keys to Monitor
```bash
# Check all intermediate contexts
redis-cli keys "intermediate:*"

# Check specific phone
redis-cli get "intermediate:79001234567"

# Monitor in real-time
redis-cli monitor | grep intermediate
```

### Logs to Watch
```bash
# Intermediate context operations
grep "intermediate context" /opt/ai-admin/logs/worker-v2-out-1.log

# Wait operations
grep "waiting for completion" /opt/ai-admin/logs/worker-v2-out-1.log
```

## Performance Impact

### Metrics
- Save operation: <10ms
- Load operation: <5ms
- Wait operation: 0-3000ms (configurable)
- Memory per context: ~1-2KB

### Best Practices
1. Keep TTL short (5 minutes) to avoid memory bloat
2. Only wait for recent messages (< 1 minute old)
3. Log all wait timeouts for analysis
4. Monitor Redis memory usage

## Troubleshooting

### Context Not Found
```javascript
if (!intermediate) {
  logger.debug('No intermediate context found, proceeding normally');
}
```

### Wait Timeout
```javascript
if (!waitResult) {
  logger.warn('Previous message still processing after timeout');
  // Continue anyway to avoid blocking
}
```

### Redis Connection Issues
- Falls back gracefully
- Logs errors but doesn't block processing
- Monitor Redis connection health

## Future Improvements

1. **Machine Learning Integration**
   - Predict expected reply types
   - Better question-answer matching

2. **Advanced Waiting Logic**
   - Dynamic timeout based on message complexity
   - Priority-based processing

3. **Context Enrichment**
   - Entity extraction during save
   - Sentiment analysis
   - Intent classification

4. **Distributed Locking**
   - Support for multiple Redis instances
   - Consensus-based locking