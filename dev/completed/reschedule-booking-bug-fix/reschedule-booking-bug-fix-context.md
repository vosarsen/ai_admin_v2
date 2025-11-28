# RESCHEDULE_BOOKING Bug Fix - Context

**Last Updated:** 2025-11-28

## Incident Summary

**Дата:** 28 ноября 2025, 10:04-10:05 MSK
**Клиент:** Владимир (+7 985 460-61-56)
**Проблема:** Бот сказал "перенёс на 14:00", но запись осталась на 13:00

### Timeline

1. 10:04 - Владимир: "Можно перенести запись на завтра на 14:00?"
2. 10:04 - Система проверила слот → **ЗАНЯТ**
3. 10:04 - rescheduleBooking вернул `{ success: false, slotNotAvailable: true, nearbySlots: ["14:30", "15:00", "15:30"] }`
4. 10:05 - **БОТ (ОШИБКА):** "Владимир, перенес вашу запись на завтра на 14:00"
5. 10:05 - Владимир: "Спасибо"
6. **Результат:** Запись осталась на 28.11 в 13:00, клиент думает что записан на 29.11 в 14:00

### Manual Fix Applied

Запись вручную перенесена на 29.11 в 14:30 через YClients API.

## Key Files

### Primary (Bug Location)

| File | Lines | Purpose |
|------|-------|---------|
| `src/services/ai-admin-v2/prompts/two-stage-response-prompt.js` | 49-219 | formatCommandResults - нет case для RESCHEDULE_BOOKING |
| `src/services/ai-admin-v2/prompts/two-stage-response-prompt.js` | 217-218 | default case возвращает "✅ Выполнено" |

### Secondary (Contributing Factor)

| File | Lines | Purpose |
|------|-------|---------|
| `src/services/ai-admin-v2/modules/two-stage-processor.js` | 308-316 | Оборачивает result с `success: true` всегда |

### Reference (Correct Implementation)

| File | Lines | Purpose |
|------|-------|---------|
| `src/services/ai-admin-v2/modules/command-handler.js` | 2237-2511 | rescheduleBooking() - возвращает правильные результаты |
| `src/services/ai-admin-v2/modules/command-handler.js` | 2375-2395 | Случай slotNotAvailable |

## Data Structures

### rescheduleBooking() - Slot Unavailable Response
```javascript
{
  success: false,
  slotNotAvailable: true,
  requestedTime: "14:00",
  nearbySlots: ["14:30", "15:00", "15:30"],
  message: "К сожалению, время 14:00 уже занято.",
  suggestions: "Доступное время поблизости: 14:30, 15:00, 15:30"
}
```

### rescheduleBooking() - Success Response
```javascript
{
  success: true,
  oldDateTime: "2025-11-28T13:00:00",
  newDateTime: "2025-11-29T14:00:00",
  services: [{ id: 18356010, title: "МУЖСКАЯ СТРИЖКА" }],
  staff: { id: 3413963, name: "Бари" }
}
```

### two-stage-processor wrapping (PROBLEM)
```javascript
{
  command: 'RESCHEDULE_BOOKING',
  success: true,           // ← ВСЕГДА TRUE!
  data: {
    success: false,        // ← Реальный статус игнорируется
    slotNotAvailable: true,
    // ...
  },
  type: 'booking_rescheduled'
}
```

## Key Decisions

1. **Primary Fix:** Добавить case RESCHEDULE_BOOKING в formatCommandResults
   - Причина: Это прямое исправление бага
   - Риск: Минимальный, изолированное изменение

2. **Secondary Fix:** Исправить success flag в two-stage-processor
   - Причина: Предотвращает подобные баги для других команд
   - Риск: Может повлиять на другие команды, нужно тестировать

3. **Не делаем:** Изменения в command-handler.js
   - Причина: Он работает корректно, баг в слое выше

## Log Evidence

```
2025-11-28 10:04:58: 📋 Selected booking for reschedule {"bookingId":1441964841}
2025-11-28 10:04:58: 📅 Attempting to reschedule booking {"newDateTime":"2025-11-29T14:00:00"}
2025-11-28 10:04:58: 🔍 Checking slot availability for reschedule
2025-11-28 10:05:03: 🔥 Calling contextManager.saveCommandContext with:
  commands: [{
    command: "RESCHEDULE_BOOKING",
    result: {
      command: "RESCHEDULE_BOOKING",
      data: {
        message: "К сожалению, время 14:00 уже занято.",
        nearbySlots: ["14:30","15:00","15:30"],
        requestedTime: "14:00",
        slotNotAvailable: true,
        success: false   ← ПРАВИЛЬНО!
      },
      success: true,     ← ПРОБЛЕМА! Внешний success маскирует ошибку
      type: "booking_rescheduled"
    }
  }]
```

## Related Documentation

- `docs/03-development-diary/2025-10-28-reschedule-booking-fix.md` - Предыдущее исправление RESCHEDULE

## Dependencies

- Нет внешних зависимостей
- Не требует миграций
- Не требует перезапуска Redis
