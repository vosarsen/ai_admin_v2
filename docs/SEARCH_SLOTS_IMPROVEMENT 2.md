# SEARCH_SLOTS Improvement Documentation

## Problem Solved

When clients asked about available time without specifying a service, the bot would incorrectly respond that "all time is booked" even when slots were available. This happened because the SEARCH_SLOTS command couldn't function without a service specification.

## Solution Implemented

### 1. Intelligent Service Detection

The system now analyzes client history when no service is specified:

```javascript
// When SEARCH_SLOTS is called without a service
if (!serviceToSearch && !params.service_id) {
  // Analyze client's service history
  const serviceFrequency = analyzeServiceHistory(client);

  if (topService.usage >= 50%) {
    // Use favorite service automatically
    useService(topService.name);
  } else {
    // Ask client to specify
    return {
      requiresServiceSelection: true,
      topServices: getTop3Services()
    }
  }
}
```

### 2. Response Logic

**Scenario 1: Client has a clear favorite (>50% of bookings)**
- Bot automatically uses the favorite service
- Shows available slots immediately

**Scenario 2: No clear favorite**
- Bot asks which service the client wants
- Shows top 3 most used services as suggestions

**Scenario 3: New client**
- Bot asks which service they're interested in
- No suggestions (no history available)

## Technical Implementation

### Files Modified

1. **`src/services/ai-admin-v2/modules/command-handler.js`**
   - Added service history analysis in SEARCH_SLOTS handler
   - Implemented logic to determine favorite services
   - Returns `requiresServiceSelection` flag when service needs clarification

2. **`src/services/ai-admin-v2/prompts/two-stage-response-prompt.js`**
   - Added handling for `requiresServiceSelection` flag
   - Proper response generation when service selection is needed
   - Improved command result formatting

### Algorithm

```
1. Check if service is specified in:
   - Command parameters
   - Dialog context
   - Last search context

2. If no service found:
   a. Analyze client.last_services[]
   b. Analyze client.visit_history[]
   c. Calculate frequency for each service

3. Decision logic:
   - If top service >= 50% of total → use it
   - Otherwise → ask client to specify

4. Return appropriate result:
   - With service: return available slots
   - Without service: return requiresServiceSelection
```

## Examples

### Example 1: Automatic Service Selection

**Input:** "На воскресенье какое есть свободное время?"

**Client History:**
- Мужская стрижка: 8 times (60%)
- Other services: 40%

**Bot Response:**
```
На воскресенье у Бари свободно:
Утром: 10:00, 11:00
Днём: 15:00, 16:00
На какое время вас записать?
```

### Example 2: Service Clarification Needed

**Input:** "На воскресенье какое есть свободное время?"

**Client History:**
- Мужская стрижка: 5 times (33%)
- Стрижка + борода: 5 times (33%)
- Other: 34%

**Bot Response:**
```
Владислав, на какую услугу вы хотите записаться на воскресенье?

Вижу, что вы обычно записываетесь на мужскую стрижку или на стрижку с моделированием бороды.

Какую услугу выберете?
```

## Benefits

1. **Better UX:** Clients don't have to specify service every time if they have a clear preference
2. **Accurate responses:** No more false "all booked" messages
3. **Personalization:** System learns client preferences
4. **Flexibility:** Works for both regular and new clients

## Configuration

No additional configuration required. The system automatically:
- Analyzes last 10 visits from history
- Uses 50% threshold for automatic selection
- Shows top 3 services for suggestions

## Testing

Test with phone number: **89686484488** (configured in CLAUDE.md)

Test scenarios:
1. Ask for slots without specifying service
2. Verify favorite service is detected (if >50%)
3. Verify clarification is requested (if <50%)
4. Test with new client (no history)

## Related Documentation

- [DECLENSION_SYSTEM.md](./DECLENSION_SYSTEM.md) - For proper case handling
- [UNIVERSAL_PROMPTS.md](./UNIVERSAL_PROMPTS.md) - For business-agnostic prompts
- [development-diary/2025-09-25-search-slots-fix.md](./development-diary/2025-09-25-search-slots-fix.md) - Implementation diary