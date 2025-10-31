# Руководство по критичному логированию ошибок

## Обзор

AI Admin v2 включает систему подробного логирования критичных ошибок для отслеживания, анализа и быстрого реагирования на серьезные проблемы в продакшене.

## Основные возможности

### 1. Автоматическая классификация ошибок

Система автоматически определяет тип и серьезность ошибок:

- **Критичные (critical)** - требуют немедленного вмешательства:
  - Потеря соединения с БД
  - Проблемы безопасности
  - Сбои платежной системы
  
- **Высокие (high)** - влияют на функциональность:
  - Недоступность YClients API
  - Отключение WhatsApp
  - Сбои создания записей

- **Средние (medium)** - могут подождать:
  - Таймауты AI сервиса
  - Временные сетевые ошибки

### 2. Детальная диагностика

При каждой критичной ошибке собирается:

- Полный стек вызовов
- Контекст операции (user, company, operation)
- Состояние системы (память, CPU, uptime)
- Статус всех сервисов (Redis, DB, WhatsApp)
- История недавних действий пользователя
- Состояние очередей

### 3. Обнаружение паттернов

Система автоматически выявляет:

- **Burst patterns** - множество ошибок за короткое время
- **Frequent patterns** - регулярные ошибки
- **Periodic patterns** - ошибки с определенной периодичностью

### 4. Многоуровневое логирование

Ошибки логируются в:

- Winston logger (основной лог)
- Файловая система (`logs/critical/`)
- База данных (таблица `critical_errors`)
- Консоль (для критичных)

## Использование

### Базовое логирование

```javascript
const criticalErrorLogger = require('../utils/critical-error-logger');

// Логировать критичную ошибку
await criticalErrorLogger.logCriticalError(error, {
  operation: 'createBooking',
  companyId: 123,
  userId: '79001234567',
  additionalData: { ... }
});
```

### Интеграция в обработчики ошибок

#### В Message Worker:

```javascript
} catch (error) {
  const errorResult = errorMessages.getUserMessage(error, errorContext);
  
  // Логируем критичные ошибки
  if (errorResult.severity === 'high' || errorResult.severity === 'critical') {
    await criticalErrorLogger.logCriticalError(error, {
      ...errorContext,
      messageContent: message,
      attemptNumber: job.attemptsMade,
      workerInfo: {
        workerId: this.workerId,
        processTime: Date.now() - startTime
      }
    });
  }
}
```

#### В API Middleware:

```javascript
app.use(criticalErrorMiddleware);

// Middleware автоматически логирует:
// - 5xx ошибки
// - Ошибки безопасности
// - Системные сбои
// - Ошибки БД
```

### Мониторинг ошибок

```bash
# Запустить монитор критичных ошибок
./scripts/monitor-critical-errors.js

# Вывод:
# 📊 Error Statistics
# 🔝 Top 5 Most Frequent Errors
# 🔄 Detected Error Patterns
# 🕐 Recent Critical Errors
# ⚠️  Critical Pattern Analysis
```

## Типы критичных ошибок

### Системные ошибки

```javascript
SYSTEM_CRASH              // Крах системы
DATABASE_CONNECTION_LOST  // Потеря соединения с БД
REDIS_CONNECTION_LOST     // Потеря соединения с Redis
MEMORY_LIMIT_EXCEEDED     // Превышен лимит памяти
```

### Ошибки интеграций

```javascript
YCLIENTS_API_DOWN        // YClients API недоступен
WHATSAPP_CONNECTION_LOST // WhatsApp отключен
AI_SERVICE_FAILURE       // Сбой AI сервиса
```

### Бизнес-критичные ошибки

```javascript
BOOKING_CREATION_FAILED   // Не удалось создать запись
PAYMENT_PROCESSING_FAILED // Сбой обработки платежа
CLIENT_DATA_CORRUPTION    // Повреждение данных клиента
```

### Ошибки безопасности

```javascript
SECURITY_BREACH_ATTEMPT  // Попытка взлома
INVALID_HMAC_SIGNATURE   // Неверная HMAC подпись
RATE_LIMIT_ABUSE         // Злоупотребление rate limit
```

## Структура лога ошибки

```javascript
{
  id: "err_1234567890_abcdef",
  timestamp: "2025-08-02T10:00:00.000Z",
  type: "database_connection_lost",
  severity: "critical",
  
  error: {
    message: "Connection refused",
    code: "ECONNREFUSED",
    name: "Error",
    stack: "...",
    // Дополнительные детали (HTTP, DB, etc)
  },
  
  context: {
    operation: "query",
    userId: "79001234567",
    companyId: 123,
    requestId: "req_123",
    // Любой дополнительный контекст
  },
  
  system: {
    nodeVersion: "v20.0.0",
    platform: "linux",
    memory: { used: {...}, total: 8GB, free: 2GB },
    uptime: 86400,
    pid: 1234
  },
  
  diagnostics: {
    services: {
      redis: "connected",
      database: "disconnected",
      whatsapp: "connected"
    },
    userActivity: { ... },
    queues: { ... },
    recentErrors: [ ... ]
  },
  
  pattern: {
    type: "database_connection_lost",
    isRecurring: true,
    frequency: 5,
    patternType: "burst",
    firstOccurrence: "2025-08-02T09:00:00.000Z"
  }
}
```

## Файловая структура логов

```
logs/
└── critical/
    ├── critical-2025-08-01.log
    ├── critical-2025-08-02.log
    └── critical-2025-08-03.log
```

Каждый файл содержит JSON записи, разделенные двойным переводом строки.

## Настройка уведомлений

В методе `sendCriticalAlert` можно настроить отправку уведомлений:

```javascript
async sendCriticalAlert(errorData) {
  // Email
  await emailService.send({
    to: 'admin@example.com',
    subject: `Critical Error: ${errorData.type}`,
    body: formatErrorEmail(errorData)
  });
  
  // SMS
  await smsService.send({
    to: '+79001234567',
    message: `🚨 ${errorData.type} at ${errorData.timestamp}`
  });
  
  // Telegram
  await telegramBot.sendMessage(ADMIN_CHAT_ID, 
    formatTelegramAlert(errorData)
  );
  
  // Slack
  await slack.webhook.send({
    text: `Critical error detected`,
    attachments: [formatSlackAttachment(errorData)]
  });
}
```

## Анализ паттернов

### Временные окна

- Счетчики ошибок хранятся 5 минут (300000ms)
- Паттерн определяется после 5 ошибок
- Типы паттернов:
  - **burst** - интервал < 1 сек
  - **frequent** - интервал < 1 мин
  - **periodic** - регулярные интервалы

### Реагирование на паттерны

```javascript
if (pattern.patternType === 'burst') {
  // Возможна DDoS атака или системный сбой
  await enableEmergencyMode();
} else if (pattern.frequency > 10) {
  // Частые ошибки - нужно расследование
  await notifyDevTeam();
}
```

## Best Practices

### 1. Всегда добавляйте контекст

```javascript
// ❌ Плохо
await criticalErrorLogger.logCriticalError(error);

// ✅ Хорошо
await criticalErrorLogger.logCriticalError(error, {
  operation: 'bookingCreation',
  userId: user.id,
  companyId: company.id,
  bookingData: sanitizedData,
  attemptNumber: 3
});
```

### 2. Не логируйте чувствительные данные

```javascript
// Используйте sanitize функции
const sanitizedData = {
  phone: booking.phone,
  services: booking.services,
  // НЕ логируйте: payment_token, password, etc
};
```

### 3. Группируйте связанные ошибки

```javascript
// При повторных попытках добавляйте attemptNumber
context.attemptNumber = retryCount;
context.previousErrorId = lastErrorId;
```

### 4. Используйте правильные типы ошибок

```javascript
// Создавайте ошибки с кодами
const error = new Error('Database connection failed');
error.code = 'ECONNREFUSED';
error.service = 'postgresql';
throw error;
```

## Тестирование

### Unit тесты

```bash
npm test -- src/utils/__tests__/critical-error-logger.test.js
```

### Примеры использования

```bash
node examples/critical-error-logging-example.js
```

### Мониторинг в реальном времени

```bash
# Следить за новыми критичными ошибками
tail -f logs/critical/critical-$(date +%Y-%m-%d).log | jq '.'
```

## Интеграция с мониторингом

Критичные ошибки можно экспортировать в:

- **Grafana** - для визуализации
- **Prometheus** - для метрик
- **ELK Stack** - для анализа
- **Sentry** - для трекинга ошибок

Пример метрик для Prometheus:

```javascript
// Счетчик критичных ошибок
critical_errors_total{type="database_connection_lost", severity="critical"} 5

// Гистограмма времени между ошибками
critical_errors_interval_seconds{type="ai_service_failure"} 45
```

## Troubleshooting

### Логи не создаются

1. Проверьте права на папку `logs/critical/`
2. Убедитесь, что диск не заполнен
3. Проверьте конфигурацию winston logger

### База данных недоступна для логов

- Система автоматически fallback на файловое логирование
- Критичные ошибки всегда выводятся в консоль
- После восстановления БД можно импортировать логи

### Слишком много ошибок

1. Проверьте паттерны через монитор
2. Временно увеличьте порог для паттернов
3. Добавьте rate limiting для определенных типов