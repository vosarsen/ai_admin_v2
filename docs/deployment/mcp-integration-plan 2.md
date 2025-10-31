# MCP Integration Plan для AI Admin v2

## 🎯 Текущие MCP серверы

### 1. ✅ Supabase MCP
**Статус**: Уже работает
**Использование**: 
- `@supabase query_table` - запросы к таблицам
- `@supabase search_bookings` - поиск записей
- Прямой доступ к данным без написания скриптов

### 2. 🚧 Logs MCP
**Статус**: Создан, требует настройки
**Использование**:
- `@logs logs_tail` - последние логи
- `@logs logs_search` - поиск ошибок
- `@logs pm2_restart` - перезапуск сервисов

## 🚀 Предлагаемые MCP серверы

### 3. YClients MCP
**Цель**: Прямое взаимодействие с YClients API
```javascript
// Возможности:
@yclients get_services company_id=962302
@yclients get_slots company_id=962302 date="2024-07-20"
@yclients create_booking {...booking_data}
@yclients get_booking id=12345
```

**Преимущества**:
- Быстрое тестирование API endpoints
- Отладка booking flow без кода
- Проверка доступных слотов в реальном времени

### 4. WhatsApp Test MCP
**Цель**: Автоматизация тестирования
```javascript
// Возможности:
@whatsapp send_test message="Хочу записаться" phone="79001234567"
@whatsapp get_last_response
@whatsapp simulate_conversation scenario="booking_flow"
```

**Преимущества**:
- Не нужно вручную отправлять сообщения
- Автоматические тест-сценарии
- Быстрая проверка изменений

### 5. Redis Context MCP
**Цель**: Управление контекстом диалогов
```javascript
// Возможности:
@redis get_context phone="79001234567"
@redis clear_context phone="79001234567"
@redis set_context phone="79001234567" data={...}
@redis list_active_conversations
```

**Преимущества**:
- Отладка состояния диалогов
- Быстрый сброс для тестирования
- Мониторинг активных сессий

### 6. Deploy MCP
**Цель**: Автоматизация деплоя
```javascript
// Возможности:
@deploy status
@deploy push_changes
@deploy rollback version="previous"
@deploy run_migrations
```

**Преимущества**:
- Деплой в один клик
- Откат при проблемах
- Статус всех сервисов

### 7. Monitoring MCP
**Цель**: Real-time мониторинг
```javascript
// Возможности:
@monitor stats
@monitor errors last_hour=1
@monitor performance service="ai-admin-v2"
@monitor queue_status
```

**Преимущества**:
- Метрики в реальном времени
- Быстрое обнаружение проблем
- Анализ производительности

## 📋 План внедрения

### Phase 1 (Сейчас)
1. ✅ Supabase MCP - работает
2. 🔧 Настроить Logs MCP
3. 🔧 Создать YClients MCP

### Phase 2 (Следующая неделя)
4. WhatsApp Test MCP
5. Redis Context MCP

### Phase 3 (По необходимости)
6. Deploy MCP
7. Monitoring MCP

## 💡 Как это ускорит разработку

### Текущий процесс (без MCP):
1. Написать код для проверки YClients
2. Создать тестовый скрипт
3. Запустить скрипт
4. Проверить логи через SSH
5. Отправить тестовое сообщение вручную
6. Снова проверить логи
7. Повторить...

**Время**: 5-10 минут на итерацию

### С MCP:
1. `@yclients get_slots` - проверить слоты
2. `@whatsapp send_test` - отправить тест
3. `@logs logs_tail` - посмотреть результат
4. `@redis get_context` - проверить контекст

**Время**: 30 секунд на итерацию

## 🎯 Приоритеты

### Высокий приоритет:
1. **YClients MCP** - постоянно нужен для отладки booking flow
2. **WhatsApp Test MCP** - ускорит тестирование в 10x

### Средний приоритет:
3. **Redis Context MCP** - полезен для отладки состояний
4. **Deploy MCP** - упростит деплой

### Низкий приоритет:
5. **Monitoring MCP** - nice to have для production

## 📝 Пример использования всех MCP вместе

```bash
# Проверяем доступные слоты
@yclients get_slots company_id=962302 service_id=15031280

# Отправляем тестовое сообщение
@whatsapp send_test message="Хочу записаться на стрижку завтра в 15:00"

# Смотрим логи обработки
@logs logs_tail lines=30

# Проверяем контекст
@redis get_context phone="79001234567"

# Если нужно, смотрим в БД
@supabase query_table table="bookings" filters={"client_phone": "79001234567"}

# Если все ок - деплоим
@deploy push_changes
```

## 🔧 Технические детали

### Структура MCP сервера:
```javascript
// Базовый шаблон
const server = new Server({
  name: 'mcp-servicename',
  version: '1.0.0',
});

// Регистрация инструментов
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'tool_name',
      description: 'What it does',
      inputSchema: { /* параметры */ }
    }
  ]
}));

// Обработка вызовов
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Логика обработки
});
```

### Интеграция с Claude:
1. Добавить в `mcp.json`
2. Перезапустить Claude Desktop
3. Использовать через `@servername command`

## 🎉 Результат

С полным набором MCP серверов разработка AI Admin v2 станет:
- **Быстрее** в 5-10 раз
- **Удобнее** - все в одном окне
- **Надежнее** - меньше ручных ошибок
- **Прозрачнее** - видно все этапы обработки