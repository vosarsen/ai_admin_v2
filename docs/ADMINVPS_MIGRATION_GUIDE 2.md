# 🚀 Миграция на AdminVPS: Полное руководство

**Дата:** 4 октября 2025
**Цель:** Миграция AI Admin v2 на новый сервер AdminVPS
**Время выполнения:** ~3-4 часа
**Downtime:** ~5-10 минут (только переключение DNS)

---

## 📋 Оглавление

1. [Подготовка](#-1-подготовка)
2. [Заказ сервера AdminVPS](#-2-заказ-сервера-adminvps)
3. [Автоматическая настройка (Cloud-Init)](#-3-автоматическая-настройка-cloud-init)
4. [Копирование данных](#-4-копирование-данных)
5. [Настройка приложения](#-5-настройка-приложения)
6. [Тестирование](#-6-тестирование)
7. [Переключение на новый сервер](#-7-переключение-на-новый-сервер)
8. [Пост-миграция](#-8-пост-миграция)
9. [Откат (если что-то пошло не так)](#-9-откат-если-что-то-пошло-не-так)

---

## 🎯 1. Подготовка

### 1.1. Выбор тарифа

**Рекомендуемый план:** AdminVPS "Pro"

```
CPU:  8 × 3.6 GHz
RAM:  16 GB
Диск: 160 GB NVMe
ЦОД:  Москва
Цена: 2,749₽/мес
```

**Альтернатива (минимум):** AdminVPS "Standart"
- 8 CPU / 12GB RAM / 100GB NVMe
- 1,749₽/мес
- ⚠️ Меньше запаса для роста

### 1.2. Подготовка локально

```bash
# 1. Создайте GitHub Personal Access Token (если репозиторий приватный)
# https://github.com/settings/tokens/new
# Права: repo (full control)

# 2. Убедитесь, что у вас есть SSH ключ
ls -la ~/.ssh/id_ed25519.pub

# Если нет - создайте:
ssh-keygen -t ed25519 -C "your-email@example.com"

# 3. Скопируйте публичный ключ
cat ~/.ssh/id_ed25519.pub
# Сохраните его - понадобится при настройке сервера
```

### 1.3. Бэкап текущего сервера

```bash
# Подключитесь к текущему серверу
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Создайте полный бэкап
cd /opt/ai-admin
./scripts/backup-full.sh

# Сохраните бэкап локально
exit
scp -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219:/backups/ai-admin/full_backup_*.tar.gz ~/Downloads/
```

---

## 🛒 2. Заказ сервера AdminVPS

### 2.1. Регистрация и заказ

1. Перейдите на https://adminvps.ru/
2. Зарегистрируйтесь или войдите
3. Перейдите в раздел **VPS/VDS → Россия**
4. Выберите тариф **"Pro"** (8 CPU / 16GB / 160GB)
5. Настройте:
   - **ЦОД:** Москва
   - **ОС:** Ubuntu 22.04 LTS
   - **Период:** 1 месяц (для начала)

### 2.2. Запросите тестовый период (опционально)

```
Служба поддержки: support@adminvps.ru
Тема: Запрос тестового периода

Здравствуйте!

Планирую мигрировать production приложение на ваш сервер.
Возможно ли предоставить 14-дневный тестовый период для
тарифа "Pro" (8 CPU / 16GB RAM)?

С уважением,
[Ваше имя]
```

---

## ⚙️ 3. Автоматическая настройка (Cloud-Init)

### 3.1. Подготовка Cloud-Init скрипта

```bash
# Откройте файл cloud-init
cd ~/Documents/GitHub/ai_admin_v2
nano scripts/cloud-init-adminvps.yml
```

### 3.2. Настройте переменные в начале файла

Замените следующие значения:

```bash
# GitHub репозиторий
GITHUB_REPO="https://github.com/vosarsen/ai_admin_v2.git"  # ваш репозиторий
GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"  # ваш Personal Access Token

# SSH ключ
SSH_PUBLIC_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... your-email@example.com"
# Вставьте содержимое вашего ~/.ssh/id_ed25519.pub

# Домен (если есть)
DOMAIN="bot.yourdomain.com"  # или оставьте пустым

# Telegram уведомления (опционально)
TELEGRAM_BOT_TOKEN="123456:ABC-DEF1234..."  # ваш бот
TELEGRAM_CHAT_ID="123456789"  # ваш chat_id
```

### 3.3. Применение Cloud-Init при создании сервера

**На странице заказа AdminVPS:**

1. Найдите секцию **"Cloud-init"** или **"User Data"**
2. Скопируйте **весь контент** файла `scripts/cloud-init-adminvps.yml`
3. Вставьте в поле Cloud-init
4. Нажмите **"Создать сервер"**

### 3.4. Ожидание завершения установки

```bash
# После создания сервера вы получите IP адрес
# Подождите 5-10 минут для завершения cloud-init

# Проверьте статус установки
ssh root@NEW_SERVER_IP

# Просмотрите лог установки
tail -f /var/log/cloud-init-output.log

# Или более детальный лог
tail -f /var/log/cloud-init-custom.log

# После завершения вы увидите:
# "✅ AI Admin v2 Setup Complete!"
```

---

## 📦 4. Копирование данных

### 4.1. Подключение к новому серверу

```bash
# SSH в новый сервер
ssh root@NEW_SERVER_IP

# Проверьте, что все установлено
cat /root/SETUP_COMPLETE.txt

# Сохраните Redis пароль
REDIS_PASSWORD=$(cat /root/.redis_password)
echo "Redis password: $REDIS_PASSWORD"
```

### 4.2. Копирование Baileys Sessions (критично!)

**С текущего сервера на новый:**

```bash
# На локальной машине
# Скачайте sessions с текущего сервера
scp -i ~/.ssh/id_ed25519_ai_admin -r \
  root@46.149.70.219:/opt/ai-admin/baileys_sessions \
  ~/Downloads/baileys_sessions_backup

# Загрузите на новый сервер
scp -r ~/Downloads/baileys_sessions_backup/* \
  root@NEW_SERVER_IP:/opt/ai-admin/baileys_sessions/

# На новом сервере: установите права
ssh root@NEW_SERVER_IP
chown -R ai-admin:ai-admin /opt/ai-admin/baileys_sessions
```

### 4.3. Копирование .env файлов

```bash
# На локальной машине
# Скачайте .env с текущего сервера
scp -i ~/.ssh/id_ed25519_ai_admin \
  root@46.149.70.219:/opt/ai-admin/.env \
  ~/Downloads/.env.backup

# Загрузите на новый сервер
scp ~/Downloads/.env.backup \
  root@NEW_SERVER_IP:/opt/ai-admin/.env

# На новом сервере
ssh root@NEW_SERVER_IP
chown ai-admin:ai-admin /opt/ai-admin/.env
```

---

## 🔧 5. Настройка приложения

### 5.1. Обновление .env файла

```bash
# На новом сервере
cd /opt/ai-admin
nano .env
```

**Обязательно обновите:**

```bash
# Redis (используйте новый пароль из /root/.redis_password)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=<пароль из /root/.redis_password>

# API URLs (укажите IP нового сервера)
API_BASE_URL=http://NEW_SERVER_IP:3000
WEBHOOK_URL=http://NEW_SERVER_IP:3000/webhook/whatsapp/batched

# Остальное - скопируйте из старого .env
# (YClients токены, AI ключи, Supabase, etc.)
```

### 5.2. Сборка приложения

```bash
# Установка зависимостей (если не установлены)
cd /opt/ai-admin
npm install --production

# Сборка TypeScript
npm run build

# Проверка сборки
ls -la dist/
```

### 5.3. Запуск с PM2

```bash
# Запуск всех сервисов
pm2 start ecosystem.config.js

# Проверка статуса
pm2 status

# Просмотр логов
pm2 logs --lines 50

# Сохранение конфигурации PM2
pm2 save

# Автозапуск при перезагрузке
pm2 startup
# Выполните команду, которую выведет pm2 startup
```

### 5.4. Проверка сервисов

```bash
# Проверьте все сервисы
pm2 status

# Должны быть запущены:
# - ai-admin-api
# - ai-admin-worker-v2
# - ai-admin-batch-processor
# - ai-admin-booking-monitor
# - ai-admin-telegram-bot

# Проверьте логи на ошибки
pm2 logs --err --lines 100
```

---

## ✅ 6. Тестирование

### 6.1. Проверка Health Endpoint

```bash
# На новом сервере
curl http://localhost:3000/health

# Ожидаемый ответ:
# {"status":"ok","timestamp":"..."}
```

### 6.2. Проверка Redis

```bash
# Проверка подключения
redis-cli -a $(cat /root/.redis_password) PING
# Ответ: PONG

# Проверка данных
redis-cli -a $(cat /root/.redis_password) DBSIZE
# Должно быть > 0 если есть данные
```

### 6.3. Проверка WhatsApp сессий

```bash
# Проверьте количество файлов сессий
ls -1 /opt/ai-admin/baileys_sessions/company_* | wc -l

# Должно совпадать с количеством на старом сервере
```

### 6.4. Тестовое сообщение через MCP

**На локальной машине:**

```bash
# Запустите Redis туннель на НОВЫЙ сервер
ssh -i ~/.ssh/id_ed25519 -L 6380:localhost:6379 root@NEW_SERVER_IP -N &

# Отправьте тестовое сообщение
# (используйте ТЕСТОВЫЙ номер!)
mcp__whatsapp__send_message phone:89686484488 message:"Тест нового сервера"

# Проверьте логи на новом сервере
ssh root@NEW_SERVER_IP "pm2 logs ai-admin-worker-v2 --lines 50"
```

### 6.5. Проверка базовых функций

**Отправьте боту:**

```
1. "Привет" - должен поздороваться
2. "Покажи услуги" - должен показать список услуг
3. "Записать на стрижку" - должен начать процесс записи
```

---

## 🔄 7. Переключение на новый сервер

### 7.1. Финальная синхронизация данных

```bash
# ПЕРЕД переключением - финальный бэкап Redis на СТАРОМ сервере
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Сохранение Redis
redis-cli -a 70GB32AhHvMisfK8LtluTbtkWTnTj5jSrOdQj7d1QMg= SAVE
cp /var/lib/redis/dump.rdb /tmp/redis_final.rdb
exit

# Копирование на новый сервер
scp -i ~/.ssh/id_ed25519_ai_admin \
  root@46.149.70.219:/tmp/redis_final.rdb \
  /tmp/redis_final.rdb

scp /tmp/redis_final.rdb root@NEW_SERVER_IP:/tmp/

# На новом сервере - восстановление Redis
ssh root@NEW_SERVER_IP
systemctl stop redis-server
cp /tmp/redis_final.rdb /var/lib/redis/dump.rdb
chown redis:redis /var/lib/redis/dump.rdb
systemctl start redis-server
```

### 7.2. Остановка старого сервера (на время переключения)

```bash
# На СТАРОМ сервере
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Остановите все сервисы
pm2 stop all

# Или остановите только критичные
pm2 stop ai-admin-api
pm2 stop ai-admin-worker-v2
```

### 7.3. Обновление webhooks (если используются)

**Если у вас настроены webhooks от внешних сервисов:**

```bash
# Обновите webhook URLs на:
# http://NEW_SERVER_IP:3000/webhook/...

# Для YClients marketplace (если используется):
# Обновите URL в настройках приложения
```

### 7.4. Обновление DNS (если используете домен)

**Если используете домен:**

1. Зайдите в панель управления DNS (Cloudflare, etc.)
2. Обновите A-запись:
   ```
   bot.yourdomain.com → NEW_SERVER_IP
   ```
3. Уменьшите TTL до 60 секунд (для быстрой propagation)
4. Подождите 1-5 минут

**Проверка:**

```bash
# На локальной машине
nslookup bot.yourdomain.com

# Должен вернуть NEW_SERVER_IP
```

### 7.5. Настройка SSL (если используете домен)

```bash
# На новом сервере
ssh root@NEW_SERVER_IP

# Получение SSL сертификата
certbot --nginx -d bot.yourdomain.com

# Тест обновления
certbot renew --dry-run
```

---

## 🎉 8. Пост-миграция

### 8.1. Мониторинг первые 24 часа

```bash
# На новом сервере
# Следите за логами
pm2 logs

# Следите за ресурсами
pm2 monit

# Или через htop
htop

# Проверяйте диск
df -h

# Проверяйте память
free -h
```

### 8.2. Настройка алертов

**Обновите MCP servers для работы с новым сервером:**

```bash
# На локальной машине
# Обновите SSH туннель
nano scripts/maintain-redis-tunnel.sh

# Замените старый IP на новый:
# OLD: ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
# NEW: ssh root@NEW_SERVER_IP

# Перезапустите туннель
./scripts/maintain-redis-tunnel.sh restart
```

### 8.3. Обновление документации

```bash
# Обновите CLAUDE.md с новым IP
cd ~/Documents/GitHub/ai_admin_v2
nano CLAUDE.md

# Замените:
# - **Server:** ssh root@NEW_SERVER_IP
# - Обновите примеры команд с новым IP
```

### 8.4. Финальная проверка

**Чеклист:**

- [ ] Health endpoint отвечает
- [ ] WhatsApp сессии работают
- [ ] Тестовые сообщения обрабатываются
- [ ] Записи создаются в YClients
- [ ] Redis работает
- [ ] Логи ротируются
- [ ] Бэкапы работают (cron)
- [ ] PM2 автостарт настроен
- [ ] SSL работает (если домен)
- [ ] Firewall настроен
- [ ] Мониторинг работает

---

## 🔙 9. Откат (если что-то пошло не так)

### 9.1. Быстрый откат на старый сервер

```bash
# 1. На СТАРОМ сервере - запустите сервисы
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
pm2 start all
pm2 logs

# 2. Если используете домен - верните старый IP в DNS
# bot.yourdomain.com → 46.149.70.219

# 3. Обновите webhook URLs обратно на старый сервер
```

### 9.2. Время на откат

- **Без DNS:** 1-2 минуты (просто запустить старый сервер)
- **С DNS:** 5-15 минут (ожидание propagation)

### 9.3. Сохранение данных с нового сервера

```bash
# Если на новом сервере появились новые данные
# Скопируйте Redis обратно
ssh root@NEW_SERVER_IP
redis-cli -a $(cat /root/.redis_password) SAVE
exit

scp root@NEW_SERVER_IP:/var/lib/redis/dump.rdb \
  ~/Downloads/redis_new_server.rdb

# Восстановите на старом сервере (если нужно)
```

---

## 📊 10. Сравнение производительности

### 10.1. Мониторинг метрик

**После миграции сравните:**

| Метрика | Старый сервер | Новый сервер | Улучшение |
|---------|--------------|--------------|-----------|
| CPU idle | ~95% | ? | ? |
| RAM usage | ~1.5GB / 2GB | ? GB / 16GB | ? |
| Disk I/O | ? | ? | ? |
| Response time | ~8-12s | ? | ? |
| Uptime | ? | 100% | ? |

**Как измерить:**

```bash
# CPU
top -bn1 | grep "Cpu(s)"

# RAM
free -h

# Disk I/O
iostat -x 1 5

# Response time (от клиента)
time curl http://NEW_SERVER_IP:3000/health
```

---

## 🎯 11. Оптимизация после миграции

### 11.1. Настройка PM2 для нового сервера

**С 16GB RAM можно увеличить concurrency:**

```bash
# Обновите .env
nano /opt/ai-admin/.env

# Увеличьте:
MESSAGE_QUEUE_CONCURRENCY=10  # было 5
DB_POOL_SIZE=30  # было 20

# Перезапустите
pm2 restart all
```

### 11.2. Настройка Redis для большей памяти

```bash
# Обновите Redis config
nano /etc/redis/redis.conf

# Увеличьте maxmemory
maxmemory 4gb  # было 2gb

# Перезапустите Redis
systemctl restart redis-server
```

---

## 📋 12. Чеклист миграции

### Перед миграцией:
- [ ] Заказан сервер AdminVPS "Pro"
- [ ] Подготовлен cloud-init скрипт
- [ ] Создан бэкап текущего сервера
- [ ] Скопирован SSH ключ
- [ ] Получен GitHub Personal Access Token
- [ ] Уведомлены пользователи о возможном downtime

### Во время миграции:
- [ ] Создан новый сервер с cloud-init
- [ ] Дождались завершения автоустановки (5-10 мин)
- [ ] Скопированы Baileys sessions
- [ ] Скопированы .env файлы
- [ ] Обновлены переменные в .env (Redis, IP)
- [ ] Собрано приложение (npm run build)
- [ ] Запущены сервисы (pm2 start)
- [ ] Протестировано на тестовом номере
- [ ] Остановлен старый сервер
- [ ] Обновлены webhooks (если есть)
- [ ] Обновлен DNS (если используется)

### После миграции:
- [ ] Проверен health endpoint
- [ ] Протестированы основные функции
- [ ] Настроен мониторинг
- [ ] Обновлена документация
- [ ] Настроены алерты
- [ ] Работают бэкапы (cron)
- [ ] Старый сервер остановлен (но не удален!)
- [ ] Мониторинг первые 24 часа

### Через неделю:
- [ ] Все работает стабильно
- [ ] Нет критических ошибок в логах
- [ ] Производительность улучшилась
- [ ] Можно удалить старый сервер
- [ ] Обновить все инструкции с новым IP

---

## 🆘 Troubleshooting

### Проблема: Cloud-init не завершился

```bash
# Проверьте логи
tail -f /var/log/cloud-init-output.log

# Если зависло - перезапустите вручную
cloud-init clean
cloud-init init
```

### Проблема: Redis connection failed

```bash
# Проверьте пароль
cat /root/.redis_password

# Проверьте .env
cat /opt/ai-admin/.env | grep REDIS_PASSWORD

# Должны совпадать!

# Проверьте Redis
redis-cli -a $(cat /root/.redis_password) PING
```

### Проблема: WhatsApp sessions не работают

```bash
# Проверьте права
ls -la /opt/ai-admin/baileys_sessions/
# Владелец должен быть ai-admin:ai-admin

# Если нет - исправьте
chown -R ai-admin:ai-admin /opt/ai-admin/baileys_sessions/

# Перезапустите
pm2 restart all
```

### Проблема: PM2 не запускается

```bash
# Проверьте логи
pm2 logs --err

# Проверьте права
ls -la /opt/ai-admin/

# Запустите от правильного пользователя
su - ai-admin
cd /opt/ai-admin
pm2 start ecosystem.config.js
```

---

## 💰 Стоимость миграции

| Статья расходов | Сумма |
|----------------|-------|
| AdminVPS Pro (1 мес) | 2,749₽ |
| Старый сервер (1 мес overlapping) | ~500₽ |
| **ИТОГО** | **~3,249₽** |

**После успешной миграции:**
- Экономия: **~1,300₽/мес** (vs Timeweb)
- ROI: окупается за 3 месяца

---

## 📚 Дополнительные ресурсы

- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Решение проблем
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Архитектура системы
- [MCP_SERVERS_GUIDE.md](./MCP_SERVERS_GUIDE.md) - Настройка MCP серверов
- [CLAUDE.md](../CLAUDE.md) - Quick reference

---

**Готовы к миграции? Удачи! 🚀**

*Если что-то пошло не так - не паникуйте, у вас есть полный бэкап и старый сервер всегда можно вернуть за 2 минуты.*
