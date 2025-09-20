# WhatsApp Reconnection Guide

## 📋 Проблемы решены

### ✅ Архитектурные конфликты
- **Проблема**: 3 независимые реализации (session-pool, baileys-provider, pairing-code-manager)
- **Решение**: Интегрирована поддержка pairing code прямо в session-pool.js

### ✅ Поддержка Pairing Code
- **Проблема**: USE_PAIRING_CODE не был настроен
- **Решение**: Добавлена переменная окружения и логика в session-pool

### ✅ Безопасный мониторинг
- **Проблема**: whatsapp-monitor удалял все файлы через rm -rf
- **Решение**: Создан whatsapp-safe-monitor.js без деструктивных операций

### ✅ Система бэкапов
- **Проблема**: Риск потери creds.json
- **Решение**: Используется существующая система whatsapp-backup-manager.js

## 🚀 Инструкция по деплою и переподключению

### Шаг 1: Деплой изменений

```bash
# На локальной машине
git push origin feature/redis-context-cache

# На сервере
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin
git pull origin feature/redis-context-cache
```

### Шаг 2: Настройка окружения

```bash
# Добавить в /opt/ai-admin/.env
echo "USE_PAIRING_CODE=true" >> .env
echo "WHATSAPP_PHONE_NUMBER=79686484488" >> .env
echo "WHATSAPP_MAX_QR_ATTEMPTS=3" >> .env
echo "WHATSAPP_MONITOR_ENABLED=false" >> .env
```

### Шаг 3: Бэкап текущих данных (если есть)

```bash
# Создать бэкап существующих auth файлов
node scripts/whatsapp-backup-manager.js backup 962302
```

### Шаг 4: Перезапуск API

```bash
pm2 restart ai-admin-api
```

### Шаг 5: Подключение WhatsApp

#### Вариант A: Через Pairing Code (рекомендуется)

```bash
# Запросить pairing code через API
curl -X POST http://localhost:3000/api/whatsapp/sessions/962302/pairing-code \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "79686484488"}'
```

Или использовать веб-интерфейс:
```
http://46.149.70.219:3000/whatsapp-pairing.html
```

**На телефоне:**
1. Откройте WhatsApp
2. Настройки → Связанные устройства
3. Привязать устройство
4. Привязать с помощью номера телефона
5. Введите полученный код

#### Вариант B: Через QR код (если pairing не работает)

```bash
# Отключить pairing code временно
export USE_PAIRING_CODE=false

# Открыть в браузере
http://46.149.70.219:3000/whatsapp-qr.html?company=962302
```

### Шаг 6: Проверка подключения

```bash
# Проверить статус
curl http://localhost:3000/webhook/whatsapp/baileys/status/962302

# Проверить логи
pm2 logs ai-admin-api --lines 50
```

### Шаг 7: Запуск безопасного мониторинга (опционально)

```bash
# НЕ запускать старый whatsapp-monitor!
# Использовать новый безопасный мониторинг
pm2 start scripts/whatsapp-safe-monitor.js --name whatsapp-safe-monitor

# Сохранить конфигурацию
pm2 save
```

## ⚠️ Важные моменты

### НЕ ДЕЛАТЬ:
- ❌ НЕ запускать `scripts/whatsapp-auto-recovery.js` - он удаляет файлы
- ❌ НЕ использовать `pm2 start whatsapp-monitor` - старый опасный скрипт
- ❌ НЕ удалять creds.json вручную

### ДЕЛАТЬ:
- ✅ Использовать pairing code для подключения
- ✅ Регулярно делать бэкапы через backup-manager
- ✅ Использовать safe-monitor для мониторинга
- ✅ При проблемах сначала пробовать reconnect, а не cleanup

## 🔍 Диагностика проблем

### "Connection Closed"
```bash
# Проверить количество файлов
ls -la /opt/ai-admin/baileys_sessions/company_962302 | wc -l

# Если > 150 файлов - запустить умную очистку
node scripts/whatsapp-smart-cleanup.js
```

### "Rate limit reached"
- Подождать 30-60 минут
- Использовать pairing code вместо QR

### "Device logged out"
- Потребуется новое подключение
- Восстановить из бэкапа если возможно:
```bash
node scripts/whatsapp-backup-manager.js restore 962302
```

## 📊 Мониторинг

### Автоматический (безопасный)
```bash
# Статус
pm2 status whatsapp-safe-monitor

# Логи
pm2 logs whatsapp-safe-monitor
```

### Ручной
```bash
# Проверка здоровья
curl http://localhost:3000/api/whatsapp/sessions/962302/health

# Метрики
curl http://localhost:3000/api/whatsapp/metrics
```

## 🎯 Результат

После выполнения всех шагов:
1. WhatsApp будет подключен через pairing code
2. Система будет защищена от случайного удаления данных
3. Мониторинг будет работать без деструктивных операций
4. Бэкапы будут создаваться автоматически

---

**Последнее обновление**: 20 сентября 2025
**Автор**: AI Admin Team