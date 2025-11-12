# Руководство по развёртыванию AI Admin v2 на сервере

## Требования к серверу

- Ubuntu 20.04+ или аналогичный Linux
- Минимум 2GB RAM (рекомендуется 4GB)
- 20GB свободного места на диске
- Открытые порты: 22 (SSH), 80/443 (HTTP/HTTPS)

## Пошаговая инструкция

### 1. Подготовка сервера

```bash
# Подключитесь к серверу
ssh root@your-server-ip

# Обновите систему
apt update && apt upgrade -y

# Установите необходимые пакеты
apt install -y curl git nginx certbot python3-certbot-nginx

# Установите Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Установите PM2 глобально
npm install -g pm2

# Установите Redis
apt install -y redis-server
systemctl enable redis-server
```

### 2. Настройка Redis с паролем

```bash
# Генерируем пароль
REDIS_PASSWORD=$(openssl rand -base64 32)
echo "Ваш Redis пароль: $REDIS_PASSWORD"

# Настраиваем Redis
cat >> /etc/redis/redis.conf << EOF
requirepass $REDIS_PASSWORD
maxmemory 512mb
maxmemory-policy allkeys-lru
EOF

# Перезапускаем Redis
systemctl restart redis-server
```

### 3. Создание пользователя для приложения

```bash
# Создаём пользователя
adduser --system --group ai-admin

# Создаём директории
mkdir -p /opt/ai-admin
mkdir -p /opt/venom-bot
chown -R ai-admin:ai-admin /opt/ai-admin
chown -R ai-admin:ai-admin /opt/venom-bot
```

### 4. Установка Venom-bot

```bash
# Переключаемся на пользователя
su - ai-admin

# Клонируем Venom-bot (или используйте ваш репозиторий)
cd /opt/venom-bot
git clone https://github.com/your-repo/venom-bot-server.git .
npm install

# Создаём конфигурацию
cat > .env << EOF
PORT=3001
SESSION_NAME=ai-admin
WEBHOOK_URL=http://localhost:3000/webhook/whatsapp
API_KEY=сгенерируйте-ключ
SECRET_KEY=сгенерируйте-секрет
EOF

# Выходим обратно в root
exit
```

### 5. Развёртывание AI Admin

```bash
# Переключаемся на пользователя
su - ai-admin

# Клонируем репозиторий
cd /opt/ai-admin
git clone https://github.com/your-repo/ai_admin.git .
cd ai_admin_v2

# Устанавливаем зависимости
npm ci --production

# Создаём директорию для логов
mkdir -p logs

# Копируем и настраиваем environment
cp .env.example .env
```

### 6. Настройка environment переменных

```bash
# Редактируем .env файл
nano .env
```

Заполните все необходимые переменные:

```env
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Redis (используйте пароль из шага 2)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=ваш-redis-пароль

# WhatsApp (Venom-bot)
VENOM_SERVER_URL=http://localhost:3001
VENOM_API_KEY=ключ-из-venom-конфига
VENOM_SECRET_KEY=секрет-из-venom-конфига

# YClients API
YCLIENTS_BEARER_TOKEN=ваш-токен
YCLIENTS_USER_TOKEN=ваш-токен
YCLIENTS_COMPANY_ID=962302

# AI Service (DeepSeek)
DEEPSEEK_API_KEY=ваш-ключ

# Database (Supabase)
SUPABASE_URL=ваш-url
SUPABASE_KEY=ваш-ключ

# Security
MASTER_KEY=$(node scripts/manage-secrets.js generate-key)
```

### 7. Инициализация базы данных

```bash
# Если используете Supabase, выполните SQL из scripts/setup-database.sql
# через интерфейс Supabase
```

### 8. Запуск через PM2

```bash
# Запускаем приложение
pm2 start ecosystem.config.js

# Запускаем Venom-bot
cd /opt/venom-bot
pm2 start server.js --name venom-bot

# Сохраняем конфигурацию PM2
pm2 save
pm2 startup

# Выходим из пользователя
exit
```

### 9. Настройка Nginx

```bash
# Создаём конфигурацию
cat > /etc/nginx/sites-available/ai-admin << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
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

    # Увеличиваем таймауты для вебхуков
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
EOF

# Активируем сайт
ln -s /etc/nginx/sites-available/ai-admin /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 10. Настройка SSL (HTTPS)

```bash
# Получаем SSL сертификат
certbot --nginx -d your-domain.com
```

### 11. Настройка firewall

```bash
# Настраиваем UFW
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### 12. Настройка автоматического бэкапа

```bash
# Создаём скрипт бэкапа
cat > /opt/ai-admin/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/ai-admin"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Бэкап конфигурации
tar -czf $BACKUP_DIR/config_$DATE.tar.gz /opt/ai-admin/.env /opt/ai-admin/.secrets

# Бэкап Redis
redis-cli -a $REDIS_PASSWORD --rdb $BACKUP_DIR/redis_$DATE.rdb

# Удаляем старые бэкапы (старше 7 дней)
find $BACKUP_DIR -type f -mtime +7 -delete
EOF

chmod +x /opt/ai-admin/backup.sh

# Добавляем в cron (ежедневно в 3:00)
echo "0 3 * * * /opt/ai-admin/backup.sh" | crontab -
```

## Команды управления

### Проверка статуса
```bash
# Статус всех процессов
pm2 status

# Логи
pm2 logs ai-admin-api
pm2 logs ai-admin-worker
pm2 logs venom-bot

# Мониторинг в реальном времени
pm2 monit
```

### Перезапуск
```bash
# Перезапуск API
pm2 restart ai-admin-api

# Перезапуск воркеров
pm2 restart ai-admin-worker

# Перезапуск всего
pm2 restart all
```

### Обновление кода
```bash
su - ai-admin
cd /opt/ai-admin/ai_admin_v2

# Сохраняем текущий .env
cp .env .env.backup

# Обновляем код
git pull origin main

# Устанавливаем зависимости
npm ci --production

# Перезапускаем
pm2 restart all
```

## Мониторинг

### 1. Настройка алертов
```bash
# Установка PM2 метрик
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
```

### 2. Health checks
- API Health: https://your-domain.com/health
- Circuit Breakers: https://your-domain.com/api/circuit-breakers
- Queue Metrics: https://your-domain.com/api/metrics

### 3. Настройка мониторинга uptime
Рекомендуем использовать:
- UptimeRobot: https://uptimerobot.com
- Или Better Uptime: https://betteruptime.com

## Troubleshooting

### WhatsApp не подключается
```bash
# Проверьте статус Venom
pm2 logs venom-bot

# Перезапустите
pm2 restart venom-bot

# Проверьте QR код
curl http://localhost:3001/status
```

### Redis connection refused
```bash
# Проверьте статус
systemctl status redis-server

# Проверьте пароль
redis-cli -a ваш-пароль ping
```

### Высокая нагрузка
```bash
# Увеличьте количество воркеров
pm2 scale ai-admin-worker 5

# Проверьте использование памяти
pm2 info ai-admin-worker
```

## Безопасность - Контрольный список

- [ ] Изменены все дефолтные пароли
- [ ] Настроен firewall
- [ ] Включён SSL/HTTPS
- [ ] Ограничен доступ к Redis (bind 127.0.0.1)
- [ ] Настроены регулярные бэкапы
- [ ] Включено логирование
- [ ] Настроен мониторинг
- [ ] Обновлены все пакеты системы

## Производительность

Для оптимальной производительности:

1. **Настройте swap** (если мало RAM):
```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

2. **Оптимизируйте Node.js**:
```bash
# В ecosystem.config.js увеличьте max_memory_restart
max_memory_restart: '800M'
```

3. **Настройте Redis**:
```bash
# В /etc/redis/redis.conf
maxmemory 1gb
maxmemory-policy volatile-lru
```

## Готово! 🎉

Ваш AI Admin развёрнут и готов к работе. 

Не забудьте:
1. Подключить WhatsApp через QR-код
2. Проверить все эндпоинты
3. Настроить мониторинг
4. Сделать тестовую запись