# AI Context Fixes - 5 августа 2025

## Проблемы

1. **AI здоровается в каждом сообщении**
   - Пример: "Здравствуйте!" в каждом ответе, даже при продолжении диалога
   - Причина: История диалога не загружалась в контекст

2. **Двойная пунктуация в приветствии**
   - Пример: "Здравствуйте!."
   - Причина: AI добавлял "!", а обработчик заменял "|" на ". "

3. **Неправильное определение работающих мастеров**
   - AI говорил что работают все мастера, хотя работал только один
   - Причина: Вызывался несуществующий метод loadSchedules вместо loadStaffSchedules

4. **Неправильное определение типа бизнеса**
   - Барбершоп определялся как beauty
   - Причина: Проверялось только company.title, но не raw_data.short_descr

5. **Ошибка 404 в YClients API**
   - В URL передавался null вместо company_id
   - Причина: Неправильный порядок параметров при вызове getAvailableSlots

## Решения

### 1. Исправлена загрузка расписания
```javascript
// cached-data-loader.js:130
// Было: this.loadSchedules(companyId, staffIds)
// Стало: this.loadStaffSchedules(companyId, staffIds)
```

### 2. Исправлено определение типа бизнеса
```javascript
// business-logic.js:8
detectBusinessType(company) {
  const title = company.title.toLowerCase();
  const shortDescr = company.raw_data?.short_descr?.toLowerCase() || '';
  
  if (title.includes('барбер') || title.includes('barber') || 
      shortDescr.includes('барбер') || shortDescr.includes('barber')) {
    return 'barbershop';
  }
  // ...
}
```

### 3. Исправлена передача параметров в YClients API
```javascript
// booking/index.js:118
// Было: getAvailableSlots(staffId, date, serviceId, companyId)
// Стало: getAvailableSlots(staffId, date, { service_id: serviceId }, companyId)
```

### 4. Исправлена двойная пунктуация
```javascript
// response-processor.js:94
processSpecialCharacters(text) {
  // Обрабатываем символ | - заменяем на точку только если перед ним нет знака препинания
  text = text.replace(/([^.!?])\|/g, '$1. ');
  text = text.replace(/([.!?])\|/g, '$1 ');
  
  // Исправляем двойную пунктуацию (например, "!.")
  text = text.replace(/([!?])\.+/g, '$1');
  // ...
}
```

### 5. Добавлена загрузка истории диалога
```javascript
// cached-data-loader.js:129-133
[bookings, schedules, recentMessages, conversation] = await Promise.all([
  this.loadBookings(client.id, companyId),
  this.loadStaffSchedules(companyId, staffIds),
  this.loadRecentMessages(phone, companyId),
  this.loadConversation(phone, companyId)
]);

// Добавлено в контекст
const context = {
  // ...
  conversation,
  // ...
};
```

### 6. Добавлено правило против повторных приветствий
```javascript
// detailed-prompt.js:222
🔴 КРИТИЧЕСКИ ВАЖНО - НЕ ЗДОРОВАЙСЯ ПОВТОРНО:
- Проверь ИСТОРИЮ ДИАЛОГА перед приветствием!
- Если в истории УЖЕ ЕСТЬ приветствие от бота → НЕ ЗДОРОВАЙСЯ СНОВА
- Если это продолжение диалога → СРАЗУ ОТВЕЧАЙ ПО СУЩЕСТВУ
- Приветствовать можно ТОЛЬКО в начале нового диалога
```

## Результат

Все основные проблемы исправлены:
- ✅ AI больше не должен здороваться в каждом сообщении
- ✅ Исправлена двойная пунктуация
- ✅ Расписание мастеров теперь загружается корректно
- ✅ Барбершоп правильно определяется по short_descr
- ✅ YClients API получает правильные параметры

## Технические детали

Проблема с приветствиями была связана с тем, что история диалога (conversation) загружалась в data-loader, но не добавлялась в контекст в cached-data-loader. Теперь conversation загружается параллельно с другими данными и включается в контекст, который передается в промпт.