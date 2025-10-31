# 🛠️ YClients Marketplace - Техническая документация

## 📋 Содержание

1. [Архитектура компонентов](#архитектура-компонентов)
2. [Классы и сервисы](#классы-и-сервисы)
3. [WebSocket протокол](#websocket-протокол)
4. [Обработка ошибок](#обработка-ошибок)
5. [Производительность](#производительность)
6. [Масштабирование](#масштабирование)

## 🏗️ Архитектура компонентов

### Диаграмма взаимодействия
```
┌──────────────────────────────────────────────────────────┐
│                    Frontend Layer                         │
├──────────────────────────────────────────────────────────┤
│  connect.html  │  index.html  │  Socket.io Client        │
└────────────────┴──────────────┴──────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                     API Layer                             │
├──────────────────────────────────────────────────────────┤
│  Express Router  │  WebSocket Server  │  Middleware      │
│  /marketplace/*  │  /marketplace ns    │  Auth/CORS      │
└──────────────────┴────────────────────┴──────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                   Service Layer                           │
├──────────────────────────────────────────────────────────┤
│  MarketplaceService  │  BaileysManager  │  YclientsClient│
└──────────────────────┴──────────────────┴────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                    Data Layer                             │
├──────────────────────────────────────────────────────────┤
│     Supabase DB      │      Redis Cache     │   Sessions │
└──────────────────────┴──────────────────────┴────────────┘
```

## 📦 Классы и сервисы

### MarketplaceService

```javascript
class MarketplaceService {
  constructor() {
    this.supabase = supabase;
    this.redis = null; // Initialized in init()
    this.yclients = new YclientsClient();
    this.baileysManager = new BaileysManager();
  }

  // Методы
  async init()                          // Инициализация Redis
  async createOrGetCompany(salonId)     // Создание/получение компании
  async fetchSalonInfo(salonId)         // Получение данных салона
  detectBusinessType(salonInfo)         // Определение типа бизнеса
  generateAPIKey()                       // Генерация API ключа
  async saveToken(token, companyId)     // Сохранение токена
  async validateToken(token, companyId) // Валидация токена
  async generateQR(companyId)           // Генерация QR-кода
  async getCompany(companyId)           // Получение компании
  async sendCallbackToYClients(data)    // Отправка callback
  async handleWebhook(companyId, data)  // Обработка webhook
  async updateWhatsAppStatus(...)       // Обновление статуса
  async getConnectionStats()            // Статистика подключений
}
```

### BaileysManager

```javascript
class BaileysManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // companyId -> session
    this.sessionsPath = path.join(process.cwd(), 'sessions');
  }

  // Методы
  async initializeManager()                    // Инициализация
  async generateQRForCompany(companyId)        // Генерация QR
  async createNewSession(companyId)            // Создание сессии
  setupEventHandlers(companyId, sock, creds)   // Обработчики событий
  async sendTestMessage(sock, companyId)       // Тестовое сообщение
  async sendMessage(companyId, phone, text)    // Отправка сообщения
  formatPhoneNumber(phone)                     // Форматирование номера
  getSessionStatus(companyId)                  // Статус сессии
  async disconnectSession(companyId)           // Отключение сессии
  getActiveSessions()                          // Активные сессии
}
```

### MarketplaceSocket

```javascript
class MarketplaceSocket {
  constructor(io) {
    this.io = io;
    this.baileysManager = new BaileysManager();
    this.connections = new Map();     // companyId -> socket
    this.rateLimiter = new Map();    // IP -> { count, lastReset }
    this.namespace = io.of('/marketplace');
  }

  // Методы
  setupHandlers()                              // Настройка обработчиков
  async startWhatsAppConnection(socket, id)    // Запуск подключения
  async sendQRCode(socket, companyId)         // Отправка QR
  async startOnboarding(companyId, phone)     // Онбординг
  checkRateLimit(ip)                          // Проверка rate limit
  startCleanupTimer()                         // Очистка rate limiter
  sendToCompany(companyId, event, data)       // Отправка событий
}
```

## 🔌 WebSocket протокол

### События от клиента к серверу

#### connection
```javascript
{
  auth: {
    token: "JWT_TOKEN"  // В headers, не в query!
  },
  query: {
    companyId: "123",
    token: "TOKEN"      // Fallback для совместимости
  }
}
```

#### request-qr
```javascript
// Запрос нового QR-кода
// Payload: нет
```

#### disconnect
```javascript
// Отключение от сервера
// Payload: нет
```

### События от сервера к клиенту

#### qr-update
```javascript
{
  qr: "data:image/png;base64,...",  // Base64 QR-код
  expiresIn: 20                     // Срок действия в секундах
}
```

#### whatsapp-connected
```javascript
{
  success: true,
  phone: "+79001234567",
  companyId: 123,
  message: "WhatsApp успешно подключен!"
}
```

#### error
```javascript
{
  message: "Описание ошибки",
  code: "ERROR_CODE"  // Опционально
}
```

## 🚨 Обработка ошибок

### Коды ошибок

| Код | Описание | HTTP Status | Действие |
|-----|----------|-------------|----------|
| `INVALID_TOKEN` | Невалидный или истекший токен | 401 | Перенаправить на регистрацию |
| `RATE_LIMIT` | Превышен лимит запросов | 429 | Показать таймер ожидания |
| `QR_EXPIRED` | QR-код истек | 410 | Запросить новый QR |
| `CONNECTION_FAILED` | Не удалось подключить WhatsApp | 500 | Повторить попытку |
| `COMPANY_NOT_FOUND` | Компания не найдена | 404 | Проверить ID |
| `REDIS_ERROR` | Ошибка Redis | 503 | Использовать fallback |
| `DB_ERROR` | Ошибка базы данных | 503 | Повторить через 5 сек |

### Стратегии обработки

```javascript
// Retry с экспоненциальной задержкой
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Circuit Breaker для внешних API
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failures = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED';
    this.nextAttempt = Date.now();
  }

  async call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}
```

## ⚡ Производительность

### Оптимизации

#### 1. Connection Pooling
```javascript
// Redis connection pool
const redisPool = {
  clients: [],
  maxClients: 10,

  async getClient() {
    if (this.clients.length > 0) {
      return this.clients.pop();
    }
    return createRedisClient();
  },

  releaseClient(client) {
    if (this.clients.length < this.maxClients) {
      this.clients.push(client);
    } else {
      client.quit();
    }
  }
};
```

#### 2. Кэширование
```javascript
// LRU Cache для данных компаний
class LRUCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}
```

#### 3. Batch Processing
```javascript
// Batch обработка webhook событий
class WebhookBatcher {
  constructor(batchSize = 10, flushInterval = 5000) {
    this.batch = [];
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.timer = null;
  }

  add(webhook) {
    this.batch.push(webhook);

    if (this.batch.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  async flush() {
    if (this.batch.length === 0) return;

    const batch = this.batch.splice(0);
    clearTimeout(this.timer);
    this.timer = null;

    await this.processBatch(batch);
  }

  async processBatch(batch) {
    // Обработка пакета webhooks
    await Promise.all(batch.map(webhook =>
      this.processWebhook(webhook)
    ));
  }
}
```

### Метрики производительности

```javascript
// Prometheus метрики
const promClient = require('prom-client');

// Счетчики
const httpRequestDuration = new promClient.Histogram({
  name: 'marketplace_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

const whatsappConnections = new promClient.Gauge({
  name: 'marketplace_whatsapp_connections',
  help: 'Number of active WhatsApp connections',
  labelNames: ['status']
});

const qrGenerations = new promClient.Counter({
  name: 'marketplace_qr_generations_total',
  help: 'Total number of QR code generations',
  labelNames: ['company_id']
});

// Middleware для сбора метрик
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });

  next();
});
```

## 📈 Масштабирование

### Горизонтальное масштабирование

#### 1. Load Balancing
```nginx
upstream ai_admin_cluster {
    least_conn;
    server 127.0.0.1:3000 weight=1;
    server 127.0.0.1:3001 weight=1;
    server 127.0.0.1:3002 weight=1;
}

server {
    location /marketplace {
        proxy_pass http://ai_admin_cluster;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### 2. Redis Pub/Sub для синхронизации
```javascript
// Синхронизация WebSocket событий между инстансами
class ClusterSync {
  constructor(redis) {
    this.pub = redis.duplicate();
    this.sub = redis.duplicate();
    this.sub.subscribe('marketplace:events');
  }

  broadcast(event, data) {
    this.pub.publish('marketplace:events', JSON.stringify({
      event,
      data,
      sender: process.pid
    }));
  }

  onMessage(handler) {
    this.sub.on('message', (channel, message) => {
      const { event, data, sender } = JSON.parse(message);
      if (sender !== process.pid) {
        handler(event, data);
      }
    });
  }
}
```

#### 3. Session Affinity
```javascript
// Sticky sessions для WebSocket
const sessionStore = new Map();

io.use((socket, next) => {
  const sessionId = socket.handshake.query.sessionId;

  if (sessionId && sessionStore.has(sessionId)) {
    socket.sessionId = sessionId;
  } else {
    socket.sessionId = generateSessionId();
    sessionStore.set(socket.sessionId, {
      createdAt: Date.now(),
      serverId: process.pid
    });
  }

  next();
});
```

### Вертикальное масштабирование

#### Оптимизация памяти
```javascript
// Периодическая очистка неиспользуемых сессий
setInterval(() => {
  const now = Date.now();
  const timeout = 30 * 60 * 1000; // 30 минут

  for (const [companyId, session] of baileysManager.sessions) {
    if (session.status !== 'connected' &&
        now - session.createdAt > timeout) {
      baileysManager.disconnectSession(companyId);
    }
  }
}, 5 * 60 * 1000); // Каждые 5 минут
```

#### Оптимизация CPU
```javascript
// Worker threads для тяжелых операций
const { Worker } = require('worker_threads');

async function processHeavyTask(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./workers/heavy-task.js', {
      workerData: data
    });

    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}
```

## 🔐 Безопасность кода

### Валидация входных данных
```javascript
const Joi = require('joi');

// Схемы валидации
const schemas = {
  register: Joi.object({
    salon_id: Joi.number().integer().positive().required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    email: Joi.string().email().optional()
  }),

  webhook: Joi.object({
    type: Joi.string().required(),
    data: Joi.object().required(),
    timestamp: Joi.date().iso().required()
  })
};

// Middleware валидации
function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }
    next();
  };
}
```

### Защита от атак
```javascript
// SQL Injection предотвращение
const sanitizeSQL = (input) => {
  if (typeof input !== 'string') return input;
  return input.replace(/['";\\]/g, '');
};

// XSS предотвращение
const sanitizeHTML = (input) => {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };
  return input.replace(/[&<>"'/]/g, (char) => map[char]);
};

// CSRF защита
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

app.use('/marketplace/admin', csrfProtection);
```

## 📝 Логирование

### Структурированное логирование
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/marketplace-error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/marketplace-combined.log'
    })
  ]
});

// Добавляем контекст к логам
logger.child = (context) => {
  return {
    info: (message, meta = {}) => {
      logger.info(message, { ...context, ...meta });
    },
    error: (message, meta = {}) => {
      logger.error(message, { ...context, ...meta });
    }
  };
};
```

---

*Последнее обновление: 16 сентября 2024*