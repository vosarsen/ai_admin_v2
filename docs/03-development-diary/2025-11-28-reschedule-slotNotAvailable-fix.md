# 2025-11-28: Fix RESCHEDULE_BOOKING slotNotAvailable Bug

## Incident Summary

**Problem:** AI told client "перенёс вашу запись на 14:00" when the slot was actually occupied. The booking was NOT rescheduled.

**Client:** Владимир (+7 985 460-61-56)
**Date:** November 28, 2025, 10:04 MSK

## Root Cause Analysis

### The Bug Chain

```
rescheduleBooking() → { success: false, slotNotAvailable: true, nearbySlots: [...] }
       ↓
two-stage-processor.js → { success: true, data: { success: false, ... } }
       ↓
formatCommandResults() → switch(command) → default: "✅ Выполнено"  ← NO CASE!
       ↓
Stage 2 AI → "Перенёс на 14:00" ← FALSE!
```

**Root cause:** `RESCHEDULE_BOOKING` command was missing from the switch statement in `formatCommandResults()` (file: `two-stage-response-prompt.js`). All unhandled commands fall through to `default` case which returns `"✅ ${command}: Выполнено"` regardless of actual result.

## Solution

Added comprehensive case handler for `RESCHEDULE_BOOKING` with all 8 possible result types:

1. **success: true** - Booking successfully rescheduled
2. **slotNotAvailable: true** - Requested time is occupied (THE BUG)
3. **permissionError: true** - API returned 403
4. **needsDateTime: true** - Missing date/time parameters
5. **error: "нет активных записей"** - No bookings to reschedule
6. **error: "нет предстоящих записей"** - All bookings in the past
7. **Generic error** - Other errors
8. **Exception** - Caught exceptions

### Code Added (lines 217-288)

```javascript
case 'RESCHEDULE_BOOKING':
  const formatDT = (dt) => { /* date formatter */ };

  if (data && data.success === true) {
    return `✅ RESCHEDULE_BOOKING: Запись успешно перенесена...`;
  }

  if (data && data.slotNotAvailable) {
    return `❌ RESCHEDULE_BOOKING: Время ${data.requestedTime} ЗАНЯТО
Альтернативы: ${data.nearbySlots?.join(', ')}
⚠️ КРИТИЧНО: НЕ говори что перенёс! Предложи альтернативное время!`;
  }
  // ... other cases
```

## What Was NOT Fixed

**Secondary fix rejected:** The plan originally included fixing `two-stage-processor.js` to propagate inner `success: false` to outer level. Plan review discovered this would **break 5 out of 6 existing commands** (SEARCH_SLOTS, CREATE_BOOKING, SHOW_PRICES, etc.) because they don't use consistent success/false pattern.

This is documented as a separate refactoring task.

## Systemic Issue Discovered

Plan review found **6 other commands** with the same missing case handler problem:
- CONFIRM_BOOKING
- SHOW_BOOKINGS / SHOWBOOKINGS
- SAVE_CLIENT_NAME
- MARK_NO_SHOW
- SHOW_PORTFOLIO

Follow-up task created: `dev/active/missing-command-handlers/`

## Testing

Unit tests verified all 8 result types produce correct output:

```bash
# slotNotAvailable case:
❌ RESCHEDULE_BOOKING: Время 14:30 ЗАНЯТО
Альтернативы: 15:00, 15:30, 16:00
⚠️ КРИТИЧНО: НЕ говори что перенёс!

# success case:
✅ RESCHEDULE_BOOKING: Запись успешно перенесена
Было: 28.11.2025 в 13:00
Стало: 29.11.2025 в 15:00
```

## Manual Resolution

Vladimir's booking was manually rescheduled to 29.11 at 14:30 (nearest available slot to his requested 14:00). He was notified of the correct time.

## Lessons Learned

1. **Switch statements need exhaustive handling** - Always add case handlers for all commands, don't rely on default
2. **Plan review is valuable** - Caught 6 additional commands with same bug
3. **Test inner success flags** - Outer success=true can mask inner failures
4. **"КРИТИЧНО" markers help AI** - Clear instructions in prompts prevent false positives

## Files Changed

- `src/services/ai-admin-v2/prompts/two-stage-response-prompt.js` - Added RESCHEDULE_BOOKING case (v1.1 → v1.2)

## Commit

```
8e5dc72 fix: handle RESCHEDULE_BOOKING slotNotAvailable in formatCommandResults
```

## Related Documentation

- Plan: `dev/active/reschedule-booking-bug-fix/`
- Follow-up: `dev/active/missing-command-handlers/`
- Previous fix: `docs/03-development-diary/2025-10-28-reschedule-booking-fix.md`
