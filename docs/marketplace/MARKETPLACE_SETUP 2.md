# 🚀 Руководство по установке и настройке YClients Marketplace

## 📋 Содержание

1. [Требования](#требования)
2. [Быстрый старт](#быстрый-старт)
3. [Детальная установка](#детальная-установка)
4. [Настройка окружения](#настройка-окружения)
5. [Настройка базы данных](#настройка-базы-данных)
6. [Настройка Redis](#настройка-redis)
7. [Настройка Nginx](#настройка-nginx)
8. [SSL сертификаты](#ssl-сертификаты)
9. [PM2 конфигурация](#pm2-конфигурация)
10. [Проверка установки](#проверка-установки)

## ✅ Требования

### Системные требования
- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **RAM**: Минимум 2GB (рекомендуется 4GB+)
- **CPU**: 2+ cores
- **Disk**: 20GB+ свободного места
- **Network**: Статический IP, открытые порты 80, 443

### Программное обеспечение
- **Node.js**: 18.0.0 или выше
- **npm**: 8.0.0 или выше
- **Redis**: 6.0.0 или выше
- **PostgreSQL**: 14.0 или выше (или Supabase)
- **PM2**: Последняя версия
- **Nginx**: 1.18.0 или выше
- **Git**: 2.25.0 или выше

## 🏃 Быстрый старт

```bash
# 1. Клонирование репозитория
git clone https://github.com/vosarsen/ai_admin_v2.git
cd ai_admin_v2

# 2. Установка зависимостей
npm install

# 3. Копирование и настройка .env
cp .env.example .env
nano .env  # Заполнить все необходимые переменные

# 4. Применение миграций БД
node scripts/apply-whatsapp-migration.js

# 5. Запуск приложения
pm2 start ecosystem.config.js

# 6. Проверка статуса
pm2 status
```

## 📦 Детальная установка

### Шаг 1: Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка необходимых пакетов
sudo apt install -y curl wget git build-essential

# Установка Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Проверка версий
node --version  # Должно быть v18.x.x
npm --version   # Должно быть 8.x.x
```

### Шаг 2: Установка Redis

```bash
# Установка Redis
sudo apt install -y redis-server

# Настройка Redis
sudo nano /etc/redis/redis.conf

# Изменить следующие параметры:
# bind 127.0.0.1 ::1
# requirepass your_strong_password_here
# maxmemory 256mb
# maxmemory-policy allkeys-lru

# Перезапуск Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Проверка
redis-cli ping
# Должен вернуть PONG
```

### Шаг 3: Установка PostgreSQL (если не используется Supabase)

```bash
# Установка PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Создание базы данных
sudo -u postgres psql

CREATE DATABASE ai_admin;
CREATE USER ai_admin_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE ai_admin TO ai_admin_user;
\q

# Настройка удаленного доступа (если нужно)
sudo nano /etc/postgresql/14/main/postgresql.conf
# listen_addresses = '*'

sudo nano /etc/postgresql/14/main/pg_hba.conf
# host    all             all             0.0.0.0/0               md5

# Перезапуск PostgreSQL
sudo systemctl restart postgresql
```

### Шаг 4: Установка PM2

```bash
# Глобальная установка PM2
sudo npm install -g pm2

# Настройка автозапуска
pm2 startup systemd
# Выполнить команду, которую покажет PM2

# Сохранение конфигурации
pm2 save
```

### Шаг 5: Установка Nginx

```bash
# Установка Nginx
sudo apt install -y nginx

# Удаление дефолтного сайта
sudo rm /etc/nginx/sites-enabled/default

# Создание конфигурации
sudo nano /etc/nginx/sites-available/ai-admin

# Вставить конфигурацию (см. раздел "Настройка Nginx")

# Активация сайта
sudo ln -s /etc/nginx/sites-available/ai-admin /etc/nginx/sites-enabled/

# Проверка конфигурации
sudo nginx -t

# Перезапуск Nginx
sudo systemctl restart nginx
```

## ⚙️ Настройка окружения

### Создание .env файла

```bash
# Копирование примера
cp .env.example .env

# Редактирование
nano .env
```

### Обязательные переменные

```env
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# JWT для аутентификации (ОБЯЗАТЕЛЬНО сгенерировать новый!)
JWT_SECRET=your_secure_random_string_here
# Генерация: openssl rand -hex 32

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password

# Database (Supabase или PostgreSQL)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_key
# ИЛИ для PostgreSQL:
# DATABASE_URL=postgresql://user:password@localhost:5432/ai_admin

# YClients API
YCLIENTS_API_KEY=your_yclients_api_key
YCLIENTS_BEARER_TOKEN=your_bearer_token
YCLIENTS_USER_TOKEN=your_user_token
YCLIENTS_PARTNER_ID=your_partner_id

# WhatsApp
WHATSAPP_PROVIDER=baileys
WHATSAPP_MULTI_TENANT=true
WHATSAPP_SESSIONS_PATH=./sessions

# AI Service (DeepSeek или другой)
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_MODEL=deepseek-chat

# Security
MASTER_KEY=your_master_key_for_admin_access
SECRET_KEY=your_secret_key_for_hmac
```

### Генерация секретных ключей

```bash
# JWT Secret
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env

# Master Key
echo "MASTER_KEY=$(openssl rand -hex 24)" >> .env

# Secret Key
echo "SECRET_KEY=$(openssl rand -hex 32)" >> .env
```

## 💾 Настройка базы данных

### Вариант 1: Использование Supabase (рекомендуется)

1. Создать проект на [supabase.com](https://supabase.com)
2. Скопировать URL и Service Key
3. Применить миграции через Supabase Dashboard

### Вариант 2: Локальная PostgreSQL

```sql
-- Подключение к базе
psql -U ai_admin_user -d ai_admin

-- Создание таблиц
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  company_id INTEGER,
  yclients_id INTEGER,
  title VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(100),
  address VARCHAR(500),
  timezone VARCHAR(50) DEFAULT 'Europe/Moscow',

  -- WhatsApp поля
  whatsapp_connected BOOLEAN DEFAULT FALSE,
  whatsapp_phone VARCHAR(20),
  whatsapp_connected_at TIMESTAMPTZ,
  integration_status VARCHAR(50) DEFAULT 'pending',
  connected_at TIMESTAMPTZ,

  -- Флаги
  ai_enabled BOOLEAN DEFAULT TRUE,
  sync_enabled BOOLEAN DEFAULT TRUE,
  whatsapp_enabled BOOLEAN DEFAULT FALSE,

  -- Метаданные
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Индексы
CREATE INDEX idx_companies_yclients_id ON companies(yclients_id);
CREATE INDEX idx_companies_whatsapp_connected ON companies(whatsapp_connected)
WHERE whatsapp_connected = true;
CREATE INDEX idx_companies_whatsapp_phone ON companies(whatsapp_phone)
WHERE whatsapp_phone IS NOT NULL;
```

### Применение миграций

```bash
# Автоматическое применение
node scripts/apply-whatsapp-migration.js

# Проверка
node scripts/apply-whatsapp-columns-direct.js
```

## 🔴 Настройка Redis

### Конфигурация Redis

```bash
# Редактирование конфигурации
sudo nano /etc/redis/redis.conf

# Важные параметры:
bind 127.0.0.1
port 6379
requirepass your_strong_password_here
maxmemory 512mb
maxmemory-policy allkeys-lru
appendonly yes
appendfilename "ai-admin.aof"

# Перезапуск
sudo systemctl restart redis-server

# Тест подключения
redis-cli -a your_strong_password_here ping
```

### Настройка Redis Sentinel (для высокой доступности)

```bash
# Создание конфигурации sentinel
sudo nano /etc/redis/sentinel.conf

port 26379
sentinel monitor mymaster 127.0.0.1 6379 2
sentinel auth-pass mymaster your_strong_password_here
sentinel down-after-milliseconds mymaster 5000
sentinel parallel-syncs mymaster 1
sentinel failover-timeout mymaster 10000

# Запуск sentinel
redis-sentinel /etc/redis/sentinel.conf
```

## 🌐 Настройка Nginx

### Базовая конфигурация

```nginx
# /etc/nginx/sites-available/ai-admin

server {
    listen 80;
    server_name ai-admin.app www.ai-admin.app;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ai-admin.app www.ai-admin.app;

    # SSL сертификаты
    ssl_certificate /etc/letsencrypt/live/ai-admin.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ai-admin.app/privkey.pem;

    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Безопасность
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Логирование
    access_log /var/log/nginx/ai-admin.access.log;
    error_log /var/log/nginx/ai-admin.error.log;

    # Корневая директория для статики
    root /opt/ai-admin/public/landing;
    index index.html;

    # Главная страница
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API endpoints
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Таймауты для долгих запросов
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Marketplace endpoints
    location /marketplace/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket для marketplace
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Webhook endpoints
    location /webhook/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Увеличенный лимит для webhook
        client_max_body_size 10M;
    }

    # Статические файлы
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

## 🔒 SSL сертификаты

### Установка Certbot

```bash
# Установка Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d ai-admin.app -d www.ai-admin.app

# Следовать инструкциям:
# - Ввести email
# - Согласиться с условиями
# - Выбрать redirect (опция 2)

# Проверка автообновления
sudo certbot renew --dry-run

# Добавление в cron для автообновления
sudo crontab -e
# Добавить строку:
0 0,12 * * * certbot renew --quiet
```

## 🏭 PM2 конфигурация

### ecosystem.config.js

```javascript
module.exports = {
  apps: [
    {
      name: 'ai-admin-api',
      script: 'src/api/index.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: 'logs/pm2-api-error.log',
      out_file: 'logs/pm2-api-out.log',
      log_file: 'logs/pm2-api-combined.log',
      time: true
    },
    {
      name: 'ai-admin-worker-v2',
      script: 'src/workers/index-v2.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: 'logs/pm2-worker-error.log',
      out_file: 'logs/pm2-worker-out.log',
      log_file: 'logs/pm2-worker-combined.log',
      time: true
    },
    {
      name: 'ai-admin-batch-processor',
      script: 'src/workers/batch-processor.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: 'logs/pm2-batch-error.log',
      out_file: 'logs/pm2-batch-out.log',
      log_file: 'logs/pm2-batch-combined.log',
      time: true
    }
  ]
};
```

### Управление PM2

```bash
# Запуск всех процессов
pm2 start ecosystem.config.js

# Проверка статуса
pm2 status

# Мониторинг в реальном времени
pm2 monit

# Логи
pm2 logs
pm2 logs ai-admin-api --lines 100

# Перезапуск
pm2 restart all
pm2 restart ai-admin-api

# Остановка
pm2 stop all

# Удаление из PM2
pm2 delete all

# Сохранение конфигурации
pm2 save

# Автозапуск при перезагрузке
pm2 startup
```

## ✅ Проверка установки

### 1. Проверка сервисов

```bash
# Node.js
node --version  # >= 18.0.0

# PM2
pm2 status      # Все процессы должны быть online

# Redis
redis-cli ping  # PONG

# PostgreSQL/Supabase
psql -U ai_admin_user -d ai_admin -c "SELECT 1"  # 1

# Nginx
sudo nginx -t    # syntax is ok
```

### 2. Проверка API

```bash
# Тест marketplace endpoint
curl https://ai-admin.app/marketplace/test

# Ожидаемый ответ:
{
  "success": true,
  "status": "ok",
  "message": "Marketplace integration endpoints are ready"
}
```

### 3. Проверка логов

```bash
# PM2 логи
pm2 logs ai-admin-api --lines 50

# Nginx логи
tail -f /var/log/nginx/ai-admin.access.log
tail -f /var/log/nginx/ai-admin.error.log

# Системные логи
journalctl -u redis-server -f
journalctl -u postgresql -f
```

### 4. Проверка портов

```bash
# Проверка открытых портов
sudo netstat -tlnp

# Должны быть открыты:
# - 80 (HTTP)
# - 443 (HTTPS)
# - 3000 (Node.js API)
# - 6379 (Redis)
# - 5432 (PostgreSQL, если используется)
```

### 5. Тест интеграции

```bash
# Запуск тестов
cd /opt/ai-admin
node tests/manual/test-marketplace-integration.js

# Все тесты должны пройти успешно
```

## 🔧 Дополнительная настройка

### Настройка файрвола

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# FirewallD (CentOS/RHEL)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### Настройка логротации

```bash
# Создание конфигурации
sudo nano /etc/logrotate.d/ai-admin

/opt/ai-admin/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Мониторинг и алерты

```bash
# Установка мониторинга
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Настройка алертов
pm2 install pm2-slack
pm2 set pm2-slack:slack_url https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

## 📝 Финальный чеклист

- [ ] Node.js 18+ установлен
- [ ] Redis настроен и запущен
- [ ] База данных настроена
- [ ] Все миграции применены
- [ ] .env файл настроен
- [ ] JWT_SECRET сгенерирован
- [ ] PM2 запущен
- [ ] Nginx настроен
- [ ] SSL сертификаты установлены
- [ ] Файрвол настроен
- [ ] Логи работают
- [ ] API endpoint отвечает
- [ ] WebSocket подключается
- [ ] Тесты проходят

---

*Последнее обновление: 16 сентября 2024*