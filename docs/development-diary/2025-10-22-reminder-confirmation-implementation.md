# Реализация подтверждения визита при ответе на напоминание

**Дата:** 22 октября 2025
**Статус:** 🚧 В процессе отладки
**Ветка:** `feature/redis-context-cache`

## 📋 Что было сделано

### 1. Расширены паттерны подтверждения
**Файл:** `src/services/reminder/reminder-context-tracker.js`

Добавлено **70+ паттернов** подтверждения:
- Базовые: "да", "ок", "приду", "буду"
- Дополнительные: "отлично", "супер", "пойду", "ага", "угу"
- Сленг: "оки", "окс", "давай", "го"
- Фразы: "конечно приду", "обязательно буду", "точно приду"
- Эмодзи: 👍, ✅, ❤️, 😊, 🙂, 🤝, 💪

### 2. Добавлен AI fallback для распознавания
**Файл:** `src/services/reminder/reminder-context-tracker.js`

Создан метод `isConfirmationByAI()`:
- Вызывается ТОЛЬКО если паттерны не сработали
- Использует Google Gemini для определения намерения
- Параметры: `maxTokens: 10`, `temperature: 0` (детерминированный ответ)
- Быстрый промпт: проверка является ли сообщение подтверждением визита

**Гибридный подход:**
```javascript
// 1. Быстрая проверка паттернов (~0.001ms)
const patternMatch = this.isConfirmationMessage(message);
if (patternMatch) return true;

// 2. AI fallback если паттерны не сработали (~1-2 сек)
const aiMatch = await this.isConfirmationByAI(message);
return aiMatch;
```

### 3. Создан ReminderResponseHandler
**Файл:** `src/services/reminder/reminder-response-handler.js` (НОВЫЙ)

Основной класс для обработки подтверждений:

```javascript
async handleResponse(phone, message, messageId) {
  // 1. Проверка через reminderContextTracker
  const shouldHandle = await reminderContextTracker.shouldHandleAsReminderResponse(phone, message);

  // 2. Получение контекста с recordId
  const context = await reminderContextTracker.getReminderContext(phone);

  // 3. Обновление attendance=2 в YClients
  await this._updateBookingStatus(recordId);

  // 4. Отправка реакции ❤️
  await this._sendReaction(phone, messageId);

  // 5. Пометка в Redis как подтверждено
  await reminderContextTracker.markAsConfirmed(phone);
}
```

### 4. Интегрировано в AI Admin v2
**Файл:** `src/services/ai-admin-v2/index.js`

Добавлена проверка **ДО вызова AI** (строки 95-106):

```javascript
// 0. ПЕРЕД ВСЕМ: Проверяем ответ на напоминание
const reminderResult = await reminderResponseHandler.handleResponse(
  phone,
  message,
  options.messageId
);

if (reminderResult.confirmed) {
  // Клиент подтвердил визит - возвращаем короткий ответ
  logger.info(`✅ Visit confirmed for ${phone}, sending short response`);
  return '❤️ Отлично! Ждём вас!';
}
```

### 5. Передача messageId из worker
**Файл:** `src/workers/message-worker-v2.js`

Добавлена передача messageId в AIAdminV2.processMessage():

```javascript
const result = await aiAdminV2.processMessage(message, from, companyId, {
  shouldAskHowToHelp,
  isThankYouMessage: isThankYou,
  messageId: messageId // ← ДОБАВЛЕНО
});
```

## 🐛 Проблема которую выявили

### Симптомы
При тестировании система:
- ✅ Правильно распознаёт подтверждение ("Да", "Приду", "Супер")
- ✅ Находит контекст напоминания в Redis
- ✅ Отправляет реакцию ❤️
- ❌ **НЕ может обновить attendance в YClients** - ошибка `company undefined`

### Логи ошибки
```
📝 Updating booking 1363409568 status to attendance=2
📝 Updating record 1363409568 in company undefined  ← ПРОБЛЕМА
🚀 YclientsClient.request() started [req_xxx]
endpoint: "record/undefined/1363409568"  ← undefined вместо 962302
❌ PUT record/undefined/1363409568 - 404 (Not Found)
```

### Причина
В `reminder-response-handler.js` создаётся новый `YclientsClient`:

```javascript
constructor() {
  this.yclientsClient = new YclientsClient({
    companyId: config.yclients.companyId,  // Передаём в config
    bearerToken: config.yclients.bearerToken,
    userToken: config.yclients.userToken,
    partnerId: config.yclients.partnerId
  });
}
```

Но в `_updateBookingStatus()` мы пытаемся получить `companyId`:
```javascript
const companyId = this.yclientsClient.config.companyId;
```

И затем вызываем:
```javascript
await this.yclientsClient.updateRecord(companyId, recordId, { attendance: 2 });
```

Но почему-то `companyId` получается `undefined`.

### Что проверили
1. ✅ Код на сервере обновлён (проверили через `grep`)
2. ✅ Файл `reminder-response-handler.js` содержит правильный код
3. ✅ Worker перезапускался несколько раз (pm2 restart, pm2 delete + start)
4. ❌ В логах продолжает появляться старый лог `company undefined`

### Гипотезы
1. **Node.js кэширует модуль** - require() возвращает старую версию
2. **Старый код из другого места** - возможно логи идут не из нашего файла
3. **Конфигурация не загружается** - `config.yclients.companyId` = undefined

## 📝 Коммиты

**Commit 1:** `1982a02`
```
feat: автоматическое подтверждение визита при ответе на напоминание

- Расширены паттерны подтверждения (70+ вариантов)
- Добавлен AI fallback для определения намерения
- Создан ReminderResponseHandler
- Интеграция в AI Admin v2 ДО вызова AI
- Передача messageId в worker
```

**Commit 2:** `100be0f`
```
fix: передача companyId при обновлении attendance в YClients

Исправлена проблема с undefined companyId.
Используется updateRecord() напрямую с companyId из конфига.
```

## 🧪 Тестирование

### Что протестировали
1. ✅ Создали тестовую запись через WhatsApp бота
   - Номер: 89686484488
   - RecordId: 1363409568
   - Услуга: МУЖСКАЯ СТРИЖКА
   - Дата: 2025-10-23 14:00

2. ✅ Создали контекст напоминания в Redis вручную:
```bash
redis-cli SET 'reminder_context:79686484488' '{
  "type":"day_before",
  "sentAt":"2025-10-22T21:12:00.000Z",
  "booking":{
    "recordId":1363409568,
    "datetime":"2025-10-23T14:00:00+03:00",
    "serviceName":"МУЖСКАЯ СТРИЖКА",
    "staffName":"Бари"
  },
  "awaitingConfirmation":true
}' EX 86400
```

3. ✅ Протестировали разные варианты подтверждения:
   - "Да" - ✅ распознан
   - "Приду" - ✅ распознан
   - "Супер, буду" - ✅ распознан
   - "Конечно приду!" - ✅ распознан
   - "Да, обязательно буду!" - ✅ распознан

4. ❌ Обновление attendance в YClients НЕ работает

### Где остановились
- Система распознаёт подтверждения ✅
- Система находит контекст ✅
- Система отправляет реакции ✅
- **НЕ работает обновление YClients** ❌

## 🔍 Что нужно проверить завтра

### 1. Проверить загрузку конфигурации
```javascript
// В reminder-response-handler.js constructor
console.log('Config:', config.yclients);
console.log('CompanyId:', config.yclients.companyId);
```

### 2. Проверить что YclientsClient правильно сохраняет config
```javascript
// После создания клиента
console.log('YclientsClient config:', this.yclientsClient.config);
console.log('YclientsClient companyId:', this.yclientsClient.config.companyId);
```

### 3. Альтернативное решение
Вместо создания нового клиента, использовать существующий singleton:

```javascript
// В reminder-response-handler.js
const { YclientsClient } = require('../../integrations/yclients/client');
const config = require('../../config');

// В _updateBookingStatus()
const companyId = config.yclients.companyId;  // Напрямую из config

// Создать клиент один раз или использовать глобальный
const yclientsClient = new YclientsClient();
```

### 4. Проверить ecosystem.config.js
Возможно воркер запускается с неправильным путём или переменными окружения.

### 5. Добавить debug логи
Добавить подробное логирование в `_updateBookingStatus()`:

```javascript
async _updateBookingStatus(recordId) {
  logger.info('=== DEBUG: _updateBookingStatus called ===');
  logger.info('recordId:', recordId);
  logger.info('this.yclientsClient:', !!this.yclientsClient);
  logger.info('this.yclientsClient.config:', this.yclientsClient?.config);
  logger.info('config.yclients:', config.yclients);

  const companyId = this.yclientsClient.config.companyId;
  logger.info('Extracted companyId:', companyId);

  // ...
}
```

## 📊 Метрики работы

Что работает:
- **Распознавание подтверждений:** 100% (5/5 тестов)
- **Поиск контекста:** 100%
- **Отправка реакций:** 100%
- **Обновление YClients:** 0% ❌

Производительность:
- Проверка паттернов: ~0.001 мс
- AI fallback (если нужен): ~1-2 сек
- Общее время обработки: ~50-100 мс (без AI), ~2 сек (с AI)

## 📚 Связанные файлы

### Изменённые файлы
1. `src/services/reminder/reminder-context-tracker.js` - паттерны + AI
2. `src/services/reminder/reminder-response-handler.js` - **НОВЫЙ** обработчик
3. `src/services/ai-admin-v2/index.js` - интеграция
4. `src/workers/message-worker-v2.js` - передача messageId

### Конфигурация
- `.env` на сервере содержит `YCLIENTS_COMPANY_ID=962302`
- `config/index.js` должен правильно загружать это значение

### Зависимости
- `@whiskeysockets/baileys` - для WhatsApp
- `ioredis` - для Redis контекста
- Google Gemini API - для AI fallback

## 🎯 Следующие шаги (завтра)

1. **Добавить debug логи** в `_updateBookingStatus()`
2. **Проверить загрузку config** - почему companyId = undefined
3. **Попробовать альтернативное решение** - использовать config напрямую
4. **Протестировать** после исправления
5. **Проверить attendance** в YClients UI
6. **Протестировать AI fallback** с нестандартными фразами
7. **Задеплоить финальную версию**
8. **Написать документацию** по использованию

## 💡 Полезные команды

### Проверка логов
```bash
# Логи воркера
@logs logs_tail service:ai-admin-worker-v2 lines:50

# Поиск ошибок
@logs logs_search service:ai-admin-worker-v2 pattern:"company undefined"

# Логи за последние 30 минут
@logs logs_errors service:ai-admin-worker-v2 minutes:30
```

### Проверка Redis
```bash
# Получить контекст
@redis get_context phone:79686484488

# Очистить контекст
@redis clear_context phone:79686484488
```

### Проверка YClients
```bash
# Получить запись
@supabase query_table table:bookings filters:{"record_id":1363409568}
```

### Деплой
```bash
# Закоммитить
git add -A && git commit -m "fix: исправление проблемы с companyId"

# Запушить
git push origin feature/redis-context-cache

# Задеплоить
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && git pull && pm2 restart ai-admin-worker-v2"
```

---

**Резюме:** Основная функциональность реализована и работает. Осталась одна проблема с передачей `companyId` в YClients API. Завтра добавим debug логи и исправим эту проблему.
