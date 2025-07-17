# Настройка MCP серверов для AI Admin v2

## Созданные MCP серверы

### 1. WhatsApp Test MCP (`mcp-whatsapp/`)
Автоматизация тестирования через WhatsApp.

**Инструменты:**
- `send_message` - отправка сообщений
- `get_last_response` - получение ответа бота
- `get_conversation` - история диалога
- `run_scenario` - запуск тестовых сценариев
- `clear_test_data` - очистка тестовых данных

### 2. Redis Context MCP (`mcp-redis/`)
Управление контекстом диалогов в Redis.

**Инструменты:**
- `get_context` - получить контекст пользователя
- `clear_context` - очистить контекст
- `set_booking_stage` - установить этап записи
- `list_active_contexts` - список активных диалогов
- `set_client_preferences` - установить предпочтения
- `simulate_returning_client` - симулировать постоянного клиента

### 3. YClients MCP (`mcp-yclients/`)
Прямой доступ к YClients API для отладки.

**Инструменты:**
- `get_services` - список услуг
- `get_available_slots` - доступные слоты
- `create_test_booking` - создать тестовую запись
- `get_booking` - информация о записи
- `cancel_booking` - отменить запись
- `get_staff` - список сотрудников
- `get_staff_schedule` - расписание мастера
- `search_clients` - поиск клиентов
- `get_client_visits` - история визитов

## Установка

### 1. Установите зависимости для каждого сервера:

```bash
cd mcp-whatsapp && npm install && cd ..
cd mcp-redis && npm install && cd ..
cd mcp-yclients && npm install && cd ..
```

### 2. Настройте переменные окружения

Создайте файл `.env.mcp` в корне проекта:

```bash
# WhatsApp Test MCP
AI_ADMIN_API_URL=http://localhost:3000
SECRET_KEY=your-secret-key

# Redis Context MCP
REDIS_URL=redis://localhost:6379

# YClients MCP
YCLIENTS_API_KEY=your-yclients-api-key
YCLIENTS_USER_TOKEN=optional-user-token
```

### 3. Обновите mcp.json

Файл `mcp.json` уже обновлен со всеми тремя серверами.

### 4. Перезапустите Claude Code

После настройки перезапустите Claude Code, чтобы подключились новые MCP серверы.

## Проверка работы

После перезапуска я смогу использовать новые инструменты:

```bash
# WhatsApp тестирование
@whatsapp send_message phone="79001234567" message="Привет"

# Redis контекст
@redis get_context phone="79001234567"

# YClients API
@yclients get_available_slots date="2024-07-20"
```

## Примечания

1. **WhatsApp MCP** требует запущенный AI Admin API локально
2. **Redis MCP** требует доступ к Redis серверу
3. **YClients MCP** требует валидный API ключ YClients

Все серверы используют stdio транспорт и интегрируются прозрачно с Claude Code.