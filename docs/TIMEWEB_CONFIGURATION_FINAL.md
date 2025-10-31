# Финальная конфигурация TimeWeb для AI Admin v2

**Дата:** 31 октября 2025
**Текущая ситуация:** 1 клиент (KULTURA), планируется рост до 50 компаний

---

## 🎯 Рекомендуемая конфигурация для старта

### 1. VPS (Приложение)

**Параметры:**
- **CPU:** 4 vCPU
- **RAM:** 8 ГБ
- **Диск:** 50 ГБ SSD
- **ОС:** Ubuntu 22.04 LTS

**Что размещается:**
- Node.js приложение (AI Admin v2)
- Redis 8.1 (локально установленный)
- WhatsApp (Baileys сессии)
- Nginx (reverse proxy)
- Xray (VPN для Gemini API)

**Стоимость:** ~3,000 ₽/мес

**Хватит на:** 10-15 компаний

---

### 2. PostgreSQL 18 (База данных)

**Тип БД из списка TimeWeb:** ✅ **PostgreSQL 18**

**Параметры:**
- **CPU:** 2 vCPU
- **RAM:** 4 ГБ
- **Диск:** 30 ГБ HDD (можно SSD для лучшей производительности)

**Что хранится:**
- Таблица companies (компании/салоны)
- Таблица clients (клиенты салонов)
- Таблица bookings (записи)
- Таблица services (услуги)
- Таблица staff (мастера)
- Таблица schedules (расписания)

**Стоимость:** ~1,500-1,800 ₽/мес

**Хватит на:** 20-30 компаний (объем данных ~2-5 ГБ)

---

### 3. Redis 8.1

**Вариант A: На VPS** ✅ **РЕКОМЕНДУЕТСЯ для старта**

**Установка:** Локально на VPS вместе с приложением

**Использование:**
- Очереди BullMQ (whatsapp-messages, reminders)
- Кэш контекстов диалогов (TTL: 24 часа)
- Временные данные

**Потребление ресурсов:**
- RAM: ~50-100 МБ (для 1-10 компаний)
- CPU: минимальное

**Стоимость:** 0 ₽ (входит в VPS)

---

**Вариант Б: Отдельный managed Redis** (для роста)

**Тип БД из списка TimeWeb:** ✅ **Redis 8.1**

**Параметры:**
- **RAM:** 1-2 ГБ
- **Диск:** 10 ГБ

**Когда переходить:**
- При 15+ компаниях
- Когда Redis на VPS использует > 500 МБ RAM
- Для повышения надежности

**Стоимость:** ~500-800 ₽/мес

---

## 📊 Итоговая стоимость

### Вариант 1: Старт (1-15 компаний)

```
VPS 4/8/50 (с Redis внутри):  3,000 ₽/мес
PostgreSQL 2/4/30:             1,800 ₽/мес
                              ___________
ИТОГО:                         4,800 ₽/мес
```

**Хватит на:** 10-15 компаний

**Экономия vs текущая (8,265 ₽):** **3,465 ₽/мес** = **41,580 ₽/год** 🎉

---

### Вариант 2: Рост (15-30 компаний)

```
VPS 4/8/50:                    3,000 ₽/мес
PostgreSQL 4/8/80:             3,255 ₽/мес
Redis 1GB (отдельно):            600 ₽/мес
                              ___________
ИТОГО:                         6,855 ₽/мес
```

**Хватит на:** 20-30 компаний

**Экономия vs текущая:** **1,410 ₽/мес**

---

### Вариант 3: Масштабирование (30-50 компаний)

```
VPS 6/16/100:                  5,500 ₽/мес
PostgreSQL 8/16/220:           7,170 ₽/мес
Redis 2GB:                       800 ₽/мес
                              ___________
ИТОГО:                        13,470 ₽/мес
```

**Хватит на:** 50+ компаний

---

## 🗂️ Какие БД заказывать на TimeWeb

Из доступного списка:

### ✅ Заказываем СЕЙЧАС:

1. **PostgreSQL 18**
   - Версия: 18 (последняя стабильная)
   - Конфигурация: 2 vCPU, 4 ГБ RAM, 30 ГБ
   - Назначение: Основная БД

### ⏸️ Заказываем ПОЗЖЕ (при росте):

2. **Redis 8.1**
   - Версия: 8.1 (последняя)
   - Конфигурация: 1 ГБ RAM, 10 ГБ
   - Когда: При 15+ компаниях

### ❌ НЕ нужны:

- ❌ **MySQL 8.4** - используется PostgreSQL, не нужна
- ❌ **MongoDB 8.0** - не используется в проекте
- ❌ **ClickHouse 25.1.6** - для аналитики больших данных, не нужна
- ❌ **OpenSearch 2.19.1** - для полнотекстового поиска, не нужна
- ❌ **RabbitMQ 4.0** - используется BullMQ (Redis-based), не нужна
- ❌ **Kafka 3.5.1** - для event streaming, не нужна

---

## 🚀 План действий по миграции

### Шаг 1: Заказать инфраструктуру

**На TimeWeb заказать:**

1. **VPS:**
   - Тариф: Cloud VPS-4 (или аналог)
   - Параметры: 4 vCPU, 8 ГБ RAM, 50 ГБ SSD
   - ОС: Ubuntu 22.04 LTS
   - Стоимость: ~3,000 ₽/мес

2. **PostgreSQL (managed):**
   - Тип: PostgreSQL 18
   - Параметры: 2 vCPU, 4 ГБ RAM, 30 ГБ HDD
   - Стоимость: ~1,800 ₽/мес

**Redis:** Пока НЕ заказывать отдельно (будет на VPS)

---

### Шаг 2: Настроить VPS

```bash
# 1. Подключиться к VPS
ssh root@<IP_адрес>

# 2. Обновить систему
apt update && apt upgrade -y

# 3. Установить Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 4. Установить Redis локально
apt install -y redis-server
systemctl enable redis-server
systemctl start redis-server

# 5. Установить PM2
npm install -g pm2

# 6. Установить Nginx
apt install -y nginx
systemctl enable nginx

# 7. Установить Xray (для VPN для Gemini)
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install

# 8. Создать директорию проекта
mkdir -p /opt/ai-admin
cd /opt/ai-admin
```

---

### Шаг 3: Настроить PostgreSQL

**Получить данные подключения от TimeWeb:**
```
Host: <managed_postgres_host>
Port: 5432
Database: ai_admin_v2
Username: <username>
Password: <password>
```

**Обновить .env:**
```bash
# Заменить Supabase на собственный PostgreSQL
SUPABASE_URL=postgresql://<username>:<password>@<host>:5432/ai_admin_v2
SUPABASE_KEY=  # Не нужен для прямого подключения
```

---

### Шаг 4: Мигрировать данные с Supabase

**A. Экспорт данных из Supabase:**

```bash
# На локальной машине или через Supabase Dashboard
# Экспортировать все таблицы в SQL
# Или использовать pg_dump если есть прямой доступ
```

**Б. Импорт в новый PostgreSQL:**

```bash
# Подключиться к новой БД
psql -h <host> -U <username> -d ai_admin_v2

# Выполнить SQL скрипт создания таблиц
\i schema.sql

# Импортировать данные
\i data.sql
```

**В. Проверить данные:**

```sql
-- Проверить таблицы
\dt

-- Проверить количество записей
SELECT COUNT(*) FROM companies;
SELECT COUNT(*) FROM clients;
SELECT COUNT(*) FROM bookings;
```

---

### Шаг 5: Настроить Redis на VPS

**Конфигурация Redis:**

```bash
# Отредактировать конфиг
nano /etc/redis/redis.conf

# Важные настройки:
# bind 127.0.0.1  (только локальный доступ)
# maxmemory 256mb  (лимит памяти)
# maxmemory-policy allkeys-lru  (политика вытеснения)

# Перезапустить Redis
systemctl restart redis-server

# Проверить статус
systemctl status redis-server
redis-cli ping  # Должно вернуть PONG
```

**Обновить .env:**
```bash
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=  # Оставить пустым для локального
```

---

### Шаг 6: Деплой приложения

```bash
# 1. Клонировать репозиторий
cd /opt/ai-admin
git clone <your-repo-url> .

# 2. Установить зависимости
npm install --production

# 3. Скопировать .env
cp .env.example .env
nano .env  # Заполнить все переменные

# 4. Запустить с PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 5. Проверить логи
pm2 logs
```

---

### Шаг 7: Настроить Nginx

```bash
# Создать конфиг для приложения
nano /etc/nginx/sites-available/ai-admin

# Содержимое:
server {
    listen 80;
    server_name <your-domain-or-ip>;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Активировать конфиг
ln -s /etc/nginx/sites-available/ai-admin /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

### Шаг 8: Проверить работу

**A. WhatsApp подключение:**
```bash
# Проверить сессию Baileys
ls -la /opt/ai-admin/baileys_sessions/

# Если нет - запустить pairing code
# Приложение само попросит код при старте
pm2 logs
```

**Б. Отправить тестовое сообщение:**
```bash
# Через MCP или напрямую на WhatsApp
# Отправить сообщение на +79936363848 с тестового номера
```

**В. Проверить логи:**
```bash
pm2 logs ai-admin-worker-v2 --lines 100
```

**Г. Проверить БД:**
```bash
# Подключиться к PostgreSQL
psql -h <host> -U <username> -d ai_admin_v2

# Проверить последние записи
SELECT * FROM bookings ORDER BY created_at DESC LIMIT 5;
```

**Д. Проверить Redis:**
```bash
redis-cli
> KEYS *
> GET context:79936363848  # Должен показать контекст диалога
```

---

## 📊 Мониторинг после миграции

### Что мониторить:

**VPS:**
```bash
# CPU и RAM
htop

# Дисковое пространство
df -h

# Сетевая активность
nethogs

# PM2 процессы
pm2 monit
```

**PostgreSQL:**
```sql
-- Размер БД
SELECT pg_size_pretty(pg_database_size('ai_admin_v2'));

-- Slow queries
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;

-- Активные соединения
SELECT count(*) FROM pg_stat_activity;
```

**Redis:**
```bash
redis-cli INFO memory
redis-cli INFO stats
```

---

## 🎯 Когда масштабировать

### VPS - апгрейд с 4/8 до 6/12:

- ⚠️ CPU средняя нагрузка > 60%
- ⚠️ RAM использование > 70%
- ⚠️ Количество компаний > 10

### PostgreSQL - апгрейд с 2/4 до 4/8:

- ⚠️ Размер БД > 20 ГБ
- ⚠️ Slow queries регулярно
- ⚠️ Количество компаний > 15

### Redis - вынести на отдельный сервер:

- ⚠️ Redis использует > 500 МБ RAM на VPS
- ⚠️ Eviction rate растет
- ⚠️ Количество компаний > 15

---

## 💾 Резервное копирование

### PostgreSQL (managed на TimeWeb):

```bash
# TimeWeb обычно предоставляет автоматические бэкапы
# Дополнительно - ручной backup раз в день:

pg_dump -h <host> -U <username> -d ai_admin_v2 > backup_$(date +%Y%m%d).sql

# Хранить последние 7 дней
# Можно настроить cron job
```

### Redis:

```bash
# Настроить RDB snapshots в redis.conf
save 900 1      # Сохранять если 1+ изменение за 15 минут
save 300 10     # Сохранять если 10+ изменений за 5 минут
save 60 10000   # Сохранять если 10000+ изменений за 1 минуту

# Файл: /var/lib/redis/dump.rdb
# Копировать ежедневно
cp /var/lib/redis/dump.rdb /backup/redis_$(date +%Y%m%d).rdb
```

### Baileys сессии WhatsApp:

```bash
# Бэкап сессий WhatsApp
tar -czf baileys_sessions_$(date +%Y%m%d).tar.gz /opt/ai-admin/baileys_sessions/

# Хранить последнюю рабочую сессию отдельно
```

---

## 🔐 Безопасность

### PostgreSQL:

- ✅ Подключение только с IP VPS (whitelist)
- ✅ Сложный пароль
- ✅ SSL соединение (если поддерживается TimeWeb)

### Redis на VPS:

- ✅ Bind только на localhost (127.0.0.1)
- ✅ Не слушать внешние подключения
- ✅ Пароль (опционально, но желательно)

### VPS:

- ✅ SSH ключи (отключить пароль)
- ✅ Firewall (UFW):
  ```bash
  ufw allow 22      # SSH
  ufw allow 80      # HTTP
  ufw allow 443     # HTTPS (если SSL)
  ufw enable
  ```
- ✅ Fail2ban для защиты от brute-force
- ✅ Регулярные обновления системы

---

## 📝 Чеклист миграции

- [ ] Заказать VPS 4/8/50 на TimeWeb
- [ ] Заказать PostgreSQL 18 (2/4/30) на TimeWeb
- [ ] Настроить VPS (Node.js, Redis, PM2, Nginx, Xray)
- [ ] Экспортировать данные из Supabase
- [ ] Импортировать данные в новый PostgreSQL
- [ ] Обновить .env (SUPABASE_URL, REDIS_URL)
- [ ] Деплой приложения на новый VPS
- [ ] Настроить Nginx
- [ ] Переподключить WhatsApp (Baileys pairing code)
- [ ] Тестирование:
  - [ ] Отправить тестовое сообщение
  - [ ] Проверить AI ответы
  - [ ] Проверить создание записи
  - [ ] Проверить напоминания
- [ ] Настроить мониторинг (PM2, PostgreSQL, Redis)
- [ ] Настроить резервное копирование
- [ ] Настроить безопасность (UFW, SSH keys)
- [ ] Отключить старый сервер (после 1-2 недель успешной работы)

---

## 💰 Итоговая экономия

```
Текущая конфигурация:           8,265 ₽/мес
Новая конфигурация:             4,800 ₽/мес
                               ___________
Экономия:                       3,465 ₽/мес

За год:                        41,580 ₽ 🎉
```

**При этом:**
- ✅ Собственная инфраструктура (не Supabase)
- ✅ Полный контроль над БД
- ✅ Возможность масштабирования
- ✅ Хватит на 10-15 компаний без изменений

---

**Следующий шаг:** Заказать VPS и PostgreSQL на TimeWeb и начать миграцию! 🚀
