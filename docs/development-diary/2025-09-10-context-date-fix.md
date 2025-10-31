# Исправление обработки контекстной даты в боте

**Дата**: 10 сентября 2025  
**Автор**: AI Admin Team  
**Задача**: Исправить проблему когда бот предлагает слоты на неправильную дату при контекстных запросах

## Проблема

### Описание
Когда клиент спрашивает "До скольки вы работаете сегодня?" и затем "А во сколько можно?", бот некорректно использует сохраненную дату "суббота" из предыдущего контекста вместо "сегодня" (среда, 10 сентября).

### Симптомы
1. Клиент спрашивает про время "сегодня"
2. Бот отвечает про рабочие часы сегодня
3. Клиент спрашивает "А во сколько можно?" (подразумевая сегодня)
4. Бот показывает слоты на субботу (13 сентября) вместо сегодня

### Анализ проблемы
В логах было видно:
```
Previous context for Stage 1: {
  lastService: 'стрижка',
  lastTime: '12:30',
  lastStaff: 'Сергей',
  lastDate: 'суббота',
  lastCommand: undefined,
  previousUserMessage: ''  // Пусто!
}
```

AI использовал `lastDate: 'суббота'` из старого контекста, так как не мог определить что клиент продолжает спрашивать про "сегодня".

## Решение

### 1. Добавлено правило в промпт для обработки контекстной даты

**Файл**: `src/services/ai-admin-v2/prompts/two-stage-command-prompt.js`

Добавлены правила:
```javascript
🔴 КРИТИЧЕСКИ ВАЖНО - ОПРЕДЕЛЕНИЕ ДАТЫ ПО КОНТЕКСТУ:
- Если клиент спрашивает про время БЕЗ указания даты:
  * Проверь предыдущее сообщение клиента (previousUserMessage)
  * Если предыдущее сообщение содержит "сегодня" → используй date="сегодня"
  * Если предыдущее сообщение содержит "завтра" → используй date="завтра"
  * Иначе используй lastDate из контекста
```

И дополнительное исключение:
```javascript
- 🔴 ИСКЛЮЧЕНИЕ: Если в предыдущем сообщении клиент спрашивал про "сегодня" 
  (содержит слово "сегодня"), а сейчас спрашивает про время без указания даты 
  → используй date="сегодня"
  * Пример: Сначала "До скольки вы работаете сегодня?", 
    потом "А во сколько можно?" → date="сегодня"
```

### 2. Добавлена загрузка предыдущего сообщения пользователя

**Файл**: `src/services/context/context-service-v2.js`

В метод `getDialogContext` добавлена загрузка последних сообщений:
```javascript
async getDialogContext(phone, companyId) {
  // ... existing code ...
  
  // Получаем последние сообщения для контекста
  let previousUserMessage = '';
  try {
    const messagesKey = this._getKey('messages', companyId, phone);
    const messages = await this.redis.lrange(messagesKey, -10, -1);
    
    // Ищем последнее сообщение от пользователя
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = JSON.parse(messages[i]);
      if (msg.sender === 'user') {
        previousUserMessage = msg.text;
        break;
      }
    }
  } catch (msgError) {
    logger.debug('Could not load previous messages:', msgError.message);
  }
  
  return {
    ...data,
    // ... other fields ...
    userMessage: previousUserMessage // Добавляем в контекст
  };
}
```

### 3. Передача previousUserMessage в промпт

**Файл**: `src/services/ai-admin-v2/prompts/two-stage-command-prompt.js`

Добавлена передача предыдущего сообщения в контекст промпта:
```javascript
const previousContext = {
  lastService: currentSelection.service || parsedRedisData.lastService,
  lastTime: currentSelection.time || parsedRedisData.lastTime,
  lastStaff: currentSelection.staff || parsedRedisData.lastStaff,
  lastDate: currentSelection.date || parsedRedisData.lastDate,
  lastCommand: currentSelection.lastCommand || parsedRedisData.lastCommand,
  previousUserMessage: parsedRedisData.userMessage || redisContext?.userMessage || ''
};
```

И отображение в промпте:
```javascript
КОНТЕКСТ:
${previousContext.previousUserMessage ? 
  `- Предыдущее сообщение клиента: "${previousContext.previousUserMessage}"` : ''}
```

## Результат

### До исправления
```
Клиент: До скольки вы работаете сегодня?
Бот: Сегодня работаем до 22:00
Клиент: А во сколько можно?
Бот: Сегодня свободно: 10:00, 12:30... [показывает слоты на СУББОТУ 13 сентября]
```

### После исправления
```
Клиент: До скольки вы работаете сегодня?
Бот: Сегодня работаем до 22:00
Клиент: А во сколько можно?
Бот: Сегодня свободно: 18:00, 19:00... [показывает слоты на СЕГОДНЯ 10 сентября]
```

## Технические детали

### Структура данных в Redis

**dialog:962302:79686484488** (hash):
- selection: JSON с выбором услуги/мастера/даты
- state: active
- clientName: имя клиента
- lastUpdated: timestamp

**messages:962302:79686484488** (list):
```json
{"sender":"user","text":"До скольки работаете сегодня?","timestamp":"..."}
{"sender":"bot","text":"Сегодня работаем до 22:00","timestamp":"..."}
{"sender":"user","text":"А во сколько можно?","timestamp":"..."}
```

### Логирование

Теперь в логах видно передачу контекста:
```
📝 Previous context for Stage 1: {
  lastService: 'СТРИЖКА',
  lastTime: '12:30',
  lastStaff: 'Сергей',
  lastDate: 'суббота',
  lastCommand: undefined,
  previousUserMessage: 'До скольки работаете сегодня?'  // Теперь передается!
}
```

## Выводы и рекомендации

### Что было исправлено
1. ✅ AI теперь учитывает контекст предыдущего сообщения
2. ✅ Правильно определяет когда клиент продолжает спрашивать про "сегодня"
3. ✅ Не использует устаревшую дату из старого контекста

### Дальнейшие улучшения
1. Можно добавить более сложную логику определения контекста времени
2. Учитывать время дня при интерпретации "вечером", "утром" и т.д.
3. Добавить валидацию что предлагаемые слоты действительно свободны

## Коммиты

1. `6ebf871` - fix: корректная обработка контекстной даты 'сегодня' в промпте AI
2. `9fa05dd` - fix: добавлена загрузка previousUserMessage из Redis в контекст промпта

## Тестирование

Проведено успешное тестирование с реальными сообщениями в WhatsApp:
- Очистка контекста
- Отправка сообщения "До скольки работаете сегодня?"
- Отправка следующего сообщения "А во сколько можно?"
- Проверка что бот предлагает слоты на правильную дату

## Файлы изменений

1. `/src/services/ai-admin-v2/prompts/two-stage-command-prompt.js` - добавлены правила обработки контекстной даты
2. `/src/services/context/context-service-v2.js` - добавлена загрузка предыдущих сообщений из Redis