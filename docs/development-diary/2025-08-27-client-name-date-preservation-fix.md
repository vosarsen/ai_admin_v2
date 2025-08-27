# Development Diary: Fix Client Name Recognition and Date Preservation
**Date**: August 27, 2025  
**Author**: Development Team  
**Status**: ✅ Completed and Tested

## Problem Description

The WhatsApp AI bot had two critical issues in handling client bookings:

### Issue 1: Client Name Not Saved
When the bot asked "Как вас зовут?" (What's your name?), and the client responded with their name, the bot would ask for the name again, creating a loop.

### Issue 2: Date Context Lost
When a client requested booking for "завтра" (tomorrow) and then provided their name as "Стрижка и борода Арбак" (Haircut and beard Arbak), the bot would:
- Interpret this as a new booking request
- Reset the date from "завтра" to "сегодня" (today)
- Offer slots for today instead of tomorrow

## Root Cause Analysis

### Name Recognition Issue
1. The `CREATE_BOOKING` command wasn't properly handling the `client_name` parameter
2. Priority was given to context client name over the parameter passed from AI
3. The lastCommand=CLIENT_NAME_REQUIRED wasn't properly tracked

### Date Preservation Issue
1. When AI processed messages like "Стрижка и борода Арбак" after asking for name
2. It interpreted "Стрижка и борода" as a new service request
3. This caused a full context reset, losing the previously established date

## Solution Implemented

### 1. Command Handler Updates (`command-handler.js`)
```javascript
// PRIORITY 1: Check params.client_name first
let clientName = params.client_name;

// PRIORITY 2: Then check context
if (!clientName) {
  clientName = context.client?.name;
}

// Save client_name to Redis when provided
if (params.client_name) {
  await contextServiceV2.updateDialogContext(cleanPhone, companyId, {
    clientName: params.client_name
  });
}
```

### 2. Two-Stage Prompt Updates (`two-stage-command-prompt.js`)
Added explicit rules for handling name responses:
```javascript
// When lastCommand="CLIENT_NAME_REQUIRED"
// Extract ONLY the name, preserve date/time/service from context
// Example: "Стрижка и борода Арбак" → 
//   client_name="Арбак", keep date="завтра", time="19:30"
```

### 3. Error Code Propagation
Added `errorCode` field to error responses:
```javascript
if (!clientName) {
  const nameError = new Error('Требуется имя клиента');
  nameError.code = 'CLIENT_NAME_REQUIRED';
  throw nameError;
}
```

### 4. Context Manager Updates
Improved detection of when bot asks for name:
```javascript
if (result.errorCode === 'CLIENT_NAME_REQUIRED' || 
    result.error?.includes('Как вас зовут')) {
  selection.lastCommand = 'CLIENT_NAME_REQUIRED';
}
```

## Test Results

### Test Scenario
1. New client (+79267514340) requests: "Хочу записаться на стрижку и бороду завтра в 19:30"
2. Bot asks for name: "Пожалуйста, сначала представьтесь. Как вас зовут?"
3. Client responds: "Стрижка и борода Арбак"
4. Bot successfully:
   - Extracts name "Арбак"
   - Preserves date "завтра" (August 28)
   - Creates booking for correct date
   - Responds: "Арбак, записал вас на стрижку + моделирование бороды 28 августа..."

### Performance Metrics
- Stage 1 (Command extraction): ~8 seconds
- Stage 2 (Response generation): ~5 seconds
- Total response time: ~13 seconds

## Key Learnings

1. **Context Preservation is Critical**: When handling multi-step dialogs, preserve established context
2. **Explicit State Tracking**: Use flags like `lastCommand` to track conversation state
3. **Parameter Priority**: Direct parameters should override context-based values
4. **AI Prompt Clarity**: Explicit examples in prompts help AI understand edge cases

## Files Modified

- `src/services/ai-admin-v2/modules/command-handler.js`
- `src/services/ai-admin-v2/modules/context-manager-v2.js`
- `src/services/ai-admin-v2/modules/two-stage-processor.js`
- `src/services/ai-admin-v2/prompts/two-stage-command-prompt.js`

## Related Commits

- `15c4baf`: fix: правильная обработка client_name из команды CREATE_BOOKING
- `8cd59ae`: fix: сохранение контекста даты при ответе на вопрос о имени

## Recommendations

1. Consider adding integration tests for multi-step booking flows
2. Monitor logs for similar context loss patterns
3. Enhance prompt training with more edge cases
4. Consider implementing a finite state machine for booking flow