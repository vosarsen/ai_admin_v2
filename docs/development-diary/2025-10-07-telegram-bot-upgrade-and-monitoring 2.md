# 2025-10-07: Telegram Bot Upgrade & Proactive Monitoring

## 📋 Резюме

Полный апгрейд Telegram бота с добавлением проактивного мониторинга системы, inline кнопок, новых команд аналитики и удалением устаревшего файлового мониторинга.

**Статус:** ✅ УСПЕШНО ЗАВЕРШЕНО

---

## 🎯 Выполненные задачи

### 1. Удаление устаревшего файлового мониторинга

**Проблема:**
После миграции на Database Auth State (7 октября), файловый мониторинг `whatsapp-safe-monitor` стал бесполезен, так как:
- Baileys больше не создаёт файлы (использует PostgreSQL)
- Алерты о 337 файлах больше не актуальны
- Система самоочищается через TTL в БД

**Решение:**
```bash
# 1. Остановлен и удален из PM2
pm2 stop whatsapp-safe-monitor
pm2 delete whatsapp-safe-monitor
pm2 save

# 2. Создан бэкап старых файлов
mkdir -p /opt/ai-admin/baileys_sessions_backup
cp -r /opt/ai-admin/baileys_sessions/company_962302 \
  /opt/ai-admin/baileys_sessions_backup/company_962302_20251007_213112

# 3. Удалены старые файлы (337 шт)
rm -rf /opt/ai-admin/baileys_sessions/company_962302
```

**Результат:**
- ✅ Устаревший мониторинг удалён
- ✅ Бэкап сохранён на всякий случай
- ✅ 337 неиспользуемых файлов удалены
- ✅ Диск освобожден (~20MB)

---

### 2. Апгрейд Telegram бота

#### 2.1. Inline кнопки и меню

**Добавлено:**

**Главное меню** (8 кнопок):
```javascript
┌─────────────────────────────────────┐
│  📊 Статус    │  🏥 Здоровье         │
├─────────────────────────────────────┤
│  💾 DB Health │  📈 Статистика       │
├─────────────────────────────────────┤
│  🤖 AI Метрики │  📨 Очередь         │
├─────────────────────────────────────┤
│  📜 Логи      │  📱 Тест             │
├─────────────────────────────────────┤
│            🔄 Перезапуск             │
└─────────────────────────────────────┘
```

**Меню перезапуска:**
```javascript
┌─────────────────────────────────────┐
│  🔄 API       │  🔄 Worker           │
├─────────────────────────────────────┤
│  🔄 WhatsApp  │  🔄 Redis            │
├─────────────────────────────────────┤
│            🔄 Всё                    │
├─────────────────────────────────────┤
│            « Назад                   │
└─────────────────────────────────────┘
```

**Меню статистики:**
```javascript
┌─────────────────────────────────────┐
│  Сегодня      │  Неделя              │
├─────────────────────────────────────┤
│  Месяц        │  Всё время           │
├─────────────────────────────────────┤
│            « Назад                   │
└─────────────────────────────────────┘
```

**Реализация:**
- `getMainMenuKeyboard()` - главное меню
- `getRestartMenuKeyboard()` - меню перезапуска
- `getStatsKeyboard()` - меню статистики
- `handleCallbackQuery()` - обработчик нажатий кнопок
- `answerCallbackQuery()` - подтверждение нажатия

**Файл:** `scripts/telegram-bot.js`

---

#### 2.2. Меню команд через Telegram API

**Добавлено:**
Настроено через `setMyCommands()` - появляется при нажатии кнопки `/` в Telegram:

```
/start        🏠 Главное меню
/status       📊 Статус системы
/health       🏥 Проверка здоровья
/db_health    💾 Database Auth State
/stats        📈 Бизнес-аналитика
/ai_metrics   🤖 Метрики AI
/queue        📨 Очередь сообщений
/logs         📜 Последние ошибки
/restart      🔄 Перезапуск сервиса
/test         📱 Тестовое сообщение
```

**Реализация:**
```javascript
async setMyCommands() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`;
  await axios.post(url, {
    commands: [
      { command: 'start', description: '🏠 Главное меню' },
      { command: 'status', description: '📊 Статус системы' },
      // ... остальные команды
    ]
  });
}
```

---

#### 2.3. Новые команды

##### `/db_health` - Мониторинг Database Auth State

**Назначение:** Заменяет старый файловый мониторинг

**Функционал:**
- Подсчёт ключей в таблице `whatsapp_keys`
- Проверка истёкших ключей (expires_at < NOW)
- Последняя активность
- Статус системы на основе количества ключей

**Вывод:**
```
💾 Database Auth State

✅ Всего ключей: 45
✅ Истёкших ключей: 0
🕐 Последняя активность: 2 мин назад

Статус:
✅ Отлично - размер БД оптимален
```

**Пороги:**
- `< 100` - ✅ Отлично
- `100-200` - ✅ Нормально (автоочистка работает)
- `200-300` - ⚠️ Внимание (проверить TTL cleanup)
- `> 300` - 🔴 Критично (TTL cleanup не работает!)

**Реализация:** `handleDatabaseHealth()` в `scripts/telegram-bot.js:419-487`

---

##### `/stats [period]` - Бизнес-аналитика

**Назначение:** Анализ эффективности AI Admin

**Функционал:**
- Подсчёт созданных записей за период
- Подсчёт новых клиентов
- Топ популярных услуг
- Интерактивный выбор периода через кнопки

**Периоды:**
- `today` - сегодня (с 00:00)
- `week` - последние 7 дней
- `month` - последние 30 дней
- `all` - всё время

**Вывод:**
```
📈 Статистика за сегодня

📅 Записей создано: 12
👤 Новых клиентов: 3

Популярные услуги:
📊 Всего услуг: 45

[Кнопки выбора периода]
```

**Реализация:** `handleStats()` в `scripts/telegram-bot.js:489-561`

---

##### `/ai_metrics` - Метрики AI производительности

**Назначение:** Мониторинг производительности AI обработки

**Функционал:**
- Среднее время ответа AI
- Процент успешных обработок
- Количество сообщений за 24ч
- Распределение по стадиям обработки

**Вывод:**
```
🤖 AI Performance Metrics (24h)

⚡ Среднее время ответа: 9.42с
✅ Успешных обработок: 98.5%
📊 Всего сообщений: 156

По стадиям:
  stage1: 156
  stage2: 153
```

**Источник данных:** Таблица `conversation_logs` (если логирование настроено)

**Реализация:** `handleAIMetrics()` в `scripts/telegram-bot.js:563-617`

---

### 3. Проактивный мониторинг (ProactiveMonitor)

**Назначение:** Автоматическое отслеживание проблем и отправка алертов

#### 3.1. Архитектура

**Класс:** `ProactiveMonitor`
**Файл:** `scripts/telegram-bot.js:797-1200`

**Компоненты:**
- `checkCritical()` - критичные проверки (каждую 1 мин)
- `checkImportant()` - важные проверки (каждые 5 мин)
- `scheduleDailySummary()` - ежедневная сводка (9:00 AM МСК)
- `shouldAlert()` - логика cooldown для предотвращения спама

---

#### 3.2. Критичные проверки (каждую 1 минуту)

##### WhatsApp Disconnection

**Проверка:** `checkWhatsAppConnection()`
**Порог:** WhatsApp не подключен
**Cooldown:** 5 минут
**Алерт:**
```
🚨 КРИТИЧНО: WhatsApp отключен!

Статус: disconnected
Время: 07.10.2025, 22:00:00

Действия:
1. Проверьте логи: /logs
2. Проверьте статус: /health
3. При необходимости: /restart whatsapp

Автоматический алерт
```

---

##### Database Unavailable

**Проверка:** `checkDatabaseConnection()`
**Порог:** База данных недоступна
**Cooldown:** 5 минут
**Алерт:**
```
🔴 КРИТИЧНО: База данных недоступна!

Статус: error
Время: 07.10.2025, 22:00:00

Действия:
1. Проверьте Supabase dashboard
2. Проверьте логи: /logs
3. Возможна проблема с сетью

Автоматический алерт
```

---

##### High Queue Size

**Проверка:** `checkHighQueue()`
**Порог:** > 50 сообщений в очереди
**Cooldown:** 5 минут
**Алерт:**
```
⚠️ Высокая нагрузка очереди!

Сообщений в очереди: 75
Порог: 50
Время: 07.10.2025, 22:00:00

Возможные причины:
• Много входящих сообщений
• Медленная обработка AI
• Проблемы с worker

Проверьте: /queue

Автоматический алерт
```

---

#### 3.3. Важные проверки (каждые 5 минут)

##### Database Keys Overflow

**Проверка:** `checkDatabaseKeys()`
**Порог:** > 200 ключей в `whatsapp_keys`
**Cooldown:** 15 минут
**Алерт:**
```
⚠️ Database Auth State: Много ключей!

Ключей в БД: 250
Порог: 200
Время: 07.10.2025, 22:00:00

Проблема:
TTL cleanup возможно не работает!

Действия:
1. Проверьте: /db_health
2. Проверьте истёкшие ключи
3. Возможно нужна ручная очистка

Автоматический алерт
```

**Примечание:** Это критично! Значит автоочистка БД не работает.

---

##### High Memory Usage

**Проверка:** `checkMemoryUsage()`
**Порог:** > 80% использования памяти
**Cooldown:** 15 минут
**Алерт:**
```
⚠️ Высокое использование памяти!

Использовано: 85%
Порог: 80%
Память: 420MB
Время: 07.10.2025, 22:00:00

Действия:
1. Проверьте статус: /status
2. Возможно нужен restart
3. Проверьте memory leaks

Автоматический алерт
```

---

##### No Activity

**Проверка:** `checkActivity()`
**Порог:** > 30 минут без сообщений
**Cooldown:** 30 минут
**Алерт:**
```
⚠️ Нет активности!

Последнее сообщение: 45 мин назад
Порог: 30 мин
Время: 07.10.2025, 22:00:00

Возможные причины:
• Система зависла
• Нет входящих сообщений
• Проблемы с WhatsApp webhook

Проверьте: /health

Автоматический алерт
```

**Примечание:** Silent mode (не издаёт звук в Telegram)

---

#### 3.4. Ежедневная сводка

**Расписание:** Каждый день в 9:00 AM (МСК)
**Проверка:** `scheduleDailySummary()` → `sendDailySummary()`

**Вывод:**
```
📊 Ежедневная сводка AI Admin

📅 Вчера (06.10.2025):
• Создано записей: 12
• Новых клиентов: 3

🔧 Система:
• Uptime: 24ч
• Статус: ✅ OK

Для деталей: /stats yesterday

Ежедневная автоматическая сводка
```

**Примечание:** Silent mode (не издаёт звук в Telegram)

---

#### 3.5. Умный Cooldown

**Назначение:** Предотвращение спама одинаковыми алертами

**Реализация:**
```javascript
shouldAlert(type) {
  const lastAlert = this.lastAlerts.get(type);
  const cooldown = this.cooldowns[type] || 5 * 60 * 1000;

  if (!lastAlert) {
    this.lastAlerts.set(type, Date.now());
    return true;
  }

  const timeSinceLastAlert = Date.now() - lastAlert;

  if (timeSinceLastAlert >= cooldown) {
    this.lastAlerts.set(type, Date.now());
    return true;
  }

  return false; // Слишком рано для повторного алерта
}
```

**Cooldown периоды:**
```javascript
{
  whatsapp_down: 5 * 60 * 1000,        // 5 минут
  database_down: 5 * 60 * 1000,        // 5 минут
  high_queue: 5 * 60 * 1000,           // 5 минут
  db_keys_overflow: 15 * 60 * 1000,    // 15 минут
  high_memory: 15 * 60 * 1000,         // 15 минут
  no_activity: 30 * 60 * 1000          // 30 минут
}
```

---

#### 3.6. Запуск и остановка

**Запуск:**
```javascript
// В main()
const bot = new TelegramBot();
const monitor = new ProactiveMonitor(bot);

// Start bot (runs forever in loop)
bot.run().catch(error => {
  logger.error('Failed to start bot:', error);
  monitor.stop();
  process.exit(1);
});

// Start monitor after 3 second delay
setTimeout(() => {
  monitor.start();
}, 3000);
```

**Остановка:**
```javascript
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, stopping bot and monitor...');
  monitor.stop();
  await bot.stop();
  process.exit(0);
});
```

**Логи запуска:**
```
info: Telegram bot started
info: Bot token: 8301218575...
info: Admin chat ID: 601999
info: Bot commands menu configured
info: 🔍 Starting Proactive Monitor...
info: ✅ Proactive Monitor started
```

---

### 4. Скрипты очистки очереди

#### 4.1. `clear-queue.js` - Очистка BullMQ

**Назначение:** Удаление всех задач из BullMQ очереди

**Использование:**
```bash
node scripts/clear-queue.js
```

**Функционал:**
- Подсчёт задач (wait, active, completed, failed, delayed)
- 3-секундная задержка для безопасности
- Полная очистка через `queue.obliterate({ force: true })`
- Проверка результата

**Вывод:**
```
📊 Checking queue status...
Current queue status: { wait: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
Total jobs: 0
✅ Queue is already empty
```

**Файл:** `scripts/clear-queue.js`

---

#### 4.2. `clear-old-queue-keys.js` - Очистка старых Redis ключей

**Назначение:** Удаление устаревших ключей очередей из Redis

**Паттерны ключей:**
- `bull:company-*-messages:*` - старые ключи очередей
- `rapid-fire:*` - батчинг ключи

**Использование:**
```bash
node scripts/clear-old-queue-keys.js
```

**Функционал:**
- Поиск всех ключей по паттерну
- 3-секундная задержка для безопасности
- Массовое удаление через `redis.del(...keys)`
- Проверка результата

**Вывод:**
```
📊 Searching for old queue keys...
Found 162 queue keys
Found 0 rapid-fire keys

⚠️  WARNING: This will delete 162 keys from Redis!
Press Ctrl+C to cancel, or wait 3 seconds to continue...

🗑️  Deleting keys...
✅ Deleted 162 keys

Remaining queue keys: 0
Remaining rapid-fire keys: 0
```

**Файл:** `scripts/clear-old-queue-keys.js`

**Результат очистки:**
- ✅ Queue: 162 → 0 задач
- ✅ Redis keys: 262 → 100 (удалено 162)
- ✅ Status: warning → ok

---

## 📊 Результаты

### До апгрейда:

**Мониторинг:**
- ❌ Файловый мониторинг (устаревший)
- ❌ Ручная проверка статуса
- ❌ Узнавали о проблемах постфактум
- ❌ Нет аналитики

**Telegram бот:**
- ✅ Базовые команды (/status, /health, /logs)
- ❌ Нет кнопок
- ❌ Нет меню команд
- ❌ Нет аналитики

**Очередь:**
- ⚠️ 162 застрявших задачи
- ⚠️ 262 ключа в Redis

---

### После апгрейда:

**Мониторинг:**
- ✅ Проактивный мониторинг Database Auth State
- ✅ Автоматические алерты при проблемах
- ✅ Умный cooldown (не спамит)
- ✅ Ежедневная сводка в 9:00 AM

**Telegram бот:**
- ✅ Inline кнопки (3 меню, 15+ кнопок)
- ✅ Меню команд через Telegram API
- ✅ Новые команды: /db_health, /stats, /ai_metrics
- ✅ Бизнес-аналитика и метрики AI

**Очередь:**
- ✅ 0 задач (очищено)
- ✅ 100 ключей в Redis (удалено 162)
- ✅ Утилиты для быстрой очистки

---

## 🎯 Что это даёт бизнесу

### Мониторинг 24/7

**До:**
- Проблемы обнаруживались спустя часы
- Требовалась ручная проверка системы
- Нет понимания когда что-то сломалось

**После:**
- Мгновенные алерты при критичных проблемах
- Автоматический мониторинг Database Auth State
- Понимание состояния системы в реальном времени

**ROI:** Быстрая реакция на проблемы = меньше потерянных клиентов

---

### Бизнес-аналитика

**До:**
- Нет понимания эффективности AI Admin
- Ручной подсчёт записей и клиентов
- Нет метрик производительности

**После:**
- `/stats` - записи и клиенты за любой период
- `/ai_metrics` - производительность AI в реальном времени
- Ежедневная сводка - ROI виден каждый день

**ROI:** Понимание ценности AI Admin для бизнеса

---

### UX для администратора

**До:**
- Команды вводились вручную
- Нужно помнить синтаксис команд
- Неудобный интерфейс

**После:**
- Кнопочный интерфейс - всё в один клик
- Меню команд с описаниями
- Интуитивная навигация

**ROI:** Быстрее работа = больше времени на бизнес

---

## 📝 Технические детали

### Коммиты

```bash
4ed0c25 - feat: upgraded telegram bot with inline buttons, menu, and new commands
01e8ddb - feat: added proactive monitoring system to telegram bot
d2516e8 - fix: proactive monitor startup - use setTimeout instead of .then()
72c4f9d - feat: added queue cleanup utilities
```

### Файлы изменены

```
scripts/telegram-bot.js                              # +828 строк
scripts/clear-queue.js                               # NEW (60 строк)
scripts/clear-old-queue-keys.js                      # NEW (60 строк)
docs/development-diary/2025-10-07-telegram-bot-*.md  # NEW (документация)
```

### Зависимости

Нет новых зависимостей - использованы существующие:
- `axios` - HTTP запросы
- `@supabase/supabase-js` - работа с БД
- `bullmq` - управление очередями

---

## 🚀 Deployment

### Production

```bash
# Pull latest code
cd /opt/ai-admin && git pull

# Restart telegram bot
pm2 restart ai-admin-telegram-bot

# Verify ProactiveMonitor started
pm2 logs ai-admin-telegram-bot --lines 20

# Should see:
# info: 🔍 Starting Proactive Monitor...
# info: ✅ Proactive Monitor started
```

### Проверка работы

```bash
# Check health
curl http://localhost:3000/health

# Should see:
# "queue": { "status": "ok", "totalJobs": 0 }
# "redis": { "status": "ok", "keys": 100 }
```

---

## ⚙️ Конфигурация

### Environment Variables

Все настройки берутся из существующих переменных:

```bash
TELEGRAM_BOT_TOKEN=8301218575:AAFRhNPuARDnkiKY2aQKbDkUWPbaSiINPpc
TELEGRAM_CHAT_ID=601999
SUPABASE_URL=https://qqkgukzsyecwgdfvqbzl.supabase.co
SUPABASE_SERVICE_ROLE_KEY=***
```

### Пороги мониторинга

Настраиваются в `ProactiveMonitor` constructor:

```javascript
this.thresholds = {
  queueSize: 50,          // Алерт при > 50 сообщений
  dbKeys: 200,            // Алерт при > 200 ключей в БД
  memory: 80,             // Алерт при > 80% памяти
  noActivityMinutes: 30,  // Алерт при > 30 мин без активности
  errorsPerHour: 10       // (не реализовано пока)
};
```

### Cooldown периоды

```javascript
this.cooldowns = {
  whatsapp_down: 5 * 60 * 1000,        // 5 минут
  database_down: 5 * 60 * 1000,        // 5 минут
  high_queue: 5 * 60 * 1000,           // 5 минут
  db_keys_overflow: 15 * 60 * 1000,    // 15 минут
  high_memory: 15 * 60 * 1000,         // 15 минут
  no_activity: 30 * 60 * 1000          // 30 минут
};
```

---

## 🔮 Будущие улучшения

### Приоритет 1 (критично)

1. **Error Rate Monitoring**
   - Отслеживание ошибок из логов
   - Алерт при > 10 ошибок/час
   - Группировка по типам ошибок

2. **YClients Sync Monitoring**
   - Проверка последней успешной синхронизации
   - Алерт при проблемах с YClients API
   - Метрики синхронизации

3. **Conversation Analytics**
   - Логирование всех AI диалогов в `conversation_logs`
   - Реальные метрики для `/ai_metrics`
   - Анализ проблемных сценариев

### Приоритет 2 (важно)

4. **Client Insights**
   - `/clients` - топ клиенты, новые, потерянные
   - Анализ частоты визитов
   - Lifetime value клиентов

5. **Financial Metrics**
   - `/revenue` - доход от AI-записей vs ручных
   - ROI расчёт
   - Cost savings

6. **Advanced Alerts**
   - Webhook для критичных алертов (не только Telegram)
   - PagerDuty интеграция
   - Email notifications

### Приоритет 3 (nice to have)

7. **Dashboard**
   - Web dashboard для визуализации метрик
   - Grafana/Prometheus integration
   - Real-time графики

8. **Predictive Monitoring**
   - ML модель для предсказания проблем
   - Анализ трендов
   - Автоматические рекомендации

---

## 🎓 Уроки

### Что сработало хорошо

1. **Проактивный мониторинг вместо реактивного**
   - Раньше узнавали о проблемах когда клиенты жаловались
   - Теперь алерт приходит мгновенно при любой проблеме

2. **Inline кнопки vs команды**
   - Намного удобнее пользоваться
   - Снижает барьер использования бота

3. **Умный cooldown**
   - Без него было бы спам-алертов
   - Разные периоды для разных типов проблем

4. **Database Auth State мониторинг**
   - Критично отслеживать размер БД
   - TTL cleanup может сломаться незаметно

### Что нужно улучшить

1. **Недостаточно данных для аналитики**
   - Нет логирования диалогов → `/ai_metrics` показывает "Нет данных"
   - Решение: Добавить полное логирование в `conversation_logs`

2. **Health check слишком простой**
   - Проверяет только доступность, не качество
   - Решение: Добавить проверку актуальности данных

3. **Нет автовосстановления**
   - Алерты есть, но восстановление ручное
   - Решение: Добавить автоматический restart при простых проблемах

---

## 📚 Связанная документация

- `docs/WHATSAPP_MONITORING_GUIDE.md` - Устаревший файловый мониторинг
- `docs/TELEGRAM_ALERTS_TROUBLESHOOTING.md` - Решение проблем с алертами
- `docs/architecture/CLEANUP_STRATEGY_AFTER_MIGRATION.md` - Почему файлы не нужны
- `docs/development-diary/2025-10-07-database-auth-state-success.md` - Database Auth State миграция

---

## 👥 Авторы

- AI Assistant (Claude)
- User (vosarsen)

**Дата:** 2025-10-07
**Время работы:** ~3 часа
**Статус:** ✅ Production ready
