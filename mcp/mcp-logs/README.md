# MCP Logs Server для AI Admin v2

MCP сервер для быстрого доступа к логам и управления PM2 процессами на production сервере.

## Установка

1. Установить зависимости:
```bash
cd mcp-logs
npm install
```

2. Настроить SSH доступ в `server.js`:
```javascript
const SSH_CONFIG = {
  host: '46.149.70.219',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync('/path/to/your/key') // или password: 'your-password'
};
```

3. Перезапустить Claude Desktop для активации MCP

## Использование

### Доступные команды:

#### @logs logs_tail
Получить последние N строк логов
```
@logs logs_tail service="ai-admin-worker-v2" lines=100
```

#### @logs logs_search
Поиск по логам
```
@logs logs_search pattern="error" lines=10
```

#### @logs logs_errors
Показать последние ошибки
```
@logs logs_errors minutes=60
```

#### @logs pm2_status
Статус всех PM2 процессов
```
@logs pm2_status
```

#### @logs pm2_restart
Перезапустить сервис
```
@logs pm2_restart service="ai-admin-worker-v2"
```

## Примеры использования

### Типичный debugging flow:
1. Отправить тестовое сообщение в WhatsApp
2. `@logs logs_tail lines=50` - посмотреть логи
3. `@logs logs_search pattern="79123456789"` - найти логи конкретного пользователя
4. Исправить ошибку локально
5. Commit, push, pull на сервере
6. `@logs pm2_restart` - перезапустить воркер
7. `@logs logs_tail lines=20` - проверить что все работает

### Мониторинг ошибок:
```
@logs logs_errors minutes=30
```

### Поиск конкретной ошибки:
```
@logs logs_search pattern="TypeError" lines=10
```

## Преимущества

- **Скорость**: мгновенный доступ без SSH
- **Удобство**: простые команды вместо длинных SSH строк
- **Контекст**: видите логи прямо в Claude
- **Эффективность**: меньше переключений между окнами