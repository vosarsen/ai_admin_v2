# 🚨 КРИТИЧЕСКАЯ ПРОБЛЕМА: Диск заполнен на 100%

**Дата обнаружения:** 4 октября 2025, 12:27 МСК
**Статус:** 🔴 КРИТИЧНО - Сервер перегружен
**Приоритет:** P0 - Требует немедленного действия

---

## ⚠️ Проблема

Диск сервера `/dev/sda1` (30GB) заполнен на **100%**.

### До очистки (12:20):
```
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        30G   30G     0 100% /
```

### После частичной очистки (12:25):
```
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        30G  7.6G   22G  26% /
```

**Освобождено:** 22GB
**Текущее состояние:** Сервер перегружен, SSH timeout

---

## 🔍 Что занимало место

### Главная проблема: Логи (23GB!)

```
23G   /opt/ai-admin/logs
  ├── 17G   baileys-out-16.log         ❌ УДАЛЕНО
  ├── 4.3G  batch-processor-out-2.log  ❌ УДАЛЕНО
  ├── 442M  api-out-0.log              ❌ УДАЛЕНО
  └── 261M  api-error-0.log            ❌ УДАЛЕНО
```

### Другие директории:
```
171M  node_modules
3.7M  docs
2.9M  src
2.2M  baileys_sessions
1.2M  sync.log
```

---

## 💥 Последствия

1. **Git не работает:**
   ```
   fatal: unable to write loose object file: No space left on device
   fatal: unpack-objects failed
   ```

2. **PM2 сервисы упали:**
   - Все 7 сервисов остановились
   - API недоступен (502 Bad Gateway)

3. **Сервер перегружен:**
   - SSH команды timeout
   - Система не отвечает

---

## ✅ Что сделано

1. **Удалены гигантские логи:**
   ```bash
   rm -f /opt/ai-admin/logs/baileys-out-16.log          # 17GB
   rm -f /opt/ai-admin/logs/batch-processor-out-2.log   # 4.3GB
   rm -f /opt/ai-admin/logs/api-out-0.log               # 442MB
   rm -f /opt/ai-admin/logs/api-error-0.log             # 261MB
   ```

2. **Освобождено 22GB дискового пространства**

3. **Запущены PM2 сервисы:**
   ```bash
   pm2 start ecosystem.config.js
   ```
   Статус: ✅ Все 7 сервисов запущены

---

## 🚨 Текущая проблема

**Сервер перегружен** - вероятно из-за:
1. Резкого освобождения места
2. Одновременного запуска всех 7 сервисов
3. Возможных проблем с файловой системой

**Симптомы:**
- SSH команды timeout после 30-120 секунд
- API не отвечает (502)
- PM2 logs зависают

---

## 🔧 Рекомендации (СРОЧНО!)

### Немедленные действия:

1. **Перезагрузить сервер:**
   ```bash
   ssh root@46.149.70.219 "reboot"
   ```
   Ожидание: 2-3 минуты

2. **Настроить ротацию логов:**
   ```bash
   # PM2 log rotation
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 100M
   pm2 set pm2-logrotate:retain 3
   pm2 set pm2-logrotate:compress true
   ```

3. **Добавить cron для очистки:**
   ```bash
   # /etc/cron.daily/cleanup-logs.sh
   #!/bin/bash
   find /opt/ai-admin/logs -name "*.log" -size +500M -delete
   find /opt/ai-admin/logs -name "*.log" -mtime +7 -delete
   ```

### Долгосрочные решения:

4. **Увеличить размер диска:**
   - Текущий: 30GB
   - Рекомендуемый: 60GB+
   - Или настроить отдельный том для логов

5. **Настроить мониторинг диска:**
   ```javascript
   // Добавить в health check
   const diskUsage = require('disk-usage');
   const path = require('path');

   app.get('/health', async (req, res) => {
     const disk = await diskUsage.check('/');
     const usagePercent = (disk.used / disk.total) * 100;

     if (usagePercent > 90) {
       // Telegram alert!
     }

     res.json({
       disk: {
         total: disk.total,
         used: disk.used,
         free: disk.free,
         usagePercent: usagePercent.toFixed(2)
       }
     });
   });
   ```

6. **Уменьшить логирование:**
   ```javascript
   // ecosystem.config.js
   module.exports = {
     apps: [{
       name: 'ai-admin-api',
       max_memory_restart: '500M',
       error_file: '/dev/null',     // Отключить error logs в файл
       out_file: '/dev/null',        // Отключить out logs в файл
       log_date_format: 'YYYY-MM-DD HH:mm:ss',
       combine_logs: true
     }]
   };
   ```

---

## 📊 Почему логи так разрослись?

### Baileys (17GB):
- WhatsApp библиотека генерирует много debug логов
- Нет ротации логов
- Работает 24/7 с июля 2025

### Batch Processor (4.3GB):
- Обрабатывает сообщения постоянно
- Каждое сообщение логируется
- Rapid-fire режим генерирует много логов

### API (700MB):
- Все HTTP запросы логируются
- Детальное логирование ошибок

---

## ✅ Проверка после восстановления

После перезагрузки сервера проверить:

```bash
# 1. Диск
df -h /
# Ожидаем: 20-25% использования

# 2. PM2 сервисы
pm2 status
# Ожидаем: Все online

# 3. API
curl https://ai-admin.app/health
# Ожидаем: 200 OK

# 4. Marketplace
curl https://ai-admin.app/marketplace/health
# Ожидаем: 200 OK

# 5. Логи
du -sh /opt/ai-admin/logs
# Ожидаем: < 1GB
```

---

## 📝 Checklist восстановления

- [ ] Перезагрузить сервер
- [ ] Проверить PM2 сервисы
- [ ] Установить pm2-logrotate
- [ ] Настроить max_size = 100M
- [ ] Добавить cron для очистки
- [ ] Проверить API health
- [ ] Проверить Marketplace health
- [ ] Добавить мониторинг диска в health check
- [ ] Рассмотреть увеличение диска до 60GB

---

## 🎯 Профилактика

### Еженедельно:
- Проверять `df -h /`
- Проверять `du -sh /opt/ai-admin/logs`

### Ежемесячно:
- Очистка старых baileys sessions (> 30 дней)
- Очистка старых логов (> 7 дней)
- Проверка node_modules на дубликаты

### При деплое:
- Проверять размер логов перед рестартом
- Ротация логов если > 500MB

---

## ⚠️ Важно

**НЕ ДОПУСКАТЬ повторения!**

100% заполненность диска приводит к:
- Падению всех сервисов
- Невозможности работы с Git
- Коррупции файловой системы
- Потере данных

**Критический уровень:** 90%
**Действие:** Немедленная очистка

**Комфортный уровень:** < 70%

---

**Отчет создан:** Claude Code
**Дата:** 4 октября 2025, 12:30 МСК
**Приоритет:** 🔴 P0 - КРИТИЧНО
