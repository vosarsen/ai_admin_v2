# Missing Command Handlers Fix Plan

**Last Updated:** 2025-11-28
**Version:** 2.0 (Updated after plan review)
**Priority:** Medium
**Origin:** Discovered during RESCHEDULE_BOOKING bug fix
**Review Grade:** 6/10 → Updated with corrected code

## Problem Statement

В `formatCommandResults()` (файл `two-stage-response-prompt.js`) отсутствуют case handlers для 6 команд. Все они падают в `default` case и возвращают `✅ Выполнено` независимо от реального результата.

## ⚠️ ВАЖНО: Findings из Plan Review

**Критические ошибки в оригинальном плане:**

1. **SHOW_BOOKINGS** - неправильная структура data
2. **CONFIRM_BOOKING** - не учтён `temporaryLimitation` флаг
3. **SAVE_CLIENT_NAME** - НЕТ поля `success`, только `{name, phone}`
4. **MARK_NO_SHOW** - не учтён `temporaryLimitation` флаг
5. **SHOW_PORTFOLIO** - возвращает пустой массив `[]`, не объект

## Affected Commands

| Command | Priority | Real Return Structure | Notes |
|---------|----------|----------------------|-------|
| **SHOW_BOOKINGS** | HIGH | `{success, bookings: [{date, time, services, staff}], total, message}` | |
| **CONFIRM_BOOKING** | HIGH | `{success: false, temporaryLimitation: true, message, instructions[]}` | API временно недоступен |
| SHOWBOOKINGS | LOW | Алиас для SHOW_BOOKINGS | |
| SAVE_CLIENT_NAME | LOW | `{name, phone}` - БЕЗ success! | |
| MARK_NO_SHOW | LOW | `{success: false, temporaryLimitation: true, message, instructions[], suggestion}` | API временно недоступен |
| SHOW_PORTFOLIO | LOW | `[]` (пустой массив) | TODO фича |

## Implementation - Corrected Code

### SHOW_BOOKINGS / SHOWBOOKINGS

```javascript
case 'SHOW_BOOKINGS':
case 'SHOWBOOKINGS':
  // Error case
  if (data && data.success === false) {
    return `❌ SHOW_BOOKINGS: ${data.error || data.message || 'Не удалось получить записи'}`;
  }

  // Success with bookings
  if (data && data.bookings && data.bookings.length > 0) {
    const bookingsList = data.bookings.map(b => {
      // Data structure: {date, time, services, staff, status}
      return `- ${b.date}, ${b.time}: ${b.services}${b.staff ? ' (мастер: ' + b.staff + ')' : ''}`;
    }).join('\n');
    return `✅ SHOW_BOOKINGS: У вас ${data.total || data.bookings.length} записей:
${bookingsList}`;
  }

  // Empty bookings
  return `⚠️ SHOW_BOOKINGS: ${data?.message || 'У вас нет активных записей'}`;
```

### CONFIRM_BOOKING

```javascript
case 'CONFIRM_BOOKING':
  // Temporary limitation (API restriction)
  if (data && data.temporaryLimitation) {
    const instructions = data.instructions?.join('\n') || '';
    return `⚠️ CONFIRM_BOOKING: Функция временно недоступна

${data.message || ''}
${instructions}

💡 Ваша запись уже активна и не требует подтверждения`;
  }

  // Success case (for future when API allows)
  if (data && data.success) {
    return `✅ CONFIRM_BOOKING: ${data.message || 'Запись подтверждена'}`;
  }

  // Error case
  return `❌ CONFIRM_BOOKING: ${data?.error || error || 'Не удалось подтвердить запись'}`;
```

### SAVE_CLIENT_NAME

```javascript
case 'SAVE_CLIENT_NAME':
  // Success case - data has {name, phone} or {name, is_demo}
  // NOTE: NO success field in return!
  if (data && data.name) {
    return `✅ SAVE_CLIENT_NAME: Приятно познакомиться, ${data.name}! Имя сохранено`;
  }

  // Error case
  return `⚠️ SAVE_CLIENT_NAME: ${data?.error || error || 'Не удалось сохранить имя'}`;
```

### MARK_NO_SHOW

```javascript
case 'MARK_NO_SHOW':
  // Temporary limitation (API restriction)
  if (data && data.temporaryLimitation) {
    const instructions = data.instructions?.join('\n') || '';
    const suggestion = data.suggestion ? `\n\n💡 ${data.suggestion}` : '';
    return `⚠️ MARK_NO_SHOW: Функция временно недоступна

${data.message || ''}
${instructions}${suggestion}`;
  }

  // Success case (for future when API allows)
  if (data && data.success) {
    return `✅ MARK_NO_SHOW: Клиент отмечен как не пришедший`;
  }

  // Error case
  return `❌ MARK_NO_SHOW: ${data?.error || error || 'Не удалось отметить неявку'}`;
```

### SHOW_PORTFOLIO

```javascript
case 'SHOW_PORTFOLIO':
  // Current implementation returns empty array (TODO feature)
  if (data && Array.isArray(data)) {
    if (data.length > 0) {
      return `✅ SHOW_PORTFOLIO: Найдено ${data.length} работ мастера`;
    } else {
      return `⚠️ SHOW_PORTFOLIO: Портфолио пока не добавлено
💡 Эта функция находится в разработке`;
    }
  }

  // Future object structure support
  if (data && data.portfolio) {
    if (data.portfolio.length > 0) {
      return `✅ SHOW_PORTFOLIO: Найдено ${data.portfolio.length} работ`;
    }
  }

  return `⚠️ SHOW_PORTFOLIO: ${data?.error || 'Портфолио не найдено'}`;
```

## Files to Modify

- `src/services/ai-admin-v2/prompts/two-stage-response-prompt.js` - add 6 case handlers

## Testing Strategy

### Unit Test (Node.js)

```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && node -e \"
const prompt = require('./src/services/ai-admin-v2/prompts/two-stage-response-prompt');

// Test SHOW_BOOKINGS with data
const context = {
  message: 'Покажи мои записи',
  company: { title: 'Test', type: 'barbershop' },
  client: { name: 'Test' },
  commandResults: [{
    command: 'SHOW_BOOKINGS',
    success: true,
    data: {
      success: true,
      bookings: [
        {date: '29 ноября, пт', time: '14:30', services: 'Стрижка', staff: 'Бари'}
      ],
      total: 1,
      message: 'У вас 1 активная запись'
    }
  }]
};

const result = prompt.getPrompt(context);
const start = result.indexOf('РЕЗУЛЬТАТЫ ВЫПОЛНЕННЫХ КОМАНД:');
const end = result.indexOf('ОСНОВНЫЕ ПРАВИЛА:');
console.log(result.substring(start, end));
\""
```

## Risk Assessment

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Неправильная структура data | LOW (исправлено) | HIGH | Код проверен по command-handler.js |
| temporaryLimitation не обработан | LOW (исправлено) | MEDIUM | Добавлена обработка флага |
| SAVE_CLIENT_NAME без success | LOW (исправлено) | MEDIUM | Проверяем data.name вместо data.success |
| Регрессия других команд | LOW | HIGH | Тестируем RESCHEDULE_BOOKING, CREATE_BOOKING |

## Estimated Time

- Implementation: 20 min
- Testing: 20 min
- Deploy + Verification: 10 min
- **Total: ~50 min**
