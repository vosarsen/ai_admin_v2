# Руководство по обработке ошибок

## Обзор

AI Admin v2 использует централизованную систему для преобразования технических ошибок в понятные пользователям сообщения. Это обеспечивает единообразный и дружелюбный опыт взаимодействия с ботом.

## Основные компоненты

### 1. ErrorMessages (`src/utils/error-messages.js`)

Центральный сервис для управления сообщениями об ошибках.

#### Использование:

```javascript
const errorMessages = require('../utils/error-messages');

// Получить user-friendly сообщение
const errorResult = errorMessages.getUserMessage(error, context);
const userMessage = errorMessages.formatUserResponse(errorResult);
```

#### Структура результата:

```javascript
{
  message: 'Понятное сообщение для пользователя',
  help: ['Подсказка 1', 'Подсказка 2'],
  technical: 'Техническое описание ошибки',
  needsRetry: true/false,
  severity: 'low'/'medium'/'high'
}
```

### 2. Типы ошибок

#### Сетевые ошибки (повторяемые):
- `ECONNREFUSED` - "Сервис временно недоступен"
- `ETIMEDOUT` - "Превышено время ожидания"
- `ENOTFOUND` - "Не удалось подключиться к сервису"

#### Ошибки YClients API:
- `занят` - "Это время уже занято"
- `недоступ` - "Выбранное время недоступно"
- `fully_booked` - "На эту дату всё занято"

#### Ошибки валидации:
- `Invalid phone` - "Укажите корректный номер телефона"
- `Invalid date` - "Неверный формат даты"
- `CLIENT_NAME_REQUIRED` - "Пожалуйста, представьтесь"

#### HTTP статусы:
- `400` - "Неверный запрос"
- `429` - "Слишком много запросов"
- `500` - "Ошибка сервера"
- `502` - "Сервис временно недоступен"

### 3. Контекстные подсказки

Система автоматически добавляет подсказки в зависимости от типа ошибки:

```javascript
// Для ошибки "время занято"
help: [
  'Могу предложить ближайшее свободное время',
  'Хотите посмотреть другого мастера?'
]

// Для ошибки валидации телефона
help: [
  'Пример: +7 900 123-45-67',
  'Или просто: 79001234567'
]
```

## Интеграция в код

### 1. В Message Worker

```javascript
} catch (error) {
  logger.error('Processing error:', error);
  
  // Получаем user-friendly сообщение
  const errorContext = {
    operation: 'message_processing',
    companyId: job.data.companyId
  };
  
  const errorResult = errorMessages.getUserMessage(error, errorContext);
  const userErrorMessage = errorMessages.formatUserResponse(errorResult);
  
  // Отправляем пользователю
  await whatsappClient.sendMessage(from, userErrorMessage);
  
  // Если ошибка временная, можно повторить
  if (errorResult.needsRetry && job.attemptsMade < 3) {
    logger.info(`Scheduling retry for job ${job.id}`);
  }
}
```

### 2. В AI Admin v2

```javascript
} catch (error) {
  const errorContext = {
    operation: 'ai_processing',
    companyId,
    commandsExecuted: results?.length > 0
  };
  
  const errorResult = errorMessages.getUserMessage(error, errorContext);
  
  return {
    success: false,
    response: errorMessages.formatUserResponse(errorResult),
    errorDetails: {
      technical: errorResult.technical,
      severity: errorResult.severity,
      needsRetry: errorResult.needsRetry
    }
  };
}
```

### 3. В Command Handler

```javascript
// Создаем ошибку с кодом
const error = new Error('Мастер не определен');
error.code = 'STAFF_NOT_SPECIFIED';
throw error;

// В обработчике ошибок
const errorContext = {
  operation: 'command_execution',
  command: cmd.command,
  params: cmd.params
};
const errorResult = errorMessages.getUserMessage(error, errorContext);
```

## Добавление новых типов ошибок

### 1. Добавить в карту ошибок

```javascript
// В error-messages.js
this.errorMap = {
  // ...
  'NEW_ERROR_CODE': 'Понятное сообщение для пользователя',
  'database_locked': 'База данных временно заблокирована. Попробуйте через минуту.'
};
```

### 2. Добавить контекстные подсказки

```javascript
this.contextualHelp = {
  // ...
  'NEW_ERROR_CODE': [
    'Подсказка 1',
    'Подсказка 2'
  ]
};
```

### 3. Определить серьезность и повторяемость

```javascript
getErrorSeverity(errorKey) {
  if (errorKey === 'NEW_ERROR_CODE') {
    return 'medium';
  }
  // ...
}

isRetryableError(errorKey) {
  const retryableErrors = [
    // ...
    'NEW_ERROR_CODE'
  ];
  // ...
}
```

## Лучшие практики

### 1. Всегда используйте контекст

```javascript
// ❌ Плохо
const result = errorMessages.getUserMessage(error);

// ✅ Хорошо
const result = errorMessages.getUserMessage(error, {
  operation: 'booking',
  companyId: 123,
  hasAlternatives: true
});
```

### 2. Создавайте ошибки с кодами

```javascript
// ❌ Плохо
throw new Error('Что-то пошло не так');

// ✅ Хорошо
const error = new Error('Время недоступно');
error.code = 'TIME_UNAVAILABLE';
throw error;
```

### 3. Логируйте технические детали

```javascript
// Логируем техническую ошибку
logger.error('Technical error:', {
  error: errorResult.technical,
  context: errorContext
});

// Отправляем пользователю понятное сообщение
await sendMessage(errorResult.message);
```

### 4. Обрабатывайте повторяемые ошибки

```javascript
if (errorResult.needsRetry) {
  // Планируем повторную попытку
  await scheduleRetry(job, errorResult);
} else {
  // Окончательная ошибка
  await notifyUser(errorResult);
}
```

## Примеры сообщений

### Временная проблема:
```
Извините за неудобства. Сервис временно недоступен. Попробуйте через несколько минут.

Пожалуйста, попробуйте еще раз.
```

### Бизнес-логика:
```
К сожалению, это время уже занято. Пожалуйста, выберите другое время.

Могу предложить ближайшее свободное время
Хотите посмотреть другого мастера?
```

### Валидация:
```
Пожалуйста, укажите корректный номер телефона.

Пример: +7 900 123-45-67
Или просто: 79001234567
```

## Тестирование

См. примеры в:
- `examples/error-handling-example.js` - демонстрация работы системы
- `src/utils/__tests__/error-messages.test.js` - unit тесты

Запуск примера:
```bash
node examples/error-handling-example.js
```

Запуск тестов:
```bash
npm test -- src/utils/__tests__/error-messages.test.js
```