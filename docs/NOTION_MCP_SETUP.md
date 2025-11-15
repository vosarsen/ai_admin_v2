# Notion MCP Server Setup

## Overview

Интеграция Claude Code с Notion через официальный MCP сервер `@notionhq/notion-mcp-server`.

**Note:** Это один из 5 MCP серверов в проекте AI Admin v2. Все серверы настроены в едином файле `.mcp.json`:
- `@notion` (Official) - Notion task management
- `@whatsapp` (Custom) - WhatsApp testing
- `@redis` (Custom) - Redis context cache
- `@supabase` (Custom) - Supabase database
- `@yclients` (Custom) - YClients API

См. также: `mcp/README.md` для полной информации о всех MCP серверах.

## Prerequisites

- Node.js и npx установлены
- Notion account
- `.mcp.json` настроен (см. `.mcp.json.example`)

## Setup Steps

### 1. Создать Notion Integration

1. Перейти на https://www.notion.so/my-integrations
2. Нажать **"+ New integration"**
3. Заполнить форму:
   - **Name**: AI Admin v2 - Claude Code
   - **Associated workspace**: Выбрать ваш workspace
   - **Content Capabilities**: Выбрать нужные права (Read content, Update content, Insert content)
4. Нажать **Submit**
5. Скопировать **Internal Integration Token** (начинается с `ntn_` или `secret_`)

### 2. Дать доступ к Notion страницам

1. Открыть нужную Notion страницу/database
2. Нажать **"..."** (три точки) → **"Add connections"**
3. Выбрать вашу интеграцию **"AI Admin v2 - Claude Code"**
4. Повторить для всех страниц, к которым нужен доступ

### 3. Настроить MCP сервер

Добавить API ключ в `.mcp.json`:

```bash
# Скопировать example файл
cp .mcp.json.example .mcp.json

# Отредактировать и вставить ваш NOTION_TOKEN
# ВАЖНО: .mcp.json в .gitignore, не коммитить!
```

### 4. Перезапустить Claude Code

Перезапустить сессию Claude Code для активации MCP сервера.

## Usage

После настройки доступны команды через `@notion`:

```bash
# Примеры использования
@notion list_databases
@notion query_database database_id:xxxxx
@notion create_page parent_id:xxxxx title:"New Page"
@notion append_block block_id:xxxxx content:"New content"
```

## Integration Ideas

### 1. Dev Docs → Notion

Автоматическое создание Notion страниц из `dev/active/*/tasks.md`:

```javascript
// При /dev-docs создавать Notion database
@notion create_database title:"AI Admin Tasks"

// При обновлении tasks.md синхронизировать
@notion update_page page_id:xxxxx content:tasks_content
```

### 2. TodoWrite → Notion

Синхронизация TodoWrite с Notion:

```javascript
// Когда Claude обновляет todos
TodoWrite(todos) → @notion create_page in tasks_database

// Статусы синхронизируются
- pending → Notion: "Not Started"
- in_progress → Notion: "In Progress"
- completed → Notion: "Done"
```

### 3. Session Notes

Сохранение заметок из сессий:

```javascript
// После завершения сессии
@notion create_page parent:"Session Notes" title:"2025-11-15 Database Migration"
```

## Troubleshooting

### Server not starting

```bash
# Проверить npx доступен
which npx

# Проверить установку вручную
npx -y @notionhq/notion-mcp-server
```

### API Key issues

```bash
# Проверить формат ключа в .mcp.json
# Должен начинаться с ntn_ (новый формат) или secret_ (старый формат)
cat .mcp.json | grep NOTION_TOKEN

# Проверить доступ к страницам
# Убедиться, что integration добавлена к нужным страницам
```

### Connection errors

```bash
# Проверить .mcp.json
cat .mcp.json

# Проверить logs
# MCP сервер выводит логи в stderr Claude Code
```

## References

- [Notion MCP Server Docs](https://developers.notion.com/docs/get-started-with-mcp)
- [Notion API Reference](https://developers.notion.com/reference/intro)
- [Claude Code MCP Guide](https://code.claude.com/docs/mcp)

## Security Notes

⚠️ **ВАЖНО:**
- `.mcp.json` содержит секретные ключи - НЕ коммитить!
- `.mcp.json` уже добавлен в `.gitignore`
- Использовать `.mcp.json.example` для документации
- Ключи хранить в 1Password или другом секретном хранилище

---
**Created:** 2025-11-15
**Status:** Ready to use (после добавления NOTION_API_KEY)
