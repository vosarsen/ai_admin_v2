# 🚨 КРИТИЧЕСКИЕ ТРЕБОВАНИЯ для работы YClients Marketplace интеграции

## ❌ БЕЗ ЭТОГО НИЧЕГО НЕ РАБОТАЕТ

### 1. Токены от YClients (ОБЯЗАТЕЛЬНО!)

После регистрации в маркетплейсе YClients вы получите:
- **Partner Token** - основной токен для работы с API
- **Application ID** - идентификатор вашего приложения

Без этих токенов интеграция **НЕ БУДЕТ РАБОТАТЬ ВООБЩЕ**.

### 2. Переменные окружения (.env)

```bash
# ОБЯЗАТЕЛЬНЫЕ переменные - добавьте в /opt/ai-admin/.env
YCLIENTS_PARTNER_TOKEN=ваш_partner_token_от_yclients
YCLIENTS_APP_ID=ваш_application_id_от_yclients
JWT_SECRET=сгенерируйте_случайную_строку_32_символа
```

Генерация JWT_SECRET:
```bash
ssh root@46.149.70.219
cd /opt/ai-admin
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
```

### 3. База данных - применение миграции

```bash
# Вариант 1: Через Supabase UI
# Откройте SQL Editor в Supabase и выполните содержимое файла:
migrations/add_marketplace_fields_to_companies.sql

# Вариант 2: Через psql
ssh root@46.149.70.219
psql -U postgres -h localhost -d postgres -f /opt/ai-admin/migrations/add_marketplace_fields_to_companies.sql
```

### 4. Nginx конфигурация для WebSocket

Добавьте в `/etc/nginx/sites-available/ai-admin.app`:

```nginx
# WebSocket support для marketplace
location /socket.io/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

После изменения:
```bash
nginx -t && systemctl reload nginx
```

### 5. Проверка зависимостей Node.js

```bash
ssh root@46.149.70.219
cd /opt/ai-admin
npm list socket.io jsonwebtoken @whiskeysockets/baileys

# Если чего-то нет:
npm install socket.io jsonwebtoken @whiskeysockets/baileys
pm2 restart ai-admin-api
```

## 🔍 Проверочный чеклист

### Шаг 1: Проверка переменных окружения

```bash
ssh root@46.149.70.219
cd /opt/ai-admin
grep -E "YCLIENTS_PARTNER_TOKEN|YCLIENTS_APP_ID|JWT_SECRET" .env

# Должно вывести 3 строки с заполненными значениями
```

### Шаг 2: Проверка БД

```bash
# Подключитесь к Supabase SQL Editor и выполните:
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'companies'
AND column_name IN (
  'integration_status',
  'marketplace_user_id',
  'whatsapp_connected',
  'api_key',
  'webhook_secret'
);

# Должно вернуть 5 строк
```

### Шаг 3: Тестовый endpoint

Создайте временный тестовый endpoint в `src/api/routes/yclients-marketplace.js`:

```javascript
// Добавьте этот route для проверки
router.get('/marketplace/health-check', (req, res) => {
  res.json({
    status: 'ok',
    environment: {
      partner_token: !!process.env.YCLIENTS_PARTNER_TOKEN,
      app_id: !!process.env.YCLIENTS_APP_ID,
      jwt_secret: !!process.env.JWT_SECRET
    },
    timestamp: new Date().toISOString()
  });
});
```

Проверьте:
```bash
curl https://ai-admin.app/marketplace/health-check
```

## ⚠️ Известные проблемы и решения

### Проблема: "Cannot read property 'getQR' of undefined"

**Причина:** Session Pool не поддерживает нужные методы для Baileys

**Решение:** Нужно обновить session-pool для поддержки:
- `getQR(sessionId)`
- `getSession(sessionId)`
- `createSession(sessionId)`
- `getSessionStatus(sessionId)`

### Проблема: "Invalid partner token"

**Причина:** YCLIENTS_PARTNER_TOKEN не установлен или неверный

**Решение:** Проверьте .env файл и убедитесь, что токен правильный

### Проблема: "WebSocket connection failed"

**Причина:** Nginx не проксирует WebSocket

**Решение:** Добавьте конфигурацию WebSocket в Nginx (см. выше)

### Проблема: "Column does not exist"

**Причина:** Миграция БД не применена

**Решение:** Выполните SQL миграцию (см. выше)

## 📊 Статус готовности компонентов

| Компонент | Статус | Действие |
|-----------|--------|----------|
| Endpoints | ✅ Развернуты | - |
| HTTPS/SSL | ✅ Настроено | - |
| HTML страница | ✅ Создана | - |
| WebSocket сервер | ✅ Написан | Проверить работу |
| Partner Token | ❌ Отсутствует | Получить от YClients |
| Application ID | ❌ Отсутствует | Получить от YClients |
| JWT Secret | ⚠️ Не установлен | Сгенерировать и добавить |
| База данных | ⚠️ Миграция не применена | Выполнить SQL |
| Nginx WebSocket | ⚠️ Не настроен | Обновить конфигурацию |
| Baileys интеграция | ⚠️ Не проверена | Протестировать QR генерацию |

## 🚀 Порядок действий для запуска

1. **Получите токены от YClients** (после одобрения заявки)
2. **Добавьте все переменные в .env**
3. **Примените миграцию БД**
4. **Обновите Nginx для WebSocket**
5. **Перезапустите сервисы:**
   ```bash
   pm2 restart ai-admin-api
   nginx -s reload
   ```
6. **Проверьте health-check endpoint**
7. **Протестируйте полный flow**

## 📝 Команда для быстрой проверки всего

```bash
ssh root@46.149.70.219 '
echo "=== Checking ENV variables ==="
grep -c "YCLIENTS_PARTNER_TOKEN" /opt/ai-admin/.env
grep -c "YCLIENTS_APP_ID" /opt/ai-admin/.env
grep -c "JWT_SECRET" /opt/ai-admin/.env

echo "=== Checking Node modules ==="
cd /opt/ai-admin && npm list socket.io jsonwebtoken 2>/dev/null | grep -E "(socket.io|jsonwebtoken)" | head -2

echo "=== Checking Nginx WebSocket ==="
grep -c "socket.io" /etc/nginx/sites-available/ai-admin.app

echo "=== Checking API status ==="
curl -s http://localhost:3000/health | head -1
'
```

---

**ВАЖНО:** Без выполнения всех критических требований интеграция работать не будет!

*Документ создан: 03.10.2025*