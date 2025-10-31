# Исправление мониторинга WhatsApp и автоочистка очереди

**Дата:** 19 октября 2025  
**Ветка:** `feature/redis-context-cache`  
**Коммиты:** `ae9c0ee`, `f8461a8`

## 🔍 Проблема

### 1. Ложные алерты о WhatsApp

В 19:43:27 пришел алерт от Telegram бота:
```
🚨 КРИТИЧНО: WhatsApp отключен!
Статус: warning
```

При этом WhatsApp работал нормально:
- ✅ Baileys сервис: online (uptime 11 дней)
- ✅ Сообщения отправлялись успешно
- ✅ Тестовый номер 79686484488 получал ответы

### 2. Переполнение очереди

Health check показывал 140+ jobs в очереди:
```json
{
  "queue": { "status": "warning", "totalJobs": 141 }
}
```

## 🔎 Анализ причин

### WhatsApp false positive

Health check (`src/api/routes/health.js:145-223`) проверял WhatsApp некорректно:

1. Искал `global.whatsappSessionPool` (не находил - его нет в standalone режиме)
2. Делал тест-запрос к API с timeout 2000ms (мог таймаутиться)
3. Проверял файлы сессий в `./sessions/` (не находил - Baileys standalone не использует файлы)
4. Возвращал `status: 'warning', connected: false` ❌

**Root cause:** Health check не поддерживал Baileys standalone архитектуру.

### Переполнение очереди

141 job в Redis - это **completed jobs** (завершенные задачи):
- Самый старый: 7 октября (12 дней назад)
- Самый новый: 19 октября
- Все успешно обработаны, но не удалены

**Root cause:** BullMQ `removeOnComplete` был настроен на хранение последних 100 jobs (по количеству), а не по времени.

## ✅ Решение

### 1. Исправлен WhatsApp health check

**Файл:** `src/api/routes/health.js`

**Изменения:**
- ✅ Добавлена проверка `BAILEYS_STANDALONE` env переменной
- ✅ Увеличен timeout с 2s до 5s
- ✅ Добавлена попытка проверки через `BAILEYS_SERVICE_URL/status/:companyId`
- ✅ Fallback на тест-запрос к API
- ✅ Возвращает `mode: "standalone"` для диагностики

**Код:**
```javascript
const isStandalone = process.env.BAILEYS_STANDALONE === 'true';
const baileysServiceUrl = process.env.BAILEYS_SERVICE_URL || 'http://localhost:3003';

if (isStandalone) {
  // Check Baileys service status endpoint
  const statusResponse = await axios.get(`${baileysServiceUrl}/status/${companyId}`, {
    timeout: 5000
  });
  
  if (statusResponse.status === 200 && statusResponse.data?.connected) {
    return { status: 'ok', connected: true, mode: 'standalone' };
  }
}
```

### 2. Добавлена retry логика в Telegram бот

**Файл:** `scripts/telegram-bot.js`

**Изменения:**
- ✅ При обнаружении `connected: false` ждет 10 секунд
- ✅ Повторяет проверку
- ✅ Отправляет алерт только если 2 проверки подряд показали disconnected
- ✅ Логирует если проблема исчезла после retry

**Код:**
```javascript
if (!whatsapp || !whatsapp.connected) {
  logger.warn('WhatsApp appears disconnected. Waiting 10s to confirm...');
  
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  const retryResponse = await axios.get('http://localhost:3000/health', { timeout: 5000 });
  const retryWhatsapp = retryResponse.data?.checks?.whatsapp;
  
  if (!retryWhatsapp || !retryWhatsapp.connected) {
    // Send alert only if still disconnected
  } else {
    logger.info('WhatsApp reconnected after 10s. No alert sent.');
  }
}
```

### 3. Настроена автоочистка очереди

**Файл:** `src/config/index.js`

**Изменения:**
- ✅ `removeOnComplete`: храним 24 часа (86400 сек) или max 100 jobs
- ✅ `removeOnFail`: храним 7 дней (604800 сек) или max 50 jobs

**Код:**
```javascript
defaultJobOptions: {
  removeOnComplete: {
    age: parseInt(process.env.QUEUE_KEEP_COMPLETED_SECONDS) || 86400, // 24 hours
    count: parseInt(process.env.QUEUE_KEEP_COMPLETED_COUNT) || 100
  },
  removeOnFail: {
    age: parseInt(process.env.QUEUE_KEEP_FAILED_SECONDS) || 604800, // 7 days
    count: parseInt(process.env.QUEUE_KEEP_FAILED_COUNT) || 50
  }
}
```

**Environment variables (.env):**
```bash
# Автоочистка completed jobs после 24 часов
QUEUE_KEEP_COMPLETED_SECONDS=86400
QUEUE_KEEP_COMPLETED_COUNT=100

# Автоочистка failed jobs после 7 дней
QUEUE_KEEP_FAILED_SECONDS=604800
QUEUE_KEEP_FAILED_COUNT=50
```

### 4. Почистили старые jobs вручную

**Скрипт:** Одноразовая очистка через Redis

```javascript
const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
const keys = await redis.keys('bull:company-962302-messages:*');

for (const key of keys) {
  const data = await redis.hgetall(key);
  if (data.finishedOn && parseInt(data.finishedOn) < oneDayAgo) {
    await redis.del(key);
  }
}
```

**Результат:**
- Удалено: 86 старых jobs (>24h)
- Осталось: 55 свежих jobs (<24h)

## 📊 Результаты

### До исправлений

**Health check (19:43:27):**
```json
{
  "status": "warning",
  "whatsapp": { "status": "warning", "connected": false },
  "queue": { "status": "warning", "totalJobs": 141 }
}
```

**Проблемы:**
- ❌ Ложный алерт "WhatsApp отключен"
- ❌ Постоянные алерты о high queue
- ❌ 141 старый job в Redis

### После исправлений

**Health check (19:56+):**
```json
{
  "status": "ok",
  "whatsapp": { 
    "status": "ok", 
    "connected": true, 
    "mode": "standalone" 
  },
  "queue": { 
    "status": "ok", 
    "totalJobs": 58 
  }
}
```

**Результаты:**
- ✅ WhatsApp определяется правильно
- ✅ Нет ложных алертов (прошло 3+ минуты без алертов)
- ✅ Очередь уменьшилась с 141 до 58 jobs
- ✅ Старые jobs автоматически удаляются через 24 часа

## 🔧 Логи остаются доступны

**Важно:** Логи обработки сообщений сохраняются в PM2 logs независимо от наличия jobs в Redis!

**Что логируется:**
```
📥 Входящее сообщение
🤖 AI обработка (Stage 1, Stage 2)
💬 Диалог контекст
📤 Отправка ответа
✅ Job completed
```

**Пример из PM2 logs:**
```
19:59:00: 🤖 Bot sending 2 messages to 79686484488
19:59:00: 🤖 Message 1/2: "Арсен, тест прошел успешно! ✅"
19:59:00: 📤 Sending message via API
19:59:01: ✅ Message sent successfully
19:59:03: ✅ Job 362 completed
```

**Вывод:** Можно смело удалять completed jobs - вся история доступна в PM2 logs через `pm2 logs ai-admin-worker-v2`.

## 🚀 Деплой

```bash
# 1. Push changes
git push origin feature/redis-context-cache

# 2. Deploy to server
ssh root@46.149.70.219 "cd /opt/ai-admin && git pull"

# 3. Add env variables
echo 'QUEUE_KEEP_COMPLETED_SECONDS=86400' >> /opt/ai-admin/.env
echo 'QUEUE_KEEP_COMPLETED_COUNT=100' >> /opt/ai-admin/.env
echo 'QUEUE_KEEP_FAILED_SECONDS=604800' >> /opt/ai-admin/.env
echo 'QUEUE_KEEP_FAILED_COUNT=50' >> /opt/ai-admin/.env

# 4. Restart services
pm2 restart ai-admin-api ai-admin-worker-v2 ai-admin-telegram-bot --update-env

# 5. Clean old jobs (one-time)
node clean-old-jobs.js  # Deleted 86 old jobs
```

## 📈 Мониторинг

### Health check теперь показывает правильный статус

```bash
curl http://localhost:3000/health | jq '.checks.whatsapp'
```

**Output:**
```json
{
  "status": "ok",
  "connected": true,
  "message": "WhatsApp API responding",
  "mode": "standalone"
}
```

### Очередь остается в здоровом состоянии

```bash
curl http://localhost:3000/health | jq '.checks.queue'
```

**Output:**
```json
{
  "status": "ok",
  "totalJobs": 58,
  "pendingBatches": 0
}
```

### Telegram бот больше не шлет ложные алерты

- ✅ Прошло 15+ минут без алертов о WhatsApp
- ✅ Алерты о queue прекратились (58 jobs < 100 threshold)

## 🎯 Итог

Две проблемы решены одним деплоем:

1. **WhatsApp мониторинг** - теперь корректно работает с Baileys standalone
2. **Queue cleanup** - автоматически удаляет старые jobs через 24 часа

**Бонус:** Добавлена retry логика в Telegram бот для защиты от временных сбоев.

---

**Tested:** ✅  
**Deployed:** ✅  
**Monitoring:** ✅
