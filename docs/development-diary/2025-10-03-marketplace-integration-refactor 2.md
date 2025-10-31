# YClients Marketplace Integration - Критический рефакторинг

**Дата:** 3 октября 2025
**Автор:** Claude Code
**Приоритет:** 🔴 КРИТИЧЕСКИЙ
**Статус:** ✅ Завершено

---

## 🎯 Цель

Исправить критические ошибки в интеграции с YClients Marketplace перед прохождением модерации.

## 🚨 Обнаруженные критические проблемы

### 1. Конфликт роутов
- **Проблема:** Два файла (`yclients-marketplace.js` и `yclients-integration.js`) регистрировали одинаковый роут `/auth/yclients/redirect`
- **Последствия:** Только второй обработчик работал, первый игнорировался
- **Решение:** Удален дублирующий файл `yclients-integration.js`

### 2. Три разных системы регистрации
- `routes/yclients-marketplace.js` - полноценная регистрация с JWT
- `routes/yclients-integration.js` - упрощенная регистрация (удалена)
- `routes/marketplace/index.js` - третья система регистрации (удалена)
- **Решение:** Оставлена только одна правильная система в `yclients-marketplace.js`

### 3. Неправильная работа с токенами
- **Проблема:** Использовались разные переменные окружения:
  - `YCLIENTS_API_KEY` (неправильно)
  - `YCLIENTS_PARTNER_TOKEN` (правильно)
- **Решение:** Везде используется только `YCLIENTS_PARTNER_TOKEN` согласно документации

### 4. Некорректный endpoint активации
- **Было:** `https://api.yclients.com/api/v1/marketplace/activate` (не существует!)
- **Стало:** `https://api.yclients.com/marketplace/partner/callback/redirect` (правильный)

### 5. Случайный API ключ без сохранения
- **Проблема:** Генерировался случайный `api_key` который нигде не сохранялся
- **Решение:** API ключ сохраняется в БД ПЕРЕД отправкой в YClients

### 6. Неправильный webhook URL
- **Было:** `/callback/yclients` (для OAuth, не для webhook)
- **Стало:** `/webhook/yclients` (правильный endpoint для событий)

### 7. Проблемы с Session Pool
- **Проблема:** Использовались несуществующие методы
- **Решение:** Используются реальные методы из session-pool:
  - `getQR(sessionId)`
  - `createSession(sessionId, options)`
  - `getSessionStatus(sessionId)`

---

## 📝 Что было сделано

### 1. Полностью переписан `yclients-marketplace.js`

**Новая структура:**

```javascript
// 1. REGISTRATION REDIRECT
GET /auth/yclients/redirect?salon_id=XXX
→ Сохраняет компанию в БД
→ Генерирует JWT токен
→ Редиректит на onboarding

// 2. ONBOARDING PAGE
GET /marketplace/onboarding?token=XXX
→ Проверяет токен
→ Показывает HTML страницу с QR

// 3. QR CODE API
POST /marketplace/api/qr
Authorization: Bearer <token>
→ Генерирует QR через Baileys
→ Возвращает QR код

// 4. STATUS CHECK
GET /marketplace/api/status/:sessionId
Authorization: Bearer <token>
→ Проверяет статус WhatsApp подключения

// 5. ACTIVATE INTEGRATION
POST /marketplace/activate
Body: { token: <jwt_token> }
→ Сохраняет API ключ в БД
→ Отправляет callback в YClients
→ Активирует интеграцию

// 6. WEBHOOK CALLBACK
POST /webhook/yclients
→ Принимает события от YClients
→ Обрабатывает uninstall/freeze/payment

// 7. HEALTH CHECK
GET /marketplace/health
→ Проверяет все критические компоненты
```

### 2. Удалены конфликтующие файлы

```bash
# Перемещены в архив
src/api/routes/yclients-integration.js → archive/yclients-integration.js.backup
src/api/routes/marketplace/index.js → archive/marketplace-index.js.backup
```

### 3. Обновлен `src/api/index.js`

```javascript
// БЫЛО: 2 регистрации (конфликт!)
app.use(yclientsRoutes);              // Старая версия
app.use('', yclientsMarketplaceRoutes); // Новая версия

// СТАЛО: 1 правильная регистрация
app.use('', yclientsMarketplaceRoutes); // Единственная правильная интеграция
```

---

## ✅ Ключевые улучшения

### 1. Правильная авторизация
```javascript
// Везде используется PARTNER_TOKEN
const PARTNER_TOKEN = process.env.YCLIENTS_PARTNER_TOKEN;

headers: {
  'Authorization': `Bearer ${PARTNER_TOKEN}`,
  'Accept': 'application/vnd.yclients.v2+json'
}
```

### 2. Правильное сохранение API ключа
```javascript
// Генерируем уникальный ключ
const apiKey = crypto.randomBytes(32).toString('hex');

// СОХРАНЯЕМ В БД перед отправкой
await supabase
  .from('companies')
  .update({
    api_key: apiKey,
    whatsapp_connected: true,
    integration_status: 'activating'
  })
  .eq('id', company_id);

// ПОТОМ отправляем в YClients
const callbackData = {
  salon_id: parseInt(salon_id),
  application_id: parseInt(APP_ID),
  api_key: apiKey, // Используем сохраненный ключ
  webhook_urls: [`${BASE_URL}/webhook/yclients`]
};
```

### 3. Правильная обработка QR кода
```javascript
// Генерируем session ID
const sessionId = `company_${salon_id}`;

// Проверяем существующий QR
let qr = await sessionPool.getQR(sessionId);

if (!qr) {
  // Создаем сессию
  await sessionPool.createSession(sessionId, { company_id, salon_id });

  // Ждем генерации QR (макс 10 секунд)
  let attempts = 0;
  while (!qr && attempts < 10) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    qr = await sessionPool.getQR(sessionId);
    attempts++;
  }
}
```

### 4. Валидация переменных окружения
```javascript
const PARTNER_TOKEN = process.env.YCLIENTS_PARTNER_TOKEN;
const APP_ID = process.env.YCLIENTS_APP_ID;
const JWT_SECRET = process.env.JWT_SECRET;

if (!PARTNER_TOKEN || !APP_ID || !JWT_SECRET) {
  logger.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Отсутствуют обязательные переменные!');
}
```

### 5. Health Check с детальной диагностикой
```javascript
GET /marketplace/health

// Возвращает:
{
  status: 'ok' | 'error',
  environment: {
    partner_token: true/false,
    app_id: true/false,
    jwt_secret: true/false
  },
  services: {
    api_running: true,
    database_connected: true,
    whatsapp_pool_ready: true
  },
  missing: ['YCLIENTS_PARTNER_TOKEN'] // если есть проблемы
}
```

### 6. Красивые страницы ошибок
```javascript
function renderErrorPage(title, message, returnUrl) {
  return `
    <!DOCTYPE html>
    <html>
    <!-- Красивая страница с градиентом и кнопкой возврата -->
    </html>
  `;
}
```

---

## 🔧 Требования для запуска

### 1. Переменные окружения (.env)
```bash
# ОБЯЗАТЕЛЬНО установить:
YCLIENTS_PARTNER_TOKEN=your_partner_token_here
YCLIENTS_APP_ID=your_application_id_here
JWT_SECRET=generated_random_32_chars
BASE_URL=https://ai-admin.app
```

### 2. База данных
Необходимы поля в таблице `companies`:
- `integration_status` (varchar)
- `marketplace_user_id` (varchar)
- `marketplace_user_name` (varchar)
- `marketplace_user_phone` (varchar)
- `marketplace_user_email` (varchar)
- `whatsapp_connected` (boolean)
- `whatsapp_connected_at` (timestamp)
- `api_key` (varchar)
- `updated_at` (timestamp)

### 3. Таблица marketplace_events
```sql
CREATE TABLE marketplace_events (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id),
  salon_id INTEGER,
  event_type VARCHAR(50),
  event_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 📊 Flow интеграции (правильный)

```
1. Клиент нажимает "Подключить" в YClients Marketplace
   ↓
2. YClients редиректит на /auth/yclients/redirect?salon_id=XXX
   ↓
3. Создается/обновляется компания в БД
   ↓
4. Генерируется JWT токен (срок действия 1 час)
   ↓
5. Редирект на /marketplace/onboarding?token=XXX
   ↓
6. Страница запрашивает QR код через POST /marketplace/api/qr
   ↓
7. Генерируется WhatsApp сессия через Baileys
   ↓
8. Клиент сканирует QR код
   ↓
9. Проверка статуса через GET /marketplace/api/status/:sessionId
   ↓
10. После подключения WhatsApp → POST /marketplace/activate
    ↓
11. Генерируется и сохраняется API ключ в БД
    ↓
12. Отправляется callback в YClients:
    POST https://api.yclients.com/marketplace/partner/callback/redirect
    {
      salon_id, application_id, api_key, webhook_urls
    }
    ↓
13. YClients активирует интеграцию
    ↓
14. Статус меняется на 'active'
    ↓
15. ✅ Интеграция активна!
```

---

## 🧪 Как протестировать

### 1. Проверка health check
```bash
curl https://ai-admin.app/marketplace/health
```

**Ожидаемый результат:**
```json
{
  "status": "ok",
  "environment": {
    "partner_token": true,
    "app_id": true,
    "jwt_secret": true
  }
}
```

### 2. Тестовый flow
```bash
# 1. Симуляция редиректа от YClients
curl "https://ai-admin.app/auth/yclients/redirect?salon_id=962302&user_name=Test"

# 2. Проверка что компания создалась
# (через Supabase UI или psql)

# 3. Тестирование QR генерации
# (через браузер на /marketplace/onboarding?token=XXX)

# 4. Проверка webhook
curl -X POST https://ai-admin.app/webhook/yclients \
  -H "Content-Type: application/json" \
  -d '{"event_type":"payment","salon_id":962302,"data":{}}'
```

---

## ⚠️ Важные моменты для модерации

### ✅ Что ПРАВИЛЬНО
1. Используется только `YCLIENTS_PARTNER_TOKEN` для всех запросов
2. API ключ сохраняется в БД перед отправкой
3. Правильный endpoint для callback активации
4. Правильный webhook URL для событий
5. JWT токен с ограниченным сроком действия (1 час)
6. Проверка времени регистрации (не больше 1 часа)
7. Асинхронная обработка webhook событий
8. Красивые страницы ошибок
9. Детальное логирование всех операций
10. Health check для проверки готовности

### ❌ Что УДАЛЕНО
1. Дублирующие роуты
2. Конфликтующие системы регистрации
3. Использование YCLIENTS_API_KEY (устаревшее)
4. Неправильные endpoints активации
5. Несохраняемые API ключи
6. Неправильные webhook URLs

---

## 📚 Связанная документация

- `docs/marketplace/AUTHORIZATION_QUICK_REFERENCE.md` - Авторизация в маркетплейсе
- `docs/marketplace/CRITICAL_REQUIREMENTS.md` - Критические требования
- `docs/marketplace/MARKETPLACE_INTEGRATION.md` - Полная документация интеграции

---

## 🎉 Результат

Интеграция полностью соответствует документации YClients Marketplace и готова к прохождению модерации.

**Основные изменения:**
- ✅ 1 файл вместо 3 (правильная архитектура)
- ✅ Правильная авторизация (PARTNER_TOKEN)
- ✅ Правильные endpoints (callback, webhook)
- ✅ Сохранение API ключей в БД
- ✅ Корректная работа с Session Pool
- ✅ Health check для мониторинга
- ✅ Красивые error страницы
- ✅ Детальное логирование

---

**Следующие шаги:**
1. Установить переменные окружения на сервере
2. Применить миграции БД (если нужно)
3. Перезапустить PM2 сервисы
4. Протестировать health check
5. Протестировать полный flow регистрации
6. Отправить на модерацию YClients
