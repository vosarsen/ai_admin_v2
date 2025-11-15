# Legacy Code Cleanup - August 5, 2025

## Context
После успешной реализации персонализации было принято решение провести масштабную очистку кодовой базы от legacy v1 кода. В проекте накопилось много неиспользуемых файлов, дублирующего функционала и старой архитектуры.

## What Was Done

### 1. Полное удаление v1 архитектуры

#### Удалена папка NLU (Natural Language Understanding)
- **Путь**: `src/services/nlu/`
- **Файлов**: 14
- **Причина**: Это была старая 5-step pipeline архитектура (AI → NLU → EntityExtractor → ActionResolver → ResponseGenerator)
- **Замена**: AI Admin v2 использует единый AI call

#### Удалены v1 воркеры
- `src/workers/message-worker.js` - старый обработчик сообщений
- `src/workers/reminder-worker.js` - старый обработчик напоминаний
- **Замена**: `index-v2.js` и новый `reminder-worker-v2.js`

#### Удалены v1 сервисы
- `src/services/rapid-fire-protection.js` - старая защита от множественных сообщений
- `src/services/ai/index.js` - старый AI сервис, использовавший NLU
- `src/services/ai/entity-resolver.js` - часть старой pipeline
- `src/services/ai/proactive-suggestions.js` - неиспользуемый функционал
- **Замена**: Redis-based батчинг и AI Admin v2

#### Удален legacy webhook
- `src/api/webhooks/whatsapp-ai-admin.js` - использовал rapid-fire-protection
- **Замена**: `/webhook/whatsapp/batched` с Redis батчингом

### 2. Консолидация middleware

#### Объединение папок
- Перемещено: `src/middleware/critical-error-middleware.js` → `src/middlewares/critical-error.js`
- Удалена пустая папка `src/middleware/`
- **Результат**: Все middleware теперь в одной папке `src/middlewares/`

#### Подключение critical-error middleware
```javascript
// src/api/index.js
const criticalErrorMiddleware = require('../middlewares/critical-error');
// ...
app.use(criticalErrorMiddleware); // Заменил простой error handler
```

### 3. Очистка services

#### Удалены неиспользуемые файлы
- `src/services/schedule-sync-service.js` - старый сервис синхронизации
- `src/services/whatsapp/ai-integration.js` - использовал v1 ai-admin
- Backup файлы: `index.js.backup`, `index.js.backup2`

#### Удалены дублирующие модули
- `ai-admin-v2/modules/rate-limiter.js` - не использовался
- `ai-admin-v2/modules/circuit-breaker.js` - не использовался
- **Используются**: основные версии из `src/middlewares/` и `src/utils/`

### 4. Создание v2 reminder worker
```javascript
// src/workers/reminder-worker-v2.js
class ReminderWorkerV2 {
  constructor(workerId) {
    this.workerId = workerId;
    this.worker = null;
    this.connection = getBullMQRedisConfig();
  }
  
  async start() {
    this.worker = new Worker(
      'reminders',
      async (job) => {
        await reminderService.sendReminder(
          job.data.phone, 
          job.data.booking, 
          job.data.message
        );
      },
      { connection: this.connection, concurrency: 5 }
    );
  }
}
```

## Technical Details

### Статистика удаления
- **Всего удалено**: 48 файлов
- **Удалено строк кода**: 9,861
- **Основная очистка**: 41 файл, 7,221 строка
- **Дополнительная**: 7 файлов, 2,640 строк

### Git операции
```bash
# Три коммита очистки
git commit -m "refactor: major cleanup of legacy v1 code and consolidation"
git commit -m "chore: additional cleanup in services directory"  
git commit -m "chore: remove unused circuit-breaker module from ai-admin-v2"

# Деплой
git push origin feature/redis-context-cache
ssh root@46.149.70.219 "cd /opt/ai-admin && git pull && pm2 restart all"
```

### Проверка работоспособности
1. Все PM2 процессы запустились без ошибок
2. API health check: работает
3. Логи воркера: чистые, без ошибок импорта
4. Production функционал: не затронут

## Problems & Solutions

### Проблема 1: Зависимости между файлами
- **Проблема**: Не сразу понятно, какие файлы можно удалять
- **Решение**: Использовал grep для поиска импортов перед удалением

### Проблема 2: Дублирующий функционал
- **Проблема**: rate-limiter и circuit-breaker существовали в нескольких местах
- **Решение**: Проверил использование через grep, удалил неиспользуемые

### Проблема 3: Reminder worker
- **Проблема**: index-reminder.js использовал старый v1 воркер
- **Решение**: Создал новый reminder-worker-v2.js и обновил импорт

## Results

### Финальная структура
```
src/
├── middlewares/          # Все middleware в одном месте
│   ├── critical-error.js
│   ├── rate-limiter.js  
│   └── webhook-auth.js
├── services/            # Только v2 сервисы
│   ├── ai/             # Только provider-factory и dashscope
│   ├── ai-admin-v2/    # Основной сервис без дублей
│   ├── booking/
│   ├── booking-monitor/
│   ├── cache/
│   ├── context/
│   ├── personalization/
│   ├── redis-batch-service.js
│   ├── reminder/
│   └── webhook-processor/
└── workers/
    ├── index-v2.js
    ├── reminder-worker-v2.js
    └── ...
```

### Преимущества после очистки
1. **Удален весь v1 код** - нет путаницы между версиями
2. **Унифицированная структура** - middleware в одном месте
3. **Нет дублирования** - один rate-limiter, один circuit-breaker
4. **Чище для поддержки** - легче найти нужный код
5. **Меньше размер** - почти 10k строк legacy кода удалено

## Lessons Learned

1. **Регулярная очистка важна** - накопление legacy кода усложняет поддержку
2. **grep - лучший друг** - всегда проверять использование перед удалением
3. **Коммитить по частям** - легче откатить если что-то пошло не так
4. **Тестировать после каждого этапа** - убедиться что ничего не сломалось
5. **Документировать структуру** - помогает понять что где находится

## Next Steps

1. Следить за чистотой кода - не допускать накопления неиспользуемых файлов
2. При рефакторинге сразу удалять старые версии
3. Регулярно проверять на дублирование функционала
4. Поддерживать актуальную документацию структуры проекта