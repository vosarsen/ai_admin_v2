# Отчет о диагностике и исправлении Qwen AI интеграции

**Дата**: 4 августа 2025  
**Время работы**: ~3 часа  
**Статус**: Частично решено, требуется доработка

## Исходная проблема

Пользователь сообщил о критической проблеме: "новый qwen ai не работает и сообщения не обрабатываются и нет ответа".

## Обнаруженные проблемы

### 1. Ошибка наследования классов в Qwen интеграции
**Симптом**: `TypeError: Class extends value #<AIAdminV2> is not a constructor or null`
**Причина**: AIAdminV2 экспортировался как instance, а не как класс
**Решение**: Переписана логика в `index-with-qwen.js` для работы с instance вместо наследования

### 2. Неправильные имена методов
**Симптом**: `aiAdminV2.generateResponse is not a function`
**Причина**: Метод называется `processMessage`, а не `generateResponse`
**Решение**: Исправлены все вызовы методов

### 3. WhatsApp клиент не аутентифицирован
**Симптом**: 503 ошибка при отправке сообщений
**Причина**: Venom-bot показывал QR код для аутентификации
**Решение**: Пользователь отсканировал QR код по инструкции

### 4. Неправильная конфигурация webhook
**Симптом**: Сообщения шли на старый endpoint `/webhook/whatsapp`
**Причина**: Venom-bot был настроен на старый URL
**Решение**: Обновлена конфигурация на `/webhook/whatsapp/batched`

### 5. Несогласованность форматов телефонов
**Симптом**: Батчинг не работал из-за разных форматов номеров
**Причина**: Контексты использовали `+79XXX`, батчи - `79XXX@c.us`
**Решение**: Создана утилита `phone-normalizer.js`

### 6. AI создавал записи без выбора мастера
**Симптом**: Ошибка "Мастер не определен" при создании записи
**Причина**: AI не спрашивал мастера перед записью
**Решение**: Обновлен промпт с жесткими правилами

## Выполненные исправления

### 1. Файл: `/opt/ai-admin/src/services/ai-admin-v2/index-with-qwen.js`
```javascript
// Было:
class AIAdminV2WithQwen extends AIAdminV2Original {

// Стало:
const aiAdminV2Instance = require('./index');
// Модификация методов instance напрямую
```

### 2. Файл: `/opt/ai-admin/src/workers/message-worker-v2-qwen.js`
- Исправлен вызов метода: `generateResponse` → `processMessage`
- Исправлено имя очереди: `'messages'` → `'company-962302-messages'`
- Добавлена поддержка двух форматов сообщений

### 3. Файл: `/opt/ai-admin/src/services/ai-admin-v2/ai-provider-adapter.js`
- Удален дублирующийся метод `getUsageStats` (строки 94 и 170)

### 4. Файл: `/opt/ai-admin/src/api/index.js`
- Старый webhook теперь редиректит на новый:
```javascript
app.post('/webhook/whatsapp', rateLimiter, validateWebhookSignature, async (req, res) => {
  logger.warn('⚠️ Old webhook endpoint used, redirecting to batched version');
  req.url = '/webhook/whatsapp/batched';
  whatsAppBatchedWebhook(req, res);
});
```

### 5. Файл: `/opt/venom-bot/index.js`
- Обновлен URL webhook с помощью sed:
```bash
sed -i 's|/webhook/whatsapp|/webhook/whatsapp/batched|g' /opt/venom-bot/index.js
```

### 6. Новый файл: `src/utils/phone-normalizer.js`
```javascript
function normalizePhone(phone) {
  if (!phone) return phone;
  let normalized = phone.toString();
  if (normalized.includes('@c.us')) {
    normalized = normalized.replace('@c.us', '');
  }
  normalized = normalized.replace(/[^\d+]/g, '');
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }
  return normalized;
}
```

### 7. Файл: `src/services/redis-batch-service.js`
- Добавлена нормализация номеров во всех методах
- Расширенная диагностика Redis операций
- Логирование всех операций RPUSH, SET, EXPIRE

### 8. Файл: `src/services/ai-admin-v2/index.js`
- Обновлен промпт AI:
```
🔴 ГЛАВНОЕ ПРАВИЛО: БЕЗ МАСТЕРА ЗАПИСАТЬ НЕЛЬЗЯ!

Если клиент НЕ указал мастера:
1. НЕ ИСПОЛЬЗУЙ [CREATE_BOOKING]! 
2. СПРОСИ: "К какому мастеру вас записать?"
3. Предложи доступных мастеров из списка
4. ТОЛЬКО после выбора мастера используй [CREATE_BOOKING]
```

## Результаты

### ✅ Успешно исправлено:
1. Qwen AI интеграция теперь работает
2. WhatsApp аутентификация восстановлена
3. Webhook конфигурация исправлена
4. Форматы телефонов унифицированы
5. AI обучен спрашивать мастера

### ❌ Требует доработки:
1. Batch processor не видит ключи Redis, созданные API
   - API создает ключи `rapid-fire:+79686484488`
   - Batch processor подключается к тому же Redis (localhost:6379)
   - Но не находит ключи при поиске паттерном `rapid-fire:*`

## Диагностическая информация

### Redis подключение:
- Host: localhost
- Port: 6379 
- Database: 0
- Password: есть (одинаковый для API и batch processor)

### Добавленная диагностика показывает:
```
API: RPUSH executed for key: rapid-fire:+79686484488
API: Keys exist check - batch: 1, lastMsg: 1
API: Found rapid-fire keys: 1, keys: rapid-fire:+79686484488

Batch Processor: Found 0 pending batches
Batch Processor: Total keys in Redis: 47
Batch Processor: No rapid-fire keys found
```

## Рекомендации

1. **Исследовать Redis ACL**: Возможно, разные процессы используют разные ACL пользователи
2. **Увеличить TTL**: Текущий TTL 120 секунд может быть слишком мал
3. **Использовать Redis Monitor**: `redis-cli monitor` для отслеживания операций
4. **Проверить Redis namespace**: Возможно используются разные префиксы
5. **Добавить валидацию**: На уровне command-handler проверять наличие мастера

## Команды для тестирования

```bash
# Проверка WhatsApp
node test-direct-webhook.js

# Мониторинг логов
ssh root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 50"

# Проверка Redis
redis-cli -h localhost -p 6379
> AUTH <password>
> KEYS rapid-fire:*
> MONITOR

# Перезапуск сервисов
pm2 restart ai-admin-worker-v2
pm2 restart ai-admin-api
pm2 restart rapid-fire-processor
```

## Итоги

Основные проблемы с Qwen интеграцией решены. Система обрабатывает сообщения и отвечает через WhatsApp. Остается нерешенной проблема с видимостью Redis ключей между процессами, что препятствует полноценной работе батчинга rapid-fire сообщений.