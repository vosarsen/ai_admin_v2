# Настройка MCP серверов для AI Admin v2

**Last Updated:** 2025-11-15

## Обзор

В проекте используются **5 MCP серверов**:
- 4 custom серверов (WhatsApp, Redis, Supabase, YClients)
- 1 официальный сервер (Notion)

**Конфигурация:** Все серверы настроены в `.mcp.json` (см. `.mcp.json.example`)

---

## Созданные MCP серверы

### 1. WhatsApp Test MCP (`mcp-whatsapp/`) - Custom
Автоматизация тестирования через WhatsApp.

**Инструменты:**
- `send_message` - отправка сообщений
- `get_last_response` - получение ответа бота
- `get_conversation` - история диалога
- `run_scenario` - запуск тестовых сценариев
- `clear_test_data` - очистка тестовых данных

### 2. Redis Context MCP (`mcp-redis/`) - Custom
Управление контекстом диалогов в Redis.

**Инструменты:**
- `get_context` - получить контекст пользователя
- `clear_context` - очистить контекст
- `set_booking_stage` - установить этап записи
- `list_active_contexts` - список активных диалогов
- `set_client_preferences` - установить предпочтения
- `simulate_returning_client` - симулировать постоянного клиента

### 3. Supabase MCP (`mcp-supabase/`) - Custom
Прямой доступ к Supabase database для отладки.

**Инструменты:**
- `query_table` - запрос данных из таблиц
- `insert_record` - вставка записей
- `update_record` - обновление записей
- `delete_record` - удаление записей

### 4. YClients MCP (`mcp-yclients/`) - Custom
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

### 5. Notion MCP (Official NPM Package)
Интеграция с Notion API для управления задачами и документацией.

**Package:** `@notionhq/notion-mcp-server` (v1.9.0)

**Инструменты:**
- `create_page` - создать страницу
- `update_page` - обновить страницу
- `query_database` - запрос к базе данных
- `create_database` - создать базу данных
- `append_block_children` - добавить контент

**Setup:** См. `docs/NOTION_MCP_SETUP.md` для полной инструкции

---

## Установка

### 1. Установите зависимости для custom серверов:

```bash
cd mcp/mcp-whatsapp && npm install && cd ../..
cd mcp/mcp-redis && npm install && cd ../..
cd mcp/mcp-supabase && npm install && cd ../..
cd mcp/mcp-yclients && npm install && cd ../..
```

**Notion MCP** устанавливается автоматически через npx (не требует локальной установки).

### 2. Настройте `.mcp.json`

Скопируйте example файл и заполните переменные:

```bash
cp .mcp.json.example .mcp.json
```

Отредактируйте `.mcp.json` и заполните:
- `NOTION_TOKEN` - Notion integration token (см. `docs/NOTION_MCP_SETUP.md`)
- `SECRET_KEY` - секрет для WhatsApp MCP
- `SUPABASE_URL` и `SUPABASE_KEY` - Supabase credentials
- `YCLIENTS_API_KEY` - YClients API ключ

**ВАЖНО:** `.mcp.json` в `.gitignore` - не коммитить с секретами!

### 3. Дополнительная настройка Notion

Для Notion MCP нужно дать доступ integration к страницам:

1. Создать integration на https://www.notion.so/my-integrations
2. Открыть нужные страницы → "..." → "Add connections" → выбрать integration
3. См. полную инструкцию в `docs/NOTION_MCP_SETUP.md`

### 4. Перезапустите Claude Code

После настройки `.mcp.json` перезапустите Claude Code - все 5 серверов подключатся автоматически.

## Проверка работы

После перезапуска доступны команды для всех 5 серверов:

```bash
# WhatsApp тестирование
@whatsapp send_message phone:"79001234567" message:"Привет"

# Redis контекст
@redis get_context phone:"79001234567"

# Supabase database
@supabase query_table table:"clients" filters:{"phone":"79001234567"}

# YClients API
@yclients get_available_slots date:"2025-11-15"

# Notion task management
@notion create_page parent_id:"xxxxx" title:"New Task"
```

## Требования для каждого сервера

| Сервер | Требования |
|--------|-----------|
| **whatsapp** | AI Admin API запущен локально (http://localhost:3000) |
| **redis** | Redis доступен (обычно через SSH tunnel на порту 6380) |
| **supabase** | Валидные SUPABASE_URL и SUPABASE_KEY |
| **yclients** | Валидный YCLIENTS_API_KEY |
| **notion** | Notion integration token + доступ к страницам |

## Troubleshooting

### Server fails to connect

```bash
# Проверить .mcp.json синтаксис
cat .mcp.json | jq .

# Проверить что все серверы в списке
cat .mcp.json | jq '.mcpServers | keys'

# Для custom серверов - проверить зависимости
cd mcp/mcp-redis && npm list
```

### Environment variables not set

Убедитесь что в `.mcp.json` заполнены все переменные окружения для нужных серверов.

### Notion server specific

См. `docs/NOTION_MCP_SETUP.md` для детального troubleshooting.

---

**Все серверы используют stdio транспорт** и интегрируются прозрачно с Claude Code.