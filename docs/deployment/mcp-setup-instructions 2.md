# MCP Setup Instructions

## 1. Настройка SSH для Logs MCP

### Вариант 1: Использование пароля (проще)
Добавьте в `.env` файл:
```bash
# SSH credentials для доступа к серверу
SERVER_HOST=46.149.70.219
SERVER_USER=root
SERVER_PASSWORD=ваш_ssh_пароль
```

### Вариант 2: Использование SSH ключа (безопаснее)
```bash
# SSH credentials для доступа к серверу
SERVER_HOST=46.149.70.219
SERVER_USER=root
SSH_PRIVATE_KEY=/Users/your_username/.ssh/id_rsa
```

## 2. Настройка Redis для Redis MCP

### На локальной машине (macOS):
```bash
# Установка Redis через Homebrew
brew install redis

# Запуск Redis
brew services start redis

# Или запуск вручную
redis-server
```

### На сервере (Ubuntu/Debian):
```bash
# Установка Redis
sudo apt update
sudo apt install redis-server

# Включение автозапуска
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Проверка статуса
sudo systemctl status redis-server
```

### Настройка подключения:
Redis MCP автоматически использует пароль из переменной `REDIS_PASSWORD` в `.env`.

Для локальной разработки без пароля:
```bash
REDIS_URL=redis://localhost:6379
```

Для продакшена с паролем:
```bash
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=70GB32AhHvMisfK8LtluTbtkWTnTj5jSrOdQj7d1QMg=
```

## 3. Проверка работы

### Тест Logs MCP:
```bash
# В Claude Code
@logs pm2_status
@logs logs_tail service:"ai-admin-worker-v2" lines:50
```

### Тест Redis MCP:
```bash
# Сначала запустите Redis локально
redis-server

# Затем в Claude Code
@redis get_all_keys pattern:"*" limit:10
@redis get_context phone:"79001234567"
```

## 4. Troubleshooting

### Logs MCP: "Missing SSH authentication"
- Убедитесь, что добавили `SERVER_PASSWORD` в `.env`
- Проверьте, что пароль правильный: `ssh root@46.149.70.219`

### Redis MCP: "ECONNREFUSED"
- Запустите Redis: `redis-server` или `brew services start redis`
- Проверьте, что Redis работает: `redis-cli ping`
- Если используете пароль: `redis-cli -a ваш_пароль ping`

### Полезные команды:
```bash
# Проверить все MCP серверы
node test-mcp-servers.js

# Посмотреть логи Redis
redis-cli monitor

# Проверить SSH доступ
ssh root@46.149.70.219 "pm2 status"
```