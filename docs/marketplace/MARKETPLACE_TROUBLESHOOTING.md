# 🔧 YClients Marketplace - Troubleshooting Guide

## 📋 Оглавление

1. [Часто встречающиеся проблемы](#часто-встречающиеся-проблемы)
2. [Диагностика](#диагностика)
3. [Проблемы с подключением](#проблемы-с-подключением)
4. [Проблемы с WhatsApp](#проблемы-с-whatsapp)
5. [Проблемы с базой данных](#проблемы-с-базой-данных)
6. [Проблемы с API](#проблемы-с-api)
7. [Проблемы с WebSocket](#проблемы-с-websocket)
8. [Проблемы с производительностью](#проблемы-с-производительностью)
9. [Логирование и мониторинг](#логирование-и-мониторинг)
10. [Экстренное восстановление](#экстренное-восстановление)

## 🚨 Часто встречающиеся проблемы

### Топ-5 проблем и быстрые решения

| Проблема | Решение |
|----------|---------|
| QR-код не генерируется | Проверить Redis, перезапустить Baileys |
| WebSocket не подключается | Проверить JWT_SECRET, CORS настройки |
| WhatsApp отключается | Проверить сессию, очистить старые файлы |
| Callback не отправляется | Проверить YCLIENTS_API_KEY, webhook URL |
| База данных не синхронизируется | Запустить миграцию, проверить права |

## 🔍 Диагностика

### Быстрая проверка системы
```bash
# 1. Проверить статус всех сервисов
pm2 status

# 2. Проверить доступность API
curl https://ai-admin.app/marketplace/test

# 3. Проверить логи на ошибки
pm2 logs ai-admin-api --lines 100 | grep ERROR

# 4. Проверить Redis
redis-cli ping

# 5. Проверить базу данных
node scripts/check-database-connection.js
```

### Checklist диагностики
- [ ] PM2 процессы запущены и стабильны
- [ ] Redis доступен и работает
- [ ] База данных доступна
- [ ] Нет критических ошибок в логах
- [ ] API endpoints отвечают
- [ ] WebSocket сервер запущен
- [ ] Baileys manager инициализирован

## 💔 Проблемы с подключением

### Проблема: "JWT_SECRET is not defined"
**Симптомы**:
```
Error: JWT_SECRET is not defined
```

**Причина**: Отсутствует переменная окружения JWT_SECRET

**Решение**:
```bash
# 1. Генерация секретного ключа
openssl rand -base64 32

# 2. Добавление в .env
echo "JWT_SECRET=ваш_сгенерированный_ключ" >> .env

# 3. Перезапуск сервисов
pm2 restart all
```

### Проблема: "Cannot connect to Redis"
**Симптомы**:
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Причина**: Redis не запущен или неправильный порт

**Решение**:
```bash
# 1. Проверить статус Redis
systemctl status redis

# 2. Запустить Redis если не запущен
systemctl start redis

# 3. Проверить конфигурацию
grep "port" /etc/redis/redis.conf

# 4. Проверить подключение
redis-cli ping

# 5. Если используется пароль
redis-cli -a your_password ping
```

### Проблема: "Database connection failed"
**Симптомы**:
```
Error: Connection terminated unexpectedly
```

**Причина**: Проблемы с подключением к Supabase

**Решение**:
```bash
# 1. Проверить переменные окружения
grep SUPABASE .env

# 2. Тест подключения
curl -H "apikey: YOUR_SUPABASE_KEY" \
  https://your-project.supabase.co/rest/v1/companies

# 3. Проверить статус Supabase
# Перейти на https://app.supabase.com и проверить статус проекта

# 4. Перезапустить подключение
pm2 restart ai-admin-api
```

## 📱 Проблемы с WhatsApp

### Проблема: "QR код не генерируется"
**Симптомы**:
- Страница подключения показывает "Ожидание QR-кода..."
- В консоли ошибки WebSocket

**Причина**: Baileys не может создать сессию

**Решение**:
```bash
# 1. Проверить логи Baileys
pm2 logs ai-admin-api | grep -i baileys

# 2. Очистить старую сессию
rm -rf sessions/company_*

# 3. Проверить права на директорию
chmod 755 sessions
chown node:node sessions

# 4. Перезапустить API
pm2 restart ai-admin-api

# 5. Попробовать снова сгенерировать QR
curl https://ai-admin.app/marketplace/qr/your_token
```

### Проблема: "WhatsApp постоянно отключается"
**Симптомы**:
- Connection replaced every 5-6 seconds
- Duplicate messages

**Причина**: Множественные сессии или проблемы с Baileys

**Решение**:
```bash
# 1. Остановить все процессы
pm2 stop all

# 2. Очистить все сессии
rm -rf sessions/*

# 3. Очистить Redis кэш сессий
redis-cli
> KEYS "whatsapp:session:*"
> DEL whatsapp:session:...

# 4. Запустить заново
pm2 start ecosystem.config.js

# 5. Подключить WhatsApp заново через QR
```

### Проблема: "Invalid QR code"
**Симптомы**:
- QR-код отображается, но не сканируется
- WhatsApp показывает ошибку при сканировании

**Причина**: QR-код устарел или поврежден

**Решение**:
```javascript
// Проверить генерацию QR в baileys-manager.js
async generateQRForCompany(companyId) {
  // Убедиться что QR обновляется
  sock.ev.on('connection.update', (update) => {
    if (update.qr) {
      // QR должен обновляться каждые 20 секунд
      this.emit('qr', {
        companyId,
        qr: await QRCode.toDataURL(update.qr)
      });
    }
  });
}
```

## 💾 Проблемы с базой данных

### Проблема: "Column whatsapp_connected does not exist"
**Симптомы**:
```sql
ERROR: column "whatsapp_connected" does not exist
```

**Причина**: Не применена миграция для WhatsApp колонок

**Решение**:
```bash
# 1. Применить миграцию
psql $DATABASE_URL < scripts/database/add-whatsapp-columns.sql

# Или через Supabase UI:
# SQL Editor → New Query → Вставить и выполнить:
```
```sql
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS whatsapp_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS whatsapp_connected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS integration_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;

-- Создать индексы
CREATE INDEX IF NOT EXISTS idx_companies_whatsapp_connected
ON companies(whatsapp_connected)
WHERE whatsapp_connected = true;

CREATE INDEX IF NOT EXISTS idx_companies_whatsapp_phone
ON companies(whatsapp_phone)
WHERE whatsapp_phone IS NOT NULL;
```

### Проблема: ".single() throws when no rows"
**Симптомы**:
```
Error: No rows returned
```

**Причина**: Использование .single() когда записи может не быть

**Решение**:
```javascript
// Неправильно ❌
const { data, error } = await supabase
  .from('companies')
  .select('*')
  .eq('yclients_id', salonId)
  .single();

// Правильно ✅
const { data, error } = await supabase
  .from('companies')
  .select('*')
  .eq('yclients_id', salonId);

const company = data?.[0] || null;
```

## 🔌 Проблемы с API

### Проблема: "YclientsClient is not a constructor"
**Симптомы**:
```
TypeError: YclientsClient is not a constructor
```

**Причина**: Неправильный импорт класса

**Решение**:
```javascript
// Неправильно ❌
const YclientsClient = require('../../integrations/yclients/client');

// Правильно ✅
const { YclientsClient } = require('../../integrations/yclients/client');
```

### Проблема: "Rate limit exceeded"
**Симптомы**:
```
Error: Too many requests (429)
```

**Причина**: Превышен лимит запросов

**Решение**:
```bash
# 1. Проверить текущие лимиты
redis-cli
> KEYS "rate:*"
> TTL rate:ip:xxx.xxx.xxx.xxx

# 2. Сбросить счетчики (осторожно!)
> DEL rate:ip:xxx.xxx.xxx.xxx

# 3. Настроить лимиты в коде
// src/api/websocket/marketplace-socket.js
const RATE_LIMIT = {
  maxConnections: 10, // Увеличить если нужно
  windowMs: 60000
};
```

## 🌐 Проблемы с WebSocket

### Проблема: "WebSocket authentication failed"
**Симптомы**:
- Socket.io не может подключиться
- Ошибка 401 Unauthorized

**Причина**: Токен не передается правильно

**Решение**:
```javascript
// В клиенте (connect.html)
const socket = io('/marketplace', {
  transportOptions: {
    polling: {
      extraHeaders: {
        'x-auth-token': token // Правильно ✅
      }
    }
  },
  // Fallback для старых версий
  query: { token }
});

// На сервере (marketplace-socket.js)
io.use((socket, next) => {
  const token =
    socket.handshake.headers['x-auth-token'] || // Сначала headers
    socket.handshake.query.token ||             // Потом query
    socket.handshake.auth?.token;               // Потом auth

  if (!token) {
    return next(new Error('No token provided'));
  }
  // ...
});
```

### Проблема: "Socket disconnects immediately"
**Симптомы**:
- Подключение устанавливается и сразу разрывается
- Циклические переподключения

**Причина**: Проблемы с CORS или транспортом

**Решение**:
```javascript
// В marketplace-socket.js
const io = socketIO(server, {
  cors: {
    origin: [
      'https://ai-admin.app',
      'http://localhost:3000',
      // Добавить разрешенные origins
    ],
    credentials: true
  },
  transports: ['polling', 'websocket'] // Разрешить оба транспорта
});
```

## ⚡ Проблемы с производительностью

### Проблема: "Медленная генерация QR"
**Симптомы**:
- QR генерируется более 5 секунд
- Timeout при запросе QR

**Решение**:
```bash
# 1. Проверить нагрузку
pm2 monit

# 2. Проверить Redis производительность
redis-cli --latency

# 3. Оптимизировать Baileys
# В baileys-manager.js добавить:
const sock = makeWASocket({
  printQRInTerminal: false, // Отключить лишний вывод
  auth: state,
  logger: pino({ level: 'error' }), // Только ошибки
  browser: ['AI Admin', 'Chrome', '1.0.0'],
  connectTimeoutMs: 60000,
  defaultQueryTimeoutMs: undefined,
  keepAliveIntervalMs: 10000,
  emitOwnEvents: true,
  fireInitQueries: false // Не загружать историю
});
```

### Проблема: "Memory leak в rate limiter"
**Симптомы**:
- Растущее потребление памяти
- PM2 показывает увеличение RAM

**Решение**:
```javascript
// В marketplace-socket.js
// Добавить очистку старых записей
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimiter.entries()) {
    if (now - data.firstConnection > RATE_LIMIT.windowMs) {
      rateLimiter.delete(ip);
    }
  }
}, 5 * 60 * 1000); // Каждые 5 минут
```

## 📊 Логирование и мониторинг

### Просмотр логов
```bash
# Все логи
pm2 logs

# Логи конкретного процесса
pm2 logs ai-admin-api

# Последние 100 строк
pm2 logs ai-admin-api --lines 100

# Только ошибки
pm2 logs --err

# Поиск по логам
pm2 logs | grep -i "error"
pm2 logs | grep "marketplace"
pm2 logs | grep "whatsapp"
```

### Мониторинг в реальном времени
```bash
# PM2 монитор
pm2 monit

# Системный мониторинг
htop

# Redis мониторинг
redis-cli monitor

# Network мониторинг
netstat -tulpn | grep :3000
```

### Настройка алертов
```bash
# PM2 алерты при перезапуске
pm2 set pm2:max_restart 5
pm2 set pm2:min_uptime 10000

# Логирование в файл
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
```

## 🚑 Экстренное восстановление

### План действий при полном сбое

#### 1. Остановить все сервисы
```bash
pm2 kill
systemctl stop redis
systemctl stop nginx
```

#### 2. Очистить временные данные
```bash
rm -rf sessions/*
rm -rf /tmp/whatsapp-*
redis-cli FLUSHDB
```

#### 3. Проверить конфигурацию
```bash
# Проверить .env
cat .env | grep -E "(JWT|YCLIENTS|SUPABASE|REDIS)"

# Проверить ecosystem.config.js
cat ecosystem.config.js
```

#### 4. Запустить по одному
```bash
# Redis первым
systemctl start redis
redis-cli ping

# Затем API
pm2 start ecosystem.config.js --only ai-admin-api
pm2 logs ai-admin-api

# Затем остальное
pm2 start ecosystem.config.js

# Nginx последним
systemctl start nginx
```

#### 5. Проверить работоспособность
```bash
# API тест
curl https://ai-admin.app/marketplace/test

# WebSocket тест
wscat -c wss://ai-admin.app/marketplace

# Создать тестовую компанию
curl -X POST https://ai-admin.app/marketplace/register \
  -H "Content-Type: application/json" \
  -d '{"salon_id": 999999}'
```

### Backup и восстановление

#### Создание backup
```bash
# База данных
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Redis
redis-cli --rdb /tmp/redis-backup-$(date +%Y%m%d).rdb

# Конфигурация
tar -czf config-backup-$(date +%Y%m%d).tar.gz .env ecosystem.config.js
```

#### Восстановление из backup
```bash
# База данных
psql $DATABASE_URL < backup-20240916.sql

# Redis
redis-cli --rdb /tmp/redis-backup-20240916.rdb
redis-cli FLUSHDB
redis-cli --rdb-restore /tmp/redis-backup-20240916.rdb

# Конфигурация
tar -xzf config-backup-20240916.tar.gz
```

## 📞 Контакты поддержки

### Уровни эскалации

#### Level 1: Самостоятельное решение
- Использовать этот troubleshooting guide
- Проверить логи
- Перезапустить сервисы

#### Level 2: Техническая поддержка
- Email: support@ai-admin.app
- Telegram: @ai_admin_support
- Response time: 2-4 часа

#### Level 3: Разработчики
- GitHub Issues: https://github.com/vosarsen/ai_admin_v2/issues
- Emergency: @vosarsen (Telegram)
- Response time: 30 минут для критических проблем

### Информация для поддержки
При обращении предоставьте:
1. Описание проблемы
2. Скриншоты ошибок
3. Логи: `pm2 logs --lines 200`
4. Версия: `git rev-parse HEAD`
5. Статус: `pm2 status`
6. Время возникновения проблемы

## 🔄 Changelog исправлений

### v1.0.1 (16.09.2024)
- ✅ Исправлен импорт YclientsClient
- ✅ Добавлена очистка rate limiter
- ✅ Исправлена WebSocket аутентификация
- ✅ Добавлены WhatsApp колонки в БД
- ✅ Исправлены Supabase queries

### v1.0.0 (15.09.2024)
- 🚀 Первый релиз marketplace интеграции

---

*Последнее обновление: 16 сентября 2024*
*Версия: 1.0.1*