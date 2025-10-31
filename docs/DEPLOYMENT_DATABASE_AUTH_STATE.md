# Развёртывание Database Auth State

## ✅ Что уже сделано

1. ✅ SQL миграция создана и применена в Supabase
2. ✅ useSupabaseAuthState реализован
3. ✅ Интеграция в session-pool.js с feature flag
4. ✅ Скрипт миграции файлов → база
5. ✅ Автоочистка expired keys

## 🚀 Шаги для развёртывания

### 1. Мигрировать файлы в базу данных (на сервере)

```bash
# SSH на сервер
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Перейти в директорию проекта
cd /opt/ai-admin

# Pull последних изменений
git pull origin feature/redis-context-cache

# Установить зависимости (если нужно)
npm install

# Запустить миграцию для компании 962302
node scripts/migrate-baileys-files-to-database.js 962302

# Проверить результат миграции
# Должно быть:
# ✅ Backup created
# ✅ Credentials migrated
# ✅ All keys migrated
# ✅ Verification passed
```

### 2. Включить database auth state

```bash
# Добавить в .env на сервере
echo "USE_DATABASE_AUTH_STATE=true" >> /opt/ai-admin/.env

# Проверить
cat /opt/ai-admin/.env | grep USE_DATABASE_AUTH_STATE
```

### 3. Перезапустить сервисы

```bash
# Перезапустить worker (включит автоочистку)
pm2 restart ai-admin-worker-v2

# Перезапустить WhatsApp сервис (если есть отдельный)
# pm2 restart baileys-service  # Если используется

# Проверить логи
pm2 logs ai-admin-worker-v2 --lines 50
```

### 4. Проверка работы

```bash
# Логи должны показать:
# 🗄️  Using database auth state for company 962302
# 🤖 Database auth state enabled - starting automatic cleanup
# 🧹 Starting automatic cleanup...

# Отправить тестовое сообщение через MCP
```

Локально (Claude Code):
```javascript
@whatsapp send_message phone:89686484488 message:"Привет! Тест database auth"
@whatsapp get_last_response phone:89686484488
```

### 5. Мониторинг (первые 24 часа)

```bash
# Проверять логи каждые 2-3 часа
pm2 logs ai-admin-worker-v2 --lines 100

# Смотреть на:
# - "Using database auth state" - должно быть ✅
# - Нет ли ошибок с Supabase
# - Автоочистка работает (каждые 6 часов)
# - Сообщения отправляются/получаются
```

### 6. Проверка в Supabase Dashboard

```
1. Открыть Supabase Dashboard
2. Table Editor → whatsapp_auth
   - Должна быть 1 запись (company_id: 962302)
3. Table Editor → whatsapp_keys
   - Должны быть записи (app-state-sync, lid-mappings)
4. SQL Editor → Запустить:
   SELECT * FROM get_whatsapp_auth_stats();
   - Покажет статистику
```

### 7. Cleanup legacy файлов (через 7 дней успешной работы)

```bash
# ТОЛЬКО после 7 дней успешной работы!
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

cd /opt/ai-admin

# Опционально: дополнительный бэкап
tar -czf baileys_sessions_final_backup_$(date +%Y%m%d).tar.gz baileys_sessions/

# Удалить старые файлы
find baileys_sessions/company_962302/ -name "lid-mapping-*" -delete

# Или удалить всю папку (если уверены)
# rm -rf baileys_sessions/company_962302/
```

## 🔧 Rollback (если что-то пошло не так)

### Вариант 1: Откат на файлы (быстро)

```bash
# 1. Выключить database auth state
sed -i 's/USE_DATABASE_AUTH_STATE=true/USE_DATABASE_AUTH_STATE=false/' /opt/ai-admin/.env

# 2. Перезапустить
pm2 restart ai-admin-worker-v2

# 3. Проверить логи - должно быть "Using file auth state"
pm2 logs ai-admin-worker-v2 --lines 50
```

### Вариант 2: Восстановить из бэкапа

```bash
# Если файлы были удалены, восстановить из бэкапа
cp -r /opt/ai-admin/baileys_sessions_backup/company_962302/backup_* \
      /opt/ai-admin/baileys_sessions/company_962302/
```

## 📊 Ожидаемые результаты

### До миграции (файлы):
- 337 файлов в `baileys_sessions/company_962302/`
- Риск device_removed
- Ручная очистка

### После миграции (база данных):
- ~50-100 записей в `whatsapp_keys` (с TTL)
- Автоочистка каждые 6 часов
- Производительность в 5-400x лучше
- Zero maintenance

## ❓ Troubleshooting

### Проблема: "Failed to load credentials"
**Решение:** Проверить подключение к Supabase:
```bash
# Проверить SUPABASE_URL и SUPABASE_KEY в .env
cat /opt/ai-admin/.env | grep SUPABASE
```

### Проблема: "Table whatsapp_auth does not exist"
**Решение:** Применить SQL миграцию еще раз в Supabase Dashboard

### Проблема: Сообщения не отправляются
**Решение:** Проверить логи и откатиться на файлы:
```bash
pm2 logs ai-admin-worker-v2 --err --lines 100
# Откат: USE_DATABASE_AUTH_STATE=false
```

### Проблема: Автоочистка не запускается
**Решение:** Проверить что feature flag включен:
```bash
cat /opt/ai-admin/.env | grep USE_DATABASE_AUTH_STATE
# Должно быть: USE_DATABASE_AUTH_STATE=true
```

## 📚 Дополнительная документация

- `docs/architecture/BAILEYS_DATABASE_AUTH_STATE.md` - Полная архитектура
- `docs/architecture/PERFORMANCE_AND_SCALABILITY_ANALYSIS.md` - Анализ производительности
- `docs/architecture/CLEANUP_STRATEGY_AFTER_MIGRATION.md` - Стратегия очистки

---

**Дата:** 2025-10-07
**Автор:** AI Assistant
**Статус:** Ready for deployment
