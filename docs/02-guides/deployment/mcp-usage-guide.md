# MCP Servers Usage Guide

## Обзор

MCP (Model Context Protocol) серверы предоставляют прямой доступ к различным сервисам AI Admin v2 из Claude Code.

## Доступные MCP серверы

### 1. Redis (@redis) ✅
Управление контекстом диалогов и кэшем.

**Требования:**
- SSH туннель на порт 6380: `./scripts/maintain-redis-tunnel.sh start`

**Команды:**
```
@redis get_context phone:79001234567
@redis clear_context phone:79001234567  
@redis set_booking_stage phone:79001234567 stage:selecting_service
@redis list_active_contexts
```

### 2. WhatsApp (@whatsapp) ⚠️
Тестирование WhatsApp интеграции.

**Статус:** Требует перезапуска Claude Code после обновления

**Альтернатива:** 
```bash
# Используйте прямые скрипты для отправки сообщений
node send-whatsapp.js 79001234567 "Ваше сообщение"
node test-direct-webhook.js "Сообщение"
```

### 3. Supabase (@supabase) ✅
Прямой доступ к базе данных.

**Команды:**
```
@supabase list_tables
@supabase query_table table:services
@supabase search_bookings clientPhone:79001234567
```

### 4. YClients (@yclients) ✅
Доступ к YClients API.

**Команды:**
```
@yclients get_services
@yclients get_available_slots date:2025-07-21
@yclients get_staff
```

### 5. Logs (@logs) ✅
Просмотр логов сервера через SSH.

**Команды:**
```
@logs logs_tail service:ai-admin-worker-v2 lines:50
@logs logs_search pattern:"error" service:ai-admin-worker-v2
@logs pm2_status
```

### 6. Test Simple (@test-simple) ✅
Тестовый сервер для проверки работы MCP.

**Команды:**
```
@test-simple echo message:"Test message"
```

## Быстрая проверка

1. Проверьте статус MCP серверов:
   ```
   /mcp
   ```

2. Проверьте работу простого сервера:
   ```
   @test-simple echo message:"Hello MCP"
   ```

3. Проверьте Redis (требует туннель):
   ```
   ./scripts/maintain-redis-tunnel.sh start
   @redis list_active_contexts
   ```

## Решение проблем

### MCP сервер не отвечает
1. Проверьте список серверов: `claude mcp list`
2. Перезапустите Claude Code
3. Проверьте логи: `tail -f ~/.claude-code.log`

### Redis не подключается
1. Проверьте туннель: `./scripts/maintain-redis-tunnel.sh status`
2. Запустите туннель: `./scripts/maintain-redis-tunnel.sh start`
3. Проверьте порт: `lsof -i :6380`

### WhatsApp не работает через MCP
Используйте альтернативные скрипты:
```bash
# Быстрая отправка
node test-direct-webhook.js "Привет"

# С указанием номера
node send-whatsapp.js 79001234567 "Привет"
```

## Полезные команды для тестирования

```bash
# Отправить тестовое сообщение
node send-whatsapp.js 79001234567 "Хочу записаться"

# Посмотреть ответ бота
ssh root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 50 | grep 'Bot response'"

# Очистить контекст диалога
@redis clear_context phone:79001234567

# Проверить доступные слоты
@yclients get_available_slots date:2025-07-21

# Посмотреть ошибки в логах
@logs logs_errors service:ai-admin-worker-v2 minutes:30
```