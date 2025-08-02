# Testing Guide

## Обзор

AI Admin v2 имеет комплексную систему тестирования, включающую unit, integration и e2e тесты.

## Структура тестов

```
test/
├── unit/                    # Unit тесты для отдельных модулей
│   └── ai-admin-v2/        # Тесты AI Admin v2
├── integration/            # Integration тесты
│   ├── webhook-flow.test.js       # Webhook endpoints
│   ├── message-processing.test.js # Обработка сообщений
│   └── booking-flow.test.js       # Полный flow записи
└── e2e/                    # End-to-end тесты
    ├── booking-scenario.e2e.js    # Сценарии записи
    ├── performance.e2e.js         # Производительность
    └── reliability.e2e.js         # Надежность
```

## Запуск тестов

### Unit тесты

```bash
# Все unit тесты
npm test

# С покрытием
npm run test:coverage

# В watch режиме
npm run test:watch

# Конкретный файл
npm test -- test/unit/ai-admin-v2/index.test.js
```

### Integration тесты

```bash
# Все integration тесты
npm test -- test/integration

# Конкретный тест
npm test -- test/integration/booking-flow.test.js
```

### E2E тесты

**Важно**: E2E тесты требуют запущенных сервисов!

```bash
# Запустить сервисы в тестовом режиме
NODE_ENV=test npm start &
NODE_ENV=test npm run worker:v2 &

# Запустить E2E тесты
./test/e2e/booking-scenario.e2e.js
./test/e2e/performance.e2e.js
./test/e2e/reliability.e2e.js
```

## Типы тестов

### 1. Unit тесты

Тестируют отдельные функции и классы в изоляции:

```javascript
describe('AIAdminV2', () => {
  it('should process simple greeting', async () => {
    const result = await AIAdminV2.processMessage('Привет', phone, companyId);
    expect(result.success).toBe(true);
    expect(result.response).toContain('Здравствуйте');
  });
});
```

**Что тестируем:**
- Логику обработки сообщений
- Форматирование ответов
- Извлечение команд
- Обработку ошибок

### 2. Integration тесты

Тестируют взаимодействие между компонентами:

```javascript
describe('Webhook Flow', () => {
  it('should accept valid webhook', async () => {
    const response = await request(app)
      .post('/webhook/whatsapp')
      .set('X-Hub-Signature', validSignature)
      .send(webhookData);
      
    expect(response.status).toBe(200);
    expect(messageQueue.addMessage).toHaveBeenCalled();
  });
});
```

**Что тестируем:**
- API endpoints
- Webhook обработку
- Queue взаимодействие
- Аутентификацию

### 3. E2E тесты

Тестируют полные сценарии использования:

#### Booking Scenarios (`booking-scenario.e2e.js`)

Тестирует реальные сценарии записи:
- Новый клиент
- Постоянный клиент
- Отмена записи
- Обработка ошибок

```bash
./test/e2e/booking-scenario.e2e.js
```

#### Performance Tests (`performance.e2e.js`)

Тестирует производительность под нагрузкой:
- Load test (1, 5, 10, 20 пользователей)
- Stress test (поиск точки отказа)
- Spike test (резкий рост нагрузки)

```bash
./test/e2e/performance.e2e.js
```

Целевые показатели:
- Response time < 5 секунд
- Throughput > 100 сообщений/минуту
- Success rate > 95%

#### Reliability Tests (`reliability.e2e.js`)

Тестирует надежность системы:
- Обработка дубликатов
- Восстановление после ошибок
- Большие сообщения
- Параллельные пользователи
- Спецсимволы и emoji
- Circuit breaker

```bash
./test/e2e/reliability.e2e.js
```

## Мокирование

### Внешние сервисы

```javascript
jest.mock('../../src/integrations/whatsapp/client');
jest.mock('../../src/services/ai-admin-v2');

// В тесте
whatsappClient.sendMessage.mockResolvedValue({
  success: true,
  messageId: 'msg-123'
});
```

### База данных

```javascript
jest.mock('../../src/database/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ data: mockData })
  }
}));
```

## Тестовые данные

### Константы

```javascript
const TEST_PHONE = '79999999999';
const TEST_COMPANY_ID = 962302;
const TEST_WEBHOOK_SECRET = 'test-secret';
```

### Фикстуры

Создавайте переиспользуемые тестовые данные:

```javascript
const fixtures = {
  validWebhook: {
    from: '79001234567@c.us',
    message: 'Тестовое сообщение',
    timestamp: new Date().toISOString()
  },
  
  bookingContext: {
    stage: 'selecting_service',
    services: [/* ... */]
  }
};
```

## Best Practices

### 1. Изоляция тестов

Каждый тест должен быть независимым:

```javascript
beforeEach(() => {
  jest.clearAllMocks();
  // Сброс состояния
});

afterEach(() => {
  // Очистка
});
```

### 2. Описательные имена

```javascript
// ✅ Хорошо
it('should reject webhook with invalid HMAC signature')

// ❌ Плохо
it('test webhook auth')
```

### 3. Arrange-Act-Assert

```javascript
it('should process booking request', async () => {
  // Arrange
  const message = 'Хочу записаться';
  const mockResponse = { success: true };
  AIService.processMessage.mockResolvedValue(mockResponse);
  
  // Act
  const result = await processBooking(message);
  
  // Assert
  expect(result.success).toBe(true);
  expect(AIService.processMessage).toHaveBeenCalledWith(message);
});
```

### 4. Тестирование ошибок

```javascript
it('should handle network errors gracefully', async () => {
  // Arrange
  mockAPI.mockRejectedValue(new Error('Network error'));
  
  // Act & Assert
  await expect(makeRequest()).rejects.toThrow('Network error');
});
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run unit tests
      run: npm test
      
    - name: Run integration tests
      run: npm test -- test/integration
      
    - name: Upload coverage
      uses: codecov/codecov-action@v1
```

## Отладка тестов

### Verbose mode

```bash
npm test -- --verbose
```

### Отладка конкретного теста

```bash
node --inspect-brk node_modules/.bin/jest test/unit/ai-admin-v2/index.test.js
```

### Логирование в тестах

```javascript
// Временно включить console.log
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

// В конкретном тесте
console.log = jest.fn(); // Отключить
console.log = console.log.bind(console); // Включить
```

## Метрики тестирования

### Покрытие кода

Целевое покрытие:
- Statements: > 80%
- Branches: > 75%
- Functions: > 80%
- Lines: > 80%

### Время выполнения

- Unit тесты: < 10 секунд
- Integration тесты: < 30 секунд
- E2E тесты: < 5 минут

## Troubleshooting

### Тесты зависают

1. Проверьте таймауты:
```javascript
jest.setTimeout(30000); // 30 секунд
```

2. Убедитесь, что все промисы резолвятся
3. Проверьте, что моки возвращают данные

### Флакующие тесты

1. Избегайте зависимости от времени
2. Используйте `waitFor` для асинхронных операций
3. Мокайте внешние сервисы

### Ошибки окружения

1. Проверьте NODE_ENV=test
2. Убедитесь в наличии .env.test
3. Изолируйте тестовую БД