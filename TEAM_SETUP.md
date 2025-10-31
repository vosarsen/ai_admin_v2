# Инструкция по настройке проекта AI Admin v2 для команды

## 🚀 Быстрый старт для нового разработчика

### 1. Клонирование репозитория

```bash
# Создать папку для проектов
mkdir -p ~/Documents/GitHub
cd ~/Documents/GitHub

# Клонировать репозиторий (замените vosarsen на правильный username)
git clone https://github.com/vosarsen/ai_admin_v2.git
cd ai_admin_v2

# Переключиться на рабочую ветку
git checkout feature/redis-context-cache
```

### 2. Настройка окружения

Получите файл `.env.for-team` через AirDrop или мессенджер от команды, затем:

```bash
# Переименовать в .env
mv .env.for-team .env

# Запустить скрипт настройки
./scripts/setup-for-team.sh
```

### 3. Настройка CLAUDE.md для Claude Code

Файл `CLAUDE.md` уже есть в репозитории. Claude Code автоматически его подхватит.

### 4. Настройка MCP серверов (опционально, но рекомендуется)

#### 4.1 Установите MCP серверы:

```bash
cd mcp
npm install
```

#### 4.2 Настройте конфиг Claude Desktop:

Откройте настройки Claude Desktop и добавьте в MCP серверы:

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["/Users/[ваше-имя]/Documents/GitHub/ai_admin_v2/mcp/whatsapp-server.js"],
      "env": {
        "API_URL": "https://admin.salondiolita.ru/ai/admin/api/v2",
        "API_TOKEN": "получите от команды"
      }
    },
    "redis": {
      "command": "node",
      "args": ["/Users/[ваше-имя]/Documents/GitHub/ai_admin_v2/mcp/redis-server.js"],
      "env": {
        "REDIS_HOST": "localhost",
        "REDIS_PORT": "6380"
      }
    },
    "logs": {
      "command": "node",
      "args": ["/Users/[ваше-имя]/Documents/GitHub/ai_admin_v2/mcp/logs-server.js"],
      "env": {
        "SSH_KEY": "/Users/[ваше-имя]/.ssh/id_ed25519_ai_admin",
        "SSH_HOST": "root@46.149.70.219"
      }
    },
    "supabase": {
      "command": "node",
      "args": ["/Users/[ваше-имя]/Documents/GitHub/ai_admin_v2/mcp/supabase-server.js"],
      "env": {
        "SUPABASE_URL": "https://lcwvtrscyxiqpguzqkqx.supabase.co",
        "SUPABASE_KEY": "получите от команды"
      }
    }
  }
}
```

### 5. SSH ключ для доступа к серверу (если нужно)

Получите файл SSH ключа от команды и сохраните:

```bash
# Создать папку .ssh если нет
mkdir -p ~/.ssh

# Сохранить ключ (получите файл от команды)
cp ~/Downloads/id_ed25519_ai_admin ~/.ssh/
chmod 600 ~/.ssh/id_ed25519_ai_admin

# Проверить подключение
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "echo 'Подключение успешно!'"
```

### 6. Redis туннель (для локальной разработки)

Если нужен доступ к Redis:

```bash
# Запустить туннель
./scripts/maintain-redis-tunnel.sh start

# Проверить статус
./scripts/maintain-redis-tunnel.sh status

# Остановить
./scripts/maintain-redis-tunnel.sh stop
```

## 📚 Основные команды

### Синхронизация с GitHub

```bash
# Получить последние изменения
./scripts/sync-for-team.sh

# Или вручную
git pull origin feature/redis-context-cache
```

### Отправка изменений

```bash
# Добавить все изменения
git add .

# Создать коммит (используйте осмысленные сообщения)
git commit -m "fix: описание исправления"
# или
git commit -m "feat: описание новой функции"

# Отправить на GitHub
git push origin feature/redis-context-cache
```

### Локальная разработка

```bash
# Запустить в режиме разработки
npm run dev

# Запустить тесты
npm test

# Проверить линтинг
npm run lint
```

## 🔧 Работа с Claude Code

### Команды в Claude Code

- Всегда говорите Claude Code проверять `CLAUDE.md` для контекста проекта
- Используйте MCP серверы вместо SSH где возможно (быстрее)
- Примеры команд:
  - "Прочитай CLAUDE.md и покажи текущий статус проекта"
  - "Используй @whatsapp для отправки тестового сообщения"
  - "Проверь логи через @logs"

### Важные файлы

- `CLAUDE.md` - краткая справка по проекту
- `config/project-docs/CONTEXT.md` - где остановились
- `config/project-docs/TASK.md` - текущие задачи
- `docs/ARCHITECTURE.md` - архитектура системы
- `docs/TROUBLESHOOTING.md` - решение проблем

## ⚠️ Важные правила

1. **НИКОГДА** не тестируйте на реальных клиентах!
   - Используйте только тестовый номер: 89686484488

2. **Всегда** работайте в ветке `feature/redis-context-cache`

3. **Коммитьте часто** - после каждого логического изменения

4. **Не коммитьте** файлы `.env`, ключи, пароли

5. **Перед push** проверьте что не сломали:
   ```bash
   npm run lint
   npm test
   ```

## 📞 Контакты и помощь

- GitHub Issues: https://github.com/vosarsen/ai_admin_v2/issues
- Документация: папка `docs/`
- WhatsApp для тестов: +79936363848
- Тестовый клиент: 89686484488

## 🔐 Безопасность

- Никогда не коммитьте секреты (API ключи, токены)
- Используйте `.env.for-team` для безопасной передачи конфигов
- SSH ключи храните в `~/.ssh/` с правами 600
- При сомнениях - спрашивайте у команды

---
Последнее обновление: 29 сентября 2025