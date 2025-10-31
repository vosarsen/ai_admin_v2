# ✅ Чеклист конфигурации сервера AdminVPS

**Назначение:** Быстрая проверка правильности настройки production сервера
**Для:** AI Admin v2 на AdminVPS
**Версия:** 1.0

---

## 🚀 Перед запуском сервера

### 1. Cloud-Init Configuration

- [ ] **GITHUB_REPO** - указан правильный репозиторий
- [ ] **GITHUB_TOKEN** - создан Personal Access Token с правами `repo`
- [ ] **SSH_PUBLIC_KEY** - вставлен публичный ключ из `~/.ssh/id_ed25519.pub`
- [ ] **TELEGRAM_BOT_TOKEN** - (опционально) токен для уведомлений
- [ ] **TELEGRAM_CHAT_ID** - (опционально) chat_id для уведомлений
- [ ] **DOMAIN** - указан домен или оставлен пустым для IP

### 2. Заказ сервера

- [ ] **Тариф:** Pro (8 CPU / 16GB RAM / 160GB NVMe) или выше
- [ ] **ЦОД:** Москва
- [ ] **ОС:** Ubuntu 22.04 LTS
- [ ] **Cloud-Init:** скопирован весь скрипт из `scripts/cloud-init-adminvps.yml`

---

## ⚙️ После создания сервера (5-10 мин установки)

### 3. Первое подключение

```bash
ssh root@NEW_SERVER_IP
```

- [ ] SSH подключение работает (по ключу)
- [ ] Нет запроса пароля (только ключ)

### 4. Проверка Cloud-Init

```bash
cat /root/SETUP_COMPLETE.txt
```

- [ ] Файл существует
- [ ] Показывает "✅ AI Admin v2 Setup Complete!"

```bash
tail -100 /var/log/cloud-init-output.log
```

- [ ] В конце лога нет критических ошибок
- [ ] Есть строка "All done! Server is ready for AI Admin v2"

### 5. Проверка установленных компонентов

```bash
# Node.js
node --version  # Должно быть v18.x.x
npm --version

# PM2
pm2 --version

# Redis
redis-cli --version
systemctl status redis-server  # Должен быть active (running)

# Nginx
nginx -v
systemctl status nginx  # Должен быть active (running)

# Git
git --version
```

- [ ] Node.js 18.x установлен
- [ ] PM2 установлен
- [ ] Redis запущен и активен
- [ ] Nginx запущен и активен
- [ ] Git установлен

### 6. Проверка директорий

```bash
ls -la /opt/ai-admin/
ls -la /backups/ai-admin/
ls -la /var/log/ai-admin/
```

- [ ] `/opt/ai-admin/` существует и принадлежит `ai-admin:ai-admin`
- [ ] `/backups/ai-admin/` существует
- [ ] `/var/log/ai-admin/` существует
- [ ] Репозиторий склонирован в `/opt/ai-admin/` (если был указан GITHUB_TOKEN)

### 7. Проверка Redis

```bash
# Получить пароль
REDIS_PASSWORD=$(cat /root/.redis_password)
echo "Redis password: $REDIS_PASSWORD"

# Проверить подключение
redis-cli -a $REDIS_PASSWORD PING
```

- [ ] Файл `/root/.redis_password` существует
- [ ] Команда `PING` возвращает `PONG`

### 8. Проверка Firewall

```bash
ufw status
```

- [ ] UFW активен (`Status: active`)
- [ ] Открыты порты: 22/tcp, 80/tcp, 443/tcp
- [ ] Закрыты все остальные порты

### 9. Проверка Swap

```bash
free -h
swapon --show
```

- [ ] Swap файл создан (2GB)
- [ ] Swap активен

---

## 📦 Копирование данных

### 10. Baileys Sessions

```bash
ls -la /opt/ai-admin/baileys_sessions/
ls -1 /opt/ai-admin/baileys_sessions/company_* | wc -l
```

- [ ] Директория существует
- [ ] Скопированы sessions со старого сервера
- [ ] Количество sessions совпадает со старым сервером
- [ ] Владелец: `ai-admin:ai-admin`

### 11. Environment файлы

```bash
ls -la /opt/ai-admin/.env*
cat /opt/ai-admin/.env | grep -E "(REDIS_PASSWORD|API_BASE_URL|WEBHOOK_URL)"
```

- [ ] Файл `.env` существует
- [ ] `REDIS_PASSWORD` совпадает с `/root/.redis_password`
- [ ] `API_BASE_URL` указывает на НОВЫЙ сервер
- [ ] `WEBHOOK_URL` указывает на НОВЫЙ сервер
- [ ] Все токены (YClients, AI, Supabase) скопированы со старого сервера

### 12. Node modules

```bash
ls -la /opt/ai-admin/node_modules/
```

- [ ] Директория `node_modules/` существует
- [ ] Зависимости установлены (`npm install` выполнен)

### 13. Build

```bash
ls -la /opt/ai-admin/dist/
```

- [ ] Директория `dist/` существует
- [ ] TypeScript скомпилирован (`npm run build` выполнен)

---

## 🚀 Запуск сервисов

### 14. PM2 Status

```bash
pm2 status
```

- [ ] Запущено 5+ процессов
- [ ] `ai-admin-api` - online
- [ ] `ai-admin-worker-v2` - online
- [ ] `ai-admin-batch-processor` - online
- [ ] `ai-admin-booking-monitor` - online
- [ ] `ai-admin-telegram-bot` - online (если используется)
- [ ] Все процессы в статусе `online` (не `errored`)

### 15. PM2 Logs

```bash
pm2 logs --lines 50 --nostream
pm2 logs --err --lines 50 --nostream
```

- [ ] Нет критических ошибок (`ERROR`, `CRITICAL`)
- [ ] Нет ошибок подключения к Redis
- [ ] Нет ошибок подключения к Supabase
- [ ] WhatsApp sessions загружаются без ошибок

### 16. PM2 Log Rotation

```bash
pm2 conf pm2-logrotate
```

- [ ] `max_size: 100M`
- [ ] `retain: 20`
- [ ] `compress: true`

### 17. PM2 Startup

```bash
pm2 save
systemctl status pm2-root  # или pm2-ai-admin
```

- [ ] PM2 конфигурация сохранена
- [ ] PM2 добавлен в автозагрузку (systemd)

---

## 🌐 Nginx и SSL

### 18. Nginx Configuration

```bash
nginx -t
cat /etc/nginx/sites-available/ai-admin
```

- [ ] Конфигурация корректна (`nginx -t` успешно)
- [ ] Proxy pass на `localhost:3000`
- [ ] Установлены правильные headers
- [ ] Таймауты: 60s (для AI запросов)

### 19. Nginx Status

```bash
systemctl status nginx
curl http://localhost:80
```

- [ ] Nginx запущен
- [ ] Порт 80 отвечает

### 20. SSL (если используется домен)

```bash
certbot certificates
curl https://your-domain.com/health
```

- [ ] SSL сертификат получен (если домен настроен)
- [ ] Автообновление работает (`certbot renew --dry-run`)
- [ ] HTTPS работает

---

## ✅ Функциональное тестирование

### 21. Health Check

```bash
curl http://localhost:3000/health
```

**Ожидаемый ответ:**
```json
{"status":"ok","timestamp":"..."}
```

- [ ] Endpoint `/health` отвечает
- [ ] Статус `ok`

### 22. Redis Health

```bash
redis-cli -a $(cat /root/.redis_password) INFO server
redis-cli -a $(cat /root/.redis_password) DBSIZE
```

- [ ] Redis отвечает
- [ ] Есть данные в базе (DBSIZE > 0)

### 23. WhatsApp Status

**На локальной машине (с MCP):**

```bash
# Настройте SSH tunnel
ssh -L 6380:localhost:6379 root@NEW_SERVER_IP -N &

# Проверьте контекст
mcp__redis__get_context phone:89686484488
```

- [ ] SSH туннель работает
- [ ] Redis доступен через туннель
- [ ] MCP servers подключаются

### 24. Test Message

**Отправьте тестовое сообщение:**

```bash
mcp__whatsapp__send_message phone:89686484488 message:"Тест нового сервера"
```

**На сервере:**

```bash
pm2 logs ai-admin-worker-v2 --lines 100
```

- [ ] Сообщение получено ботом
- [ ] AI обработка запустилась
- [ ] Команды выполнены
- [ ] Ответ отправлен
- [ ] Нет ошибок в логах

### 25. Booking Test

**Попробуйте создать запись:**

1. Отправьте: "Привет"
2. Отправьте: "Покажи услуги"
3. Отправьте: "Записать на стрижку"
4. Следуйте диалогу

- [ ] Бот отвечает на приветствие
- [ ] Показывает список услуг
- [ ] Запускает процесс записи
- [ ] Предлагает выбор даты/времени
- [ ] Создает запись в YClients (проверьте в YClients!)

---

## 📊 Мониторинг и бэкапы

### 26. System Resources

```bash
htop
free -h
df -h
```

- [ ] CPU загрузка < 50% в idle
- [ ] RAM использовано < 8GB из 16GB в idle
- [ ] Disk использовано < 20GB из 160GB
- [ ] Swap не используется (или минимально)

### 27. PM2 Monitoring

```bash
pm2 monit
```

- [ ] Все процессы работают стабильно
- [ ] Memory leak нет (память не растет постоянно)
- [ ] CPU не зашкаливает

### 28. Backup Script

```bash
cat /opt/ai-admin/backup.sh
crontab -l | grep backup
```

- [ ] Скрипт `/opt/ai-admin/backup.sh` существует
- [ ] Скрипт исполняемый (`chmod +x`)
- [ ] Добавлен в cron (запуск в 3:00 ежедневно)

### 29. Test Backup

```bash
/opt/ai-admin/backup.sh
ls -la /backups/ai-admin/
```

- [ ] Скрипт выполняется без ошибок
- [ ] Создаются файлы: `redis_*.rdb`, `baileys_sessions_*.tar.gz`, `env_*.tar.gz`
- [ ] Старые бэкапы удаляются (> 7 дней)

---

## 🔒 Безопасность

### 30. SSH Security

```bash
cat /etc/ssh/sshd_config | grep -E "(PermitRootLogin|PasswordAuthentication)"
```

- [ ] `PermitRootLogin prohibit-password` (только ключи)
- [ ] `PasswordAuthentication no` (без паролей)

### 31. Firewall Rules

```bash
ufw status verbose
```

- [ ] Открыты только: 22, 80, 443
- [ ] Default policy: deny incoming, allow outgoing

### 32. Secrets Protection

```bash
ls -la /root/.redis_password
ls -la /opt/ai-admin/.env
```

- [ ] `/root/.redis_password` - права `600` (только root читает)
- [ ] `/opt/ai-admin/.env` - права `600` или `640`
- [ ] `.env` не доступен извне

### 33. Automatic Updates

```bash
dpkg -l | grep unattended-upgrades
cat /etc/apt/apt.conf.d/50unattended-upgrades
```

- [ ] `unattended-upgrades` установлен
- [ ] Автообновления безопасности включены

---

## 📱 Интеграции

### 34. YClients API

```bash
cat /opt/ai-admin/.env | grep YCLIENTS
```

- [ ] `YCLIENTS_BEARER_TOKEN` установлен
- [ ] `YCLIENTS_PARTNER_ID` установлен
- [ ] `YCLIENTS_COMPANY_ID` установлен

**Тест:**

```bash
curl -H "Authorization: Bearer YOUR_BEARER_TOKEN" \
  -H "Accept: application/vnd.yclients.v2+json" \
  https://api.yclients.com/api/v1/companies/962302
```

- [ ] API YClients отвечает
- [ ] Токены валидны

### 35. Supabase

```bash
cat /opt/ai-admin/.env | grep SUPABASE
```

- [ ] `SUPABASE_URL` установлен
- [ ] `SUPABASE_KEY` установлен
- [ ] `SUPABASE_SERVICE_KEY` установлен

**Тест:**

```bash
curl https://ujmbqmvmdgxavmrcpzvf.supabase.co/rest/v1/ \
  -H "apikey: YOUR_SUPABASE_KEY"
```

- [ ] Supabase отвечает
- [ ] Подключение работает

### 36. AI Provider (DeepSeek)

```bash
cat /opt/ai-admin/.env | grep -E "(DEEPSEEK|AI_PROVIDER)"
```

- [ ] `DEEPSEEK_API_KEY` установлен
- [ ] `AI_PROVIDER=deepseek`

**Проверка в логах:**

```bash
pm2 logs ai-admin-worker-v2 --lines 100 | grep -i deepseek
```

- [ ] AI запросы проходят
- [ ] Нет ошибок API ключа

---

## 🔄 После миграции

### 37. DNS Update (если используется домен)

```bash
nslookup your-domain.com
```

- [ ] A-запись указывает на НОВЫЙ сервер
- [ ] DNS propagation завершена

### 38. Webhook Update

- [ ] Webhooks обновлены на новый IP/домен
- [ ] YClients marketplace webhook (если используется)
- [ ] Другие внешние webhooks

### 39. MCP Servers

```bash
# На локальной машине
cat ~/Documents/GitHub/ai_admin_v2/scripts/maintain-redis-tunnel.sh | grep ssh
```

- [ ] SSH команды обновлены на новый IP
- [ ] Redis tunnel работает
- [ ] MCP servers подключаются

### 40. Documentation

```bash
cat ~/Documents/GitHub/ai_admin_v2/CLAUDE.md | grep "Server:"
```

- [ ] CLAUDE.md обновлен с новым IP
- [ ] Все инструкции обновлены
- [ ] Примеры команд используют новый IP

---

## 🎯 Финальная проверка

### 41. 24 Hours Stability Test

**Через 24 часа после запуска:**

```bash
uptime
pm2 status
pm2 logs --err --lines 200
```

- [ ] Uptime > 1 day
- [ ] Все сервисы online
- [ ] Нет повторяющихся ошибок в логах
- [ ] Memory usage стабилен (не растет)

### 42. Real Client Test

**Попросите реального пользователя (или тестового клиента):**

- [ ] Написать боту
- [ ] Создать запись
- [ ] Получить подтверждение
- [ ] Проверить запись в YClients

### 43. Load Test (опционально)

**Отправьте 10-20 сообщений одновременно:**

- [ ] Все сообщения обработаны
- [ ] Нет таймаутов
- [ ] CPU справляется (< 80%)
- [ ] Memory не переполняется

---

## 🗑️ Очистка старого сервера

### 44. Через неделю после миграции

**Если все работает стабильно:**

- [ ] Остановите старый сервер
- [ ] Создайте финальный бэкап старого сервера
- [ ] Скачайте бэкап локально
- [ ] Удалите старый сервер (или поставьте на паузу)

---

## 📋 Quick Checklist (краткий)

### Обязательные проверки перед production:

- [ ] ✅ Cloud-init завершился успешно
- [ ] ✅ Redis работает с паролем
- [ ] ✅ PM2 все сервисы online
- [ ] ✅ Health endpoint отвечает
- [ ] ✅ WhatsApp sessions загружены
- [ ] ✅ Тестовое сообщение обработано
- [ ] ✅ Запись создается в YClients
- [ ] ✅ Нет критических ошибок в логах
- [ ] ✅ Firewall настроен
- [ ] ✅ SSH только по ключу
- [ ] ✅ Nginx работает
- [ ] ✅ Бэкапы настроены
- [ ] ✅ PM2 автостарт

### Критические ошибки (стоп-факторы):

- ❌ Redis не запускается
- ❌ PM2 процессы в состоянии `errored`
- ❌ WhatsApp sessions не загружаются
- ❌ Ошибки подключения к Supabase
- ❌ AI API не отвечает (неверный ключ)
- ❌ Health endpoint не отвечает
- ❌ Тестовые сообщения не обрабатываются

**Если есть критические ошибки - НЕ переключайте на production!**
**Сначала исправьте проблемы.**

---

## 📞 Поддержка

**При проблемах:**

1. Проверьте логи: `pm2 logs --err --lines 200`
2. Проверьте `/var/log/cloud-init-output.log`
3. См. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
4. См. [ADMINVPS_MIGRATION_GUIDE.md](./ADMINVPS_MIGRATION_GUIDE.md)

**AdminVPS Support:**
- Email: support@adminvps.ru
- Ticket: через панель управления

---

**✅ Если все пункты отмечены - сервер готов к production!** 🚀
