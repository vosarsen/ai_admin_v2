# 🔐 Руководство по безопасности YClients Marketplace

## 📋 Содержание

1. [Обзор угроз и защиты](#обзор-угроз-и-защиты)
2. [Аутентификация и авторизация](#аутентификация-и-авторизация)
3. [Валидация и санитизация данных](#валидация-и-санитизация-данных)
4. [Защита от атак](#защита-от-атак)
5. [Настройка окружения](#настройка-окружения)
6. [Чеклист безопасности](#чеклист-безопасности)
7. [Инцидент-менеджмент](#инцидент-менеджмент)

## 🎯 Обзор угроз и защиты

### Матрица угроз

| Угроза | Уровень риска | Статус защиты | Меры защиты |
|--------|---------------|---------------|-------------|
| SQL Injection | Высокий | ✅ Защищено | Параметризованные запросы, валидация ID |
| XSS | Средний | ✅ Защищено | Санитизация входных данных |
| CSRF | Средний | ✅ Защищено | JWT токены, проверка origin |
| DDoS | Высокий | ✅ Защищено | Rate limiting, IP блокировка |
| Утечка токенов | Высокий | ✅ Защищено | Headers вместо query, HTTPS |
| Брутфорс | Средний | ✅ Защищено | Rate limiting, логирование |
| MITM | Высокий | ✅ Защищено | HTTPS обязательно |
| Утечка памяти | Низкий | ✅ Защищено | Автоочистка, мониторинг |

## 🔑 Аутентификация и авторизация

### JWT Configuration

#### Генерация безопасного секрета

```bash
# Минимум 32 символа
openssl rand -base64 32
# Результат: gKvF3HsP9mXr2LQwZ8Nt4Yx7Dc5Jb1Rf6Ua0Eo3Ip+w=

# Или используя Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### Настройка JWT

```javascript
// Безопасная конфигурация JWT
const jwt = require('jsonwebtoken');

const JWT_CONFIG = {
  secret: process.env.JWT_SECRET,
  expiresIn: '24h', // Токен действителен 24 часа
  algorithm: 'HS256',
  issuer: 'ai-admin.app',
  audience: 'yclients-marketplace'
};

// Создание токена
function createToken(payload) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET не установлен');
  }

  return jwt.sign(payload, JWT_CONFIG.secret, {
    expiresIn: JWT_CONFIG.expiresIn,
    algorithm: JWT_CONFIG.algorithm,
    issuer: JWT_CONFIG.issuer,
    audience: JWT_CONFIG.audience
  });
}

// Верификация токена
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_CONFIG.secret, {
      algorithms: [JWT_CONFIG.algorithm],
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience
    });
  } catch (error) {
    logger.error('JWT verification failed:', error);
    throw new Error('Invalid token');
  }
}
```

### API Key Management

```javascript
// Генерация API ключа
function generateAPIKey() {
  const prefix = 'sk_'; // Secret key prefix
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `${prefix}${randomBytes}`;
}

// Хеширование API ключа для хранения
async function hashAPIKey(apiKey) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(apiKey, salt);
}

// Проверка API ключа
async function validateAPIKey(apiKey, hashedKey) {
  return bcrypt.compare(apiKey, hashedKey);
}
```

## 🛡️ Валидация и санитизация данных

### Функции валидации

```javascript
// src/utils/validators.js

/**
 * Валидация и санитизация всех входных данных
 */
class SecurityValidator {

  // Защита от SQL Injection
  static validateId(id) {
    const numId = parseInt(id);

    if (!Number.isInteger(numId) || numId <= 0) {
      throw new Error('Invalid ID format');
    }

    // Максимальное значение INT в PostgreSQL
    if (numId > 2147483647) {
      throw new Error('ID exceeds maximum value');
    }

    return numId;
  }

  // Защита от XSS
  static sanitizeString(input, maxLength = 255) {
    if (!input) return '';

    return input
      .replace(/[<>]/g, '') // Удаляем теги
      .replace(/javascript:/gi, '') // Удаляем JS
      .replace(/on\w+=/gi, '') // Удаляем обработчики событий
      .trim()
      .substring(0, maxLength);
  }

  // Валидация email против injection
  static validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Проверка на подозрительные символы
    if (email.includes('--') || email.includes('/*') || email.includes('*/')) {
      throw new Error('Suspicious email content');
    }

    return email.toLowerCase();
  }

  // Валидация телефона
  static validatePhone(phone) {
    const cleanPhone = phone.replace(/\D/g, '');

    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      throw new Error('Invalid phone length');
    }

    return cleanPhone;
  }

  // Защита от Path Traversal
  static sanitizePath(path) {
    return path
      .replace(/\.\./g, '')
      .replace(/\/\//g, '/')
      .replace(/\\/g, '');
  }

  // Валидация JSON
  static validateJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);

      // Проверка на глубину вложенности
      if (this.getDepth(parsed) > 10) {
        throw new Error('JSON too deeply nested');
      }

      return parsed;
    } catch (error) {
      throw new Error('Invalid JSON');
    }
  }

  // Проверка глубины объекта
  static getDepth(obj) {
    if (obj == null) return 0;

    if (typeof obj !== 'object') return 0;

    return 1 + Math.max(0, ...Object.values(obj).map(v => this.getDepth(v)));
  }
}
```

## 🚨 Защита от атак

### Rate Limiting Implementation

```javascript
// src/middleware/advanced-rate-limiter.js

class AdvancedRateLimiter {
  constructor() {
    this.limits = new Map();
    this.blacklist = new Set();

    // Настройки
    this.config = {
      windowMs: 60 * 1000, // 1 минута
      maxRequests: 30, // Максимум запросов
      blockDuration: 15 * 60 * 1000, // 15 минут блокировки
      suspiciousThreshold: 100 // Порог для подозрительной активности
    };
  }

  check(ip) {
    // Проверка черного списка
    if (this.blacklist.has(ip)) {
      return { allowed: false, reason: 'Blacklisted' };
    }

    const now = Date.now();
    const record = this.limits.get(ip) || { count: 0, resetTime: now + this.config.windowMs };

    // Сброс счетчика если окно истекло
    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + this.config.windowMs;
    }

    record.count++;

    // Проверка на подозрительную активность
    if (record.count > this.config.suspiciousThreshold) {
      this.blacklist.add(ip);
      logger.warn(`IP ${ip} добавлен в черный список за подозрительную активность`);
      return { allowed: false, reason: 'Suspicious activity detected' };
    }

    // Проверка лимита
    if (record.count > this.config.maxRequests) {
      return {
        allowed: false,
        reason: 'Rate limit exceeded',
        retryAfter: record.resetTime - now
      };
    }

    this.limits.set(ip, record);
    return { allowed: true, remaining: this.config.maxRequests - record.count };
  }

  // Периодическая очистка
  cleanup() {
    const now = Date.now();

    for (const [ip, record] of this.limits.entries()) {
      if (now > record.resetTime + this.config.blockDuration) {
        this.limits.delete(ip);
      }
    }
  }
}
```

### DDoS Protection

```nginx
# Nginx конфигурация для защиты от DDoS

# Ограничение количества соединений
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
limit_conn conn_limit 10;

# Ограничение скорости запросов
limit_req_zone $binary_remote_addr zone=req_limit:10m rate=30r/m;
limit_req zone=req_limit burst=10 nodelay;

# Блокировка подозрительных User-Agent
if ($http_user_agent ~* (bot|crawler|spider)) {
    return 403;
}

# Защита от Slowloris
client_body_timeout 10s;
client_header_timeout 10s;
keepalive_timeout 10s;
send_timeout 10s;

# Размер буферов
client_body_buffer_size 1K;
client_header_buffer_size 1k;
client_max_body_size 1m;
large_client_header_buffers 2 1k;
```

### CORS Configuration

```javascript
// src/middleware/cors-security.js

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://ai-admin.app',
      'https://yclients.com',
      'https://*.yclients.com'
    ];

    // Разрешаем запросы без origin (например, Postman)
    if (!origin && process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    // Проверка origin
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const regex = new RegExp(allowed.replace('*', '.*'));
        return regex.test(origin);
      }
      return allowed === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn(`Blocked CORS request from ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400 // 24 часа
};
```

## 🔧 Настройка окружения

### Production Environment Variables

```bash
# .env.production

# Обязательные
NODE_ENV=production
JWT_SECRET=your_very_secure_random_string_min_32_chars
DATABASE_URL=postgresql://user:password@localhost/db?ssl=true
REDIS_URL=redis://:password@localhost:6379
SUPABASE_URL=https://project.supabase.co
SUPABASE_KEY=your_service_role_key_keep_secret

# Безопасность
BCRYPT_ROUNDS=12
SESSION_SECRET=another_secure_random_string
COOKIE_SECURE=true
COOKIE_HTTPONLY=true
COOKIE_SAMESITE=strict

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=30

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/ai-admin/app.log
ERROR_LOG_FILE=/var/log/ai-admin/error.log

# Monitoring
SENTRY_DSN=https://key@sentry.io/project
NEW_RELIC_LICENSE_KEY=your_license_key
```

### Security Headers

```javascript
// src/middleware/security-headers.js

const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Дополнительные заголовки
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});
```

## ✅ Чеклист безопасности

### Перед деплоем

- [ ] **Переменные окружения**
  - [ ] JWT_SECRET установлен (минимум 32 символа)
  - [ ] NODE_ENV=production
  - [ ] Все секреты из .env, не в коде

- [ ] **Зависимости**
  - [ ] `npm audit` - нет критических уязвимостей
  - [ ] Все пакеты обновлены
  - [ ] Используются только необходимые пакеты

- [ ] **Код**
  - [ ] Нет console.log с чувствительными данными
  - [ ] Все входные данные валидируются
  - [ ] SQL запросы параметризованы
  - [ ] Нет хардкода токенов/паролей

- [ ] **Конфигурация**
  - [ ] HTTPS настроен и работает
  - [ ] Security headers установлены
  - [ ] CORS правильно настроен
  - [ ] Rate limiting активен

- [ ] **База данных**
  - [ ] SSL подключение к БД
  - [ ] Пароли захешированы (bcrypt)
  - [ ] Резервное копирование настроено
  - [ ] Индексы созданы

- [ ] **Мониторинг**
  - [ ] Логирование настроено
  - [ ] Алерты настроены
  - [ ] Метрики собираются
  - [ ] Error tracking подключен

### После деплоя

- [ ] **Тестирование безопасности**
  ```bash
  # Проверка SSL
  nmap --script ssl-cert,ssl-enum-ciphers -p 443 ai-admin.app

  # Проверка заголовков
  curl -I https://ai-admin.app

  # Проверка на SQL injection
  sqlmap -u "https://ai-admin.app/api/endpoint?id=1" --batch

  # Проверка на XSS
  dalfox url https://ai-admin.app
  ```

- [ ] **Мониторинг**
  - [ ] Проверить логи на ошибки
  - [ ] Проверить метрики производительности
  - [ ] Проверить rate limiting работает
  - [ ] Проверить backup выполняется

## 🚑 Инцидент-менеджмент

### План реагирования на инциденты

#### 1. Обнаружение угрозы

```javascript
// Автоматическое обнаружение
class SecurityMonitor {
  detectAnomalies() {
    // Проверка на брутфорс
    if (failedLogins > 10) {
      this.triggerAlert('BRUTE_FORCE_DETECTED');
    }

    // Проверка на SQL injection попытки
    if (request.includes('UNION') || request.includes('SELECT')) {
      this.triggerAlert('SQL_INJECTION_ATTEMPT');
    }

    // Проверка на аномальный трафик
    if (requestsPerMinute > 1000) {
      this.triggerAlert('DDOS_ATTACK');
    }
  }

  triggerAlert(type) {
    // Логирование
    logger.error(`SECURITY ALERT: ${type}`, {
      timestamp: new Date(),
      ip: request.ip,
      url: request.url
    });

    // Уведомление команды
    sendEmail({
      to: 'security@ai-admin.app',
      subject: `Security Alert: ${type}`,
      priority: 'high'
    });

    // Автоматическая блокировка
    if (type === 'BRUTE_FORCE_DETECTED' || type === 'SQL_INJECTION_ATTEMPT') {
      blockIP(request.ip);
    }
  }
}
```

#### 2. Изоляция проблемы

```bash
#!/bin/bash
# emergency-response.sh

# Блокировка IP через iptables
block_ip() {
  iptables -A INPUT -s $1 -j DROP
  echo "Blocked IP: $1"
}

# Отключение подозрительного аккаунта
disable_account() {
  psql $DATABASE_URL -c "UPDATE companies SET active=false WHERE id=$1;"
  redis-cli DEL "session:company:$1"
  echo "Disabled account: $1"
}

# Переход в режим только чтения
readonly_mode() {
  # Nginx - только GET запросы
  nginx -s reload -c /etc/nginx/readonly.conf

  # Отключение всех POST/PUT/DELETE
  echo "System in read-only mode"
}

# Полная изоляция
emergency_shutdown() {
  # Останавливаем приложение
  pm2 stop all

  # Блокируем все входящие соединения кроме SSH
  iptables -P INPUT DROP
  iptables -A INPUT -p tcp --dport 22 -j ACCEPT

  echo "EMERGENCY: System isolated"
}
```

#### 3. Восстановление

```bash
# Процедура восстановления

# 1. Анализ логов
grep -E "ERROR|WARN|SECURITY" /var/log/ai-admin/*.log > incident_report.txt

# 2. Проверка целостности данных
psql $DATABASE_URL -c "SELECT COUNT(*) FROM companies WHERE updated_at > NOW() - INTERVAL '1 hour';"

# 3. Восстановление из backup если нужно
pg_restore -d ai_admin backup_before_incident.sql

# 4. Очистка кэша
redis-cli FLUSHALL

# 5. Перезапуск сервисов
pm2 restart ecosystem.config.js

# 6. Проверка работоспособности
curl https://ai-admin.app/health
```

### Контакты для экстренных ситуаций

```yaml
security_team:
  lead:
    name: Security Lead
    phone: +7-900-000-00-00
    email: security@ai-admin.app

  backend:
    name: Backend Lead
    phone: +7-900-000-00-01
    email: backend@ai-admin.app

  devops:
    name: DevOps Lead
    phone: +7-900-000-00-02
    email: devops@ai-admin.app

external:
  hosting:
    company: DigitalOcean
    support: +1-800-000-0000
    ticket: support.digitalocean.com

  database:
    company: Supabase
    support: support@supabase.io
```

## 📊 Метрики безопасности

### KPI безопасности

```javascript
// Отслеживаемые метрики
const securityMetrics = {
  // Попытки атак
  sqlInjectionAttempts: 0,
  xssAttempts: 0,
  bruteForceAttempts: 0,

  // Блокировки
  blockedIPs: new Set(),
  rateLimitHits: 0,

  // Аутентификация
  failedLogins: 0,
  successfulLogins: 0,
  tokenValidationErrors: 0,

  // Производительность защиты
  avgValidationTime: 0,
  avgRateLimitCheckTime: 0
};

// Экспорт метрик для мониторинга
app.get('/metrics/security', authenticateAdmin, (req, res) => {
  res.json({
    timestamp: new Date(),
    metrics: securityMetrics,
    health: calculateSecurityHealth(securityMetrics)
  });
});
```

## 📚 Дополнительные ресурсы

### Полезные инструменты

- **[OWASP ZAP](https://www.zaproxy.org/)** - Сканер безопасности
- **[Snyk](https://snyk.io/)** - Проверка зависимостей
- **[SSL Labs](https://www.ssllabs.com/ssltest/)** - Проверка SSL
- **[Security Headers](https://securityheaders.com/)** - Проверка заголовков

### Документация

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

*Последнее обновление: 16 января 2025*
*Версия: 1.0.0*
*Классификация: Конфиденциально*