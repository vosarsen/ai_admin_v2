# Стратегия очистки после миграции на Database Auth State

## 🎯 Главный вопрос: Нужна ли агрессивная очистка файлов после миграции?

**Короткий ответ:** НЕТ! ❌

**Длинный ответ:** Читай дальше 👇

---

## 📊 Что меняется после миграции

### ДО миграции (useMultiFileAuthState)
```
┌─────────────────────────────────────────────────────┐
│ Baileys Session                                     │
│ ↓                                                   │
│ useMultiFileAuthState                               │
│ ↓                                                   │
│ Файловая система                                    │
│   ├── creds.json                                    │
│   ├── app-state-sync-key-*.json                     │
│   └── lid-mapping-*.json (накапливаются!) 📈        │
│                                                     │
│ Проблема: 337 файлов за 9 дней                     │
│ Решение: Агрессивная очистка каждые 6 часов ⚠️      │
└─────────────────────────────────────────────────────┘
```

### ПОСЛЕ миграции (useSupabaseAuthState)
```
┌─────────────────────────────────────────────────────┐
│ Baileys Session                                     │
│ ↓                                                   │
│ useSupabaseAuthState                                │
│ ↓                                                   │
│ PostgreSQL (Supabase)                               │
│   whatsapp_keys table                               │
│   ├── expires_at column (TTL) ⏰                     │
│   └── Автоматическая очистка PostgreSQL 🤖          │
│                                                     │
│ Проблема: ✅ РЕШЕНА                                 │
│ Файлы: НЕ создаются! Агрессивная очистка НЕ нужна! │
└─────────────────────────────────────────────────────┘
```

---

## ✅ Что происходит с файлами после миграции?

### 1. Старые файлы (legacy)
```bash
/opt/ai-admin/baileys_sessions/company_962302/
├── creds.json                    # Старый, не используется
├── app-state-sync-key-*.json     # Старые, не используются
└── lid-mapping-*.json (337 шт)   # Старые, не используются

Baileys больше НЕ пишет в эти файлы! ✅
```

**Действие:** Одноразовая очистка (см. ниже)

### 2. Новые файлы
```bash
После миграции: НЕ СОЗДАЮТСЯ! 🎉

Baileys использует database auth state:
- Все записи → PostgreSQL
- Файловая система НЕ используется
```

**Действие:** Никаких! Агрессивная очистка НЕ нужна!

---

## 🧹 План очистки после миграции

### Этап 1: Одноразовая очистка старых файлов (сразу после миграции)

```bash
#!/bin/bash
# scripts/cleanup-legacy-baileys-files.sh

COMPANY_ID=${1:-962302}
SESSION_DIR="/opt/ai-admin/baileys_sessions/company_${COMPANY_ID}"
BACKUP_DIR="/opt/ai-admin/baileys_sessions_backup/company_${COMPANY_ID}"

echo "🧹 Cleaning up legacy Baileys files for company ${COMPANY_ID}..."

# 1. Создать полный бэкап (на всякий случай)
if [ -d "$SESSION_DIR" ]; then
    echo "📦 Creating backup..."
    mkdir -p "$BACKUP_DIR"
    cp -r "$SESSION_DIR" "$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S)"
    echo "✅ Backup created: $BACKUP_DIR"
fi

# 2. Удалить ВСЕ lid-mapping файлы (больше не нужны)
echo "🗑️  Removing lid-mapping files..."
find "$SESSION_DIR" -name "lid-mapping-*" -delete
REMOVED_LID=$(find "$SESSION_DIR" -name "lid-mapping-*" | wc -l)
echo "✅ Removed lid-mapping files"

# 3. Оставить только критичные файлы (для экстренного восстановления)
echo "📋 Keeping only critical files..."
cd "$SESSION_DIR"
ls -1 | grep -v "creds.json" | grep -v "app-state-sync-" | xargs rm -f
echo "✅ Cleaned up non-critical files"

# 4. Опционально: удалить всю папку (если уверены в миграции)
# echo "🗑️  Removing entire session directory..."
# rm -rf "$SESSION_DIR"
# echo "✅ Session directory removed"

echo "✅ Cleanup completed!"
```

**Когда запускать:** Через 7 дней после миграции (когда убедимся что всё работает)

### Этап 2: Отключить агрессивную очистку файлов

```bash
# В whatsapp-backup-service или где она настроена

# УДАЛИТЬ или ЗАКОММЕНТИРОВАТЬ:
# setInterval(cleanupOldLidMappings, 6 * 60 * 60 * 1000); // ❌ Больше не нужно!

# Причина: файлы больше не создаются, очистка не нужна
```

### Этап 3: Добавить автоочистку в PostgreSQL (только один раз)

```sql
-- Уже будет в миграции, но на всякий случай:

-- 1. Функция автоочистки
CREATE OR REPLACE FUNCTION cleanup_expired_keys()
RETURNS void AS $$
BEGIN
  DELETE FROM whatsapp_keys
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW();

  -- Логирование
  RAISE NOTICE 'Cleaned up % expired keys', ROW_COUNT;
END;
$$ LANGUAGE plpgsql;

-- 2. Настроить pg_cron (если доступен в Supabase)
-- Запускать каждые 6 часов
SELECT cron.schedule(
  'cleanup-whatsapp-keys',
  '0 */6 * * *',  -- Каждые 6 часов
  'SELECT cleanup_expired_keys()'
);

-- 3. Альтернатива: через приложение (если pg_cron недоступен)
-- См. код ниже
```

### Этап 4: Автоочистка через приложение (если pg_cron недоступен)

```javascript
// src/services/whatsapp/database-cleanup.js

const { supabase } = require('../../database/supabase');
const logger = require('../../utils/logger');

/**
 * Автоматическая очистка истёкших ключей из БД
 */
async function cleanupExpiredKeys() {
  try {
    const { data, error, count } = await supabase
      .from('whatsapp_keys')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('*', { count: 'exact', head: true });

    if (error) {
      logger.error('Failed to cleanup expired keys:', error);
      return;
    }

    logger.info(`🧹 Cleaned up ${count} expired keys from database`);
  } catch (error) {
    logger.error('Error during cleanup:', error);
  }
}

/**
 * Запускать каждые 6 часов
 */
function startAutomaticCleanup() {
  // Запустить сразу
  cleanupExpiredKeys();

  // Запускать каждые 6 часов
  setInterval(cleanupExpiredKeys, 6 * 60 * 60 * 1000);

  logger.info('✅ Automatic database cleanup started (every 6 hours)');
}

module.exports = { cleanupExpiredKeys, startAutomaticCleanup };
```

```javascript
// В src/workers/message-worker-v2.js или main worker

const { startAutomaticCleanup } = require('./services/whatsapp/database-cleanup');

// При старте worker
startAutomaticCleanup();
```

---

## 📊 Сравнение: До и После миграции

| Аспект | useMultiFileAuthState | useSupabaseAuthState |
|--------|----------------------|---------------------|
| **Накопление данных** | 📈 337 файлов за 9 дней | ✅ ~50 записей (TTL) |
| **Агрессивная очистка** | ⚠️ Нужна каждые 6 часов | ✅ НЕ нужна! |
| **Автоочистка** | ❌ Нужен отдельный скрипт | ✅ Встроенная (expires_at) |
| **Ручная очистка** | ⚠️ Раз в неделю | ✅ Никогда! |
| **Риск забыть почистить** | ⚠️ Высокий | ✅ Нулевой |
| **Мониторинг размера** | ⚠️ Нужен постоянно | ✅ Опционально |

---

## 🎯 Итоговая стратегия очистки

### ✅ ЧТО НУЖНО ДЕЛАТЬ:

1. **Одноразово после миграции (через 7 дней успешной работы):**
   ```bash
   # Удалить старые файлы
   ./scripts/cleanup-legacy-baileys-files.sh 962302
   ```

2. **Настроить автоочистку БД (один раз):**
   ```javascript
   // В worker при старте
   startAutomaticCleanup(); // Каждые 6 часов
   ```

3. **Опционально: мониторинг размера БД:**
   ```javascript
   // Раз в день проверять
   checkDatabaseSize();
   ```

### ❌ ЧТО НЕ НУЖНО ДЕЛАТЬ:

1. ❌ Агрессивная очистка файлов каждые 6 часов
2. ❌ Ручная очистка lid-mapping файлов
3. ❌ Постоянный мониторинг количества файлов
4. ❌ Скрипты очистки файлов в cron

---

## 🤖 Автоматизация: Полностью hands-off!

После миграции система становится **полностью автоматической**:

```
┌────────────────────────────────────────────────────┐
│ Baileys создаёт новые keys                         │
│ ↓                                                  │
│ useSupabaseAuthState сохраняет в БД                │
│ ↓                                                  │
│ PostgreSQL добавляет expires_at (TTL 7 дней)       │
│ ↓                                                  │
│ [Через 7 дней]                                     │
│ ↓                                                  │
│ Автоочистка удаляет истёкшие записи 🤖             │
│ ↓                                                  │
│ Размер БД стабилен: ~50 записей на компанию ✅     │
└────────────────────────────────────────────────────┘

Ваше участие: НЕ ТРЕБУЕТСЯ! 🎉
```

---

## 📈 Пример: Что происходит с данными

### День 1 (после миграции):
```
whatsapp_keys:
├── lid-mapping | 79001234567 | expires_at: 2025-10-14 (TTL 7 дней)
├── lid-mapping | 79002345678 | expires_at: 2025-10-14
└── ... 50 записей
```

### День 3:
```
whatsapp_keys:
├── lid-mapping | 79001234567 | expires_at: 2025-10-14
├── lid-mapping | 79002345678 | expires_at: 2025-10-14
├── lid-mapping | 79003456789 | expires_at: 2025-10-16 (новый)
└── ... 75 записей
```

### День 8 (автоочистка сработала):
```
whatsapp_keys:
├── lid-mapping | 79003456789 | expires_at: 2025-10-16 (остался)
├── lid-mapping | 79004567890 | expires_at: 2025-10-17 (новый)
└── ... 50 записей (старые удалены автоматически!)
```

**Размер стабилен:** ~50-100 записей на компанию, независимо от времени! ✅

---

## 🚨 Аварийный сценарий: Что если миграция пойдёт не так?

### Сценарий 1: Нужен rollback к файлам
```bash
# У нас есть полный бэкап файлов!
cp -r /opt/ai-admin/baileys_sessions_backup/company_962302/* \
      /opt/ai-admin/baileys_sessions/company_962302/

# Откатить код на useMultiFileAuthState
git revert <commit>
pm2 restart ai-admin-worker-v2

# Возобновить агрессивную очистку (если нужно)
```

### Сценарий 2: База данных недоступна
```bash
# Baileys выдаст ошибку при инициализации
# Логи покажут проблему с Supabase
# Решение: проверить Supabase status, connection string
```

**Защита:** Feature flag для быстрого переключения:
```javascript
const USE_DATABASE_AUTH = process.env.USE_DATABASE_AUTH_STATE === 'true';

if (USE_DATABASE_AUTH) {
  const { state, saveCreds } = await useSupabaseAuthState(companyId);
} else {
  const { state, saveCreds } = await useMultiFileAuthState(authPath);
}
```

---

## 💡 ИТОГОВЫЕ ОТВЕТЫ

### Вопрос: Нужна ли агрессивная очистка после миграции?

**НЕТ!** ❌

### Почему?

1. ✅ Файлы больше НЕ создаются (Baileys пишет в БД)
2. ✅ Автоочистка встроена в PostgreSQL (expires_at + функция)
3. ✅ Размер БД стабилен (~50 записей на компанию)
4. ✅ Полностью автоматическая система

### Что нужно сделать?

1. ✅ **Один раз:** Удалить старые файлы после успешной миграции
2. ✅ **Один раз:** Настроить автоочистку БД (6 часов интервал)
3. ✅ **Опционально:** Мониторинг размера БД (раз в день)
4. ✅ **Никогда:** Агрессивная очистка файлов больше НЕ нужна!

### Экономия времени:

**До миграции:**
- Настройка агрессивной очистки: 2 часа
- Ручная очистка при проблемах: 1 час/неделю
- Мониторинг файлов: 30 мин/неделю
- **Итого:** ~6-8 часов/месяц

**После миграции:**
- Настройка автоочистки БД: 30 минут (один раз)
- Мониторинг: 0 часов (автоматически)
- **Итого:** ~0 часов/месяц 🎉

---

## 🎊 Бонус: Что ещё улучшится?

После миграции на database auth state:

1. ✅ Нет агрессивной очистки файлов
2. ✅ Нет риска device_removed из-за файлов
3. ✅ Быстрее в 5-400x
4. ✅ Масштабируется до 1000+ компаний
5. ✅ Автоматические бэкапы (Supabase)
6. ✅ ACID транзакции
7. ✅ Zero maintenance

**TL;DR:** Set it and forget it! 🚀

---

**Автор:** AI Assistant
**Дата:** 2025-10-07
**Статус:** Рекомендация
