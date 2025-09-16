# 📦 Интеграция с маркетплейсом YClients

## 📋 Обзор

AI Admin интегрирован с маркетплейсом YClients для автоматического подключения WhatsApp ботов к салонам красоты. Интеграция позволяет владельцам салонов подключить AI-ассистента в несколько кликов прямо из личного кабинета YClients.

## 🔄 Архитектура интеграции

### Компоненты системы

1. **API Endpoint** (`/marketplace/register`) - принимает запросы из YClients
2. **MarketplaceService** - бизнес-логика интеграции
3. **HTML страница подключения** - интерфейс для QR-кода WhatsApp
4. **WebSocket сервер** - real-time обновление статуса подключения
5. **Redis кэш** - хранение токенов и сессий

## 🚀 Процесс подключения

### Шаг 1: Инициация из YClients

YClients отправляет GET запрос на наш endpoint:
```
GET https://ai-admin.app/marketplace/register?salon_id=123456
```

### Шаг 2: Обработка запроса

Наш API:
1. Проверяет существование компании в БД
2. Создает новую компанию или использует существующую
3. Генерирует JWT токен для сессии
4. Сохраняет токен в Redis
5. Возвращает JSON с данными для подключения

### Шаг 3: Ответ API

```json
{
  "success": true,
  "company": {
    "id": 15,
    "title": "Название салона",
    "salon_id": "123456"
  },
  "connectUrl": "https://ai-admin.app/marketplace/connect.html?token=xxx&company=15&salon=123456",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "wsUrl": "wss://ai-admin.app"
}
```

### Шаг 4: Подключение WhatsApp

YClients может:
- **Вариант A**: Использовать `connectUrl` для редиректа пользователя
- **Вариант B**: Встроить нашу страницу в iframe
- **Вариант C**: Использовать API для собственного интерфейса

### Шаг 5: Сканирование QR-кода

На странице `connect.html`:
1. Отображается QR-код для WhatsApp Web
2. Администратор салона сканирует код телефоном
3. WebSocket уведомляет о успешном подключении
4. Запускается автоматический онбординг

## 🔧 Техническая реализация

### API Endpoints

#### `GET /marketplace/register`

**Параметры:**
- `salon_id` (обязательный) - ID салона в YClients

**Ответ (успех):**
```json
{
  "success": true,
  "company": {
    "id": number,
    "title": string,
    "salon_id": string
  },
  "connectUrl": string,
  "token": string,
  "wsUrl": string
}
```

**Ответ (ошибка):**
```json
{
  "success": false,
  "error": "Описание ошибки"
}
```

#### `GET /marketplace/qr/:token`

Получение QR-кода для WhatsApp подключения.

**Ответ:**
```json
{
  "success": true,
  "qr": "data:image/png;base64,...",
  "expires_in": 20,
  "company_id": 15
}
```

#### `POST /marketplace/callback`

Callback для уведомления YClients о успешном подключении.

**Тело запроса:**
```json
{
  "company_id": 15,
  "api_key": "generated_key",
  "webhook_url": "https://ai-admin.app/webhook/yclients/15"
}
```

### База данных

#### Таблица `companies`

Основные поля для интеграции:
- `id` - внутренний ID
- `yclients_id` - ID салона в YClients
- `company_id` - дублирует yclients_id для совместимости
- `title` - название салона
- `phone`, `email`, `address` - контактные данные
- `whatsapp_enabled` - статус подключения WhatsApp
- `ai_enabled` - статус AI-ассистента
- `raw_data` - полные данные из YClients API

### MarketplaceService

Основной сервис для работы с маркетплейсом:

```javascript
class MarketplaceService {
  // Создание или получение компании
  async createOrGetCompany(salonId)

  // Сохранение токена в Redis
  async saveToken(token, companyId)

  // Валидация токена
  async validateToken(token, companyId)

  // Генерация QR-кода
  async generateQR(companyId)

  // Callback в YClients
  async sendCallbackToYClients(data)

  // Обработка webhook от YClients
  async handleWebhook(companyId, eventData)
}
```

### WebSocket Events

События для real-time обновления:

- `connect` - установка соединения
- `qr-update` - новый QR-код
- `whatsapp-connected` - успешное подключение
- `error` - ошибка подключения
- `disconnect` - разрыв соединения

## 🛠 Конфигурация

### Переменные окружения

```env
# YClients API
YCLIENTS_API_KEY=your_api_key
YCLIENTS_PARTNER_TOKEN=partner_token
YCLIENTS_APPLICATION_ID=app_id

# JWT для токенов
JWT_SECRET=your_secret_key

# URLs
BASE_URL=https://ai-admin.app
WS_URL=wss://ai-admin.app

# Redis
REDIS_URL=redis://localhost:6379
```

### Nginx конфигурация

```nginx
# Статические файлы маркетплейса
location /marketplace/ {
    root /opt/ai-admin/public;
    try_files $uri $uri/ /marketplace/index.html;
}

# API маркетплейса
location /marketplace/register {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# WebSocket
location /socket.io/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

## 📁 Структура файлов

```
src/
├── api/
│   ├── routes/
│   │   └── marketplace/
│   │       └── index.js          # API endpoints
│   └── websocket/
│       └── marketplace-socket.js  # WebSocket handler
├── services/
│   └── marketplace/
│       └── marketplace-service.js # Бизнес-логика
└── views/
    └── marketplace/
        └── connect.html           # Страница подключения (legacy)

public/
└── marketplace/
    └── connect.html              # Статическая страница подключения
```

## 🔐 Безопасность

1. **JWT токены** - для авторизации сессий (срок жизни 24 часа)
2. **HMAC подписи** - для webhooks от YClients
3. **Rate limiting** - защита от брутфорса
4. **CORS** - ограничение доступа к API
5. **SSL/TLS** - обязательное шифрование трафика

## 🧪 Тестирование

### Тест API endpoint

```bash
# Получить данные для подключения
curl "https://ai-admin.app/marketplace/register?salon_id=962302"

# Результат:
{
  "success": true,
  "company": {...},
  "connectUrl": "...",
  "token": "...",
  "wsUrl": "wss://ai-admin.app"
}
```

### Тест страницы подключения

Откройте в браузере:
```
https://ai-admin.app/marketplace/connect.html?token=YOUR_TOKEN&company=15&salon=962302
```

### Тест WebSocket

```javascript
const socket = io('wss://ai-admin.app/marketplace', {
  query: {
    token: 'YOUR_TOKEN',
    companyId: '15'
  }
});

socket.on('qr-update', (data) => {
  console.log('New QR:', data.qr);
});
```

## 📊 Мониторинг

### Логи

```bash
# API логи
pm2 logs ai-admin-api --lines 100 | grep marketplace

# Ошибки
pm2 logs ai-admin-api --err | grep marketplace

# WebSocket события
pm2 logs ai-admin-api | grep "WebSocket"
```

### Метрики

- Количество успешных подключений
- Среднее время подключения
- Процент отказов
- Активные WebSocket соединения

## 🚨 Обработка ошибок

### Частые ошибки и решения

1. **"Отсутствует salon_id"**
   - Причина: YClients не передал ID салона
   - Решение: Проверить интеграцию со стороны YClients

2. **"Redis connection failed"**
   - Причина: Недоступен Redis сервер
   - Решение: Проверить Redis соединение и конфигурацию

3. **"Failed to generate QR"**
   - Причина: Проблемы с Baileys/WhatsApp
   - Решение: Перезапустить WhatsApp сессию

4. **"Company not found"**
   - Причина: Нет данных о салоне
   - Решение: Синхронизировать с YClients API

## 🔄 Процесс обновления

1. Внести изменения в код
2. Протестировать локально
3. Закоммитить в Git
4. Отправить на GitHub
5. Обновить на сервере:
   ```bash
   ssh root@46.149.70.219 "cd /opt/ai-admin && git pull && pm2 restart ai-admin-api"
   ```

## 📈 Дальнейшее развитие

### Запланировано

- [ ] Автоматическая синхронизация услуг после подключения
- [ ] Мультиязычная поддержка интерфейса
- [ ] Аналитика по конверсии подключений
- [ ] A/B тестирование онбординга
- [ ] Поддержка множественных филиалов

### Возможные улучшения

- Добавить progress bar для процесса подключения
- Реализовать повторную отправку QR-кода
- Добавить видео-инструкцию на страницу
- Интеграция с другими CRM системами

## 📞 Поддержка

- **Email**: support@ai-admin.app
- **Документация**: https://ai-admin.app/docs
- **API Status**: https://status.ai-admin.app

---

*Последнее обновление: 16 сентября 2025*
*Версия: 1.0.0*