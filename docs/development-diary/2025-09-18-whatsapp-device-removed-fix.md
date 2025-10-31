# WhatsApp Device Removed Issue - Root Cause Analysis and Prevention

**Date**: September 18, 2025
**Author**: Development Team
**Issue**: WhatsApp автоматически отключил устройство (device_removed)
**Impact**: Полная потеря связи с WhatsApp, бот не отвечал на сообщения
**Resolution Time**: 2 часа

## 🔍 Хронология событий

### Timeline
- **11:26-12:05 МСК** - WhatsApp работал нормально, отправлено множество сообщений
- **15:05:17 МСК** - WhatsApp получил событие `device_removed` и отключился
- **15:05-17:30 МСК** - Система пыталась переподключиться, но безуспешно
- **17:30 МСК** - Начата диагностика проблемы
- **17:41 МСК** - WhatsApp успешно переподключен после сканирования QR кода

## 🔴 Проблема

### Что произошло
WhatsApp автоматически отозвал авторизацию устройства с ошибкой:
```json
{
  "tag": "stream:error",
  "attrs": {"code": "401"},
  "content": [{"tag": "conflict", "attrs": {"type": "device_removed"}}]
}
```

### Симптомы
1. Бот перестал отвечать на сообщения
2. В логах постоянные ошибки "Connection Closed"
3. Невозможность отправить сообщения с ошибкой 500
4. Автоматическое переподключение не работало

## 🔎 Анализ корневых причин

### 1. Накопление старых сессий шифрования
```
Closing stale open session for new outgoing prekey bundle
Closing stale open session for new outgoing prekey bundle
... (повторяется сотни раз)
```

**Причина**: Библиотека Baileys не очищала старые ключи шифрования при переподключениях.

### 2. Частые переподключения
- **259 переподключений** за 8 дней (с 10 по 18 сентября)
- Каждое переподключение создавало новые ключи
- Старые ключи не удалялись

### 3. Отсутствие мониторинга
- Не было системы раннего обнаружения проблем с ключами
- Не было автоматической очистки
- Не было уведомлений о проблемах

### 4. WhatsApp Security
WhatsApp обнаружил аномалию в управлении ключами шифрования и автоматически отозвал авторизацию устройства как меру безопасности.

## ✅ Решение

### Immediate Fix (Немедленное исправление)
1. Полная очистка данных авторизации:
```bash
rm -rf /opt/ai-admin/baileys_sessions/company_962302/*
```

2. Добавление метода `getQRCode` в session pool для получения QR кода

3. Перезапуск API и инициализация новой сессии

4. Сканирование нового QR кода

### Long-term Prevention (Долгосрочная профилактика)

#### 1. Автоматическая очистка при переподключении
```javascript
// src/integrations/whatsapp/session-pool-improved.js
if (existingSession) {
    // ... logout logic ...

    // Force cleanup auth directory to prevent stale sessions
    const authPath = this.authPaths.get(validatedId);
    if (authPath) {
        try {
            await fs.remove(authPath);
            logger.info(`🧹 Cleaned up auth directory for ${validatedId}`);
        } catch (cleanupErr) {
            logger.warn(`Failed to cleanup auth directory: ${cleanupErr.message}`);
        }
    }
}
```

#### 2. Мониторинг здоровья сессий
```javascript
async monitorSessionHealth(companyId) {
    const authPath = this.authPaths.get(companyId);
    if (!authPath) return;

    try {
        const files = await fs.readdir(authPath);
        const totalSize = files.length;

        // If too many files (indicating key accumulation), force cleanup
        if (totalSize > 100) {
            logger.warn(`⚠️ Session for ${companyId} has ${totalSize} files - forcing cleanup`);
            await this.removeSession(companyId);
            await this.createSession(companyId);
        }
    } catch (err) {
        logger.debug(`Health check failed for ${companyId}: ${err.message}`);
    }
}
```

#### 3. Скрипт автовосстановления
Создан `scripts/whatsapp-auto-recovery.js`:
- Проверяет статус соединения каждую минуту
- Автоматически восстанавливает при отключении
- Очищает накопившиеся ключи
- Отправляет уведомления в Telegram

## 📊 Результаты

### До исправления
- Риск внезапного отключения в любой момент
- Ручное восстановление требовало технических знаний
- Простой системы до обнаружения проблемы
- Накопление мусора в файловой системе

### После исправления
- ✅ Автоматическая очистка старых сессий
- ✅ Мониторинг здоровья каждые 30 секунд
- ✅ Автоматическое восстановление при сбоях
- ✅ Уведомления о проблемах
- ✅ Предотвращение накопления ключей

## 🚀 Развертывание

### Файлы изменены
1. `src/integrations/whatsapp/session-pool-improved.js` - добавлен мониторинг и очистка
2. `src/api/webhooks/whatsapp-baileys.js` - улучшено логирование
3. `scripts/whatsapp-auto-recovery.js` - новый скрипт автовосстановления

### Команды для активации мониторинга
```bash
# Запуск мониторинга как службы PM2
pm2 start scripts/whatsapp-auto-recovery.js --name whatsapp-monitor

# Сохранение конфигурации PM2
pm2 save
pm2 startup
```

### Переменные окружения (опционально)
```env
# Для Telegram уведомлений
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

## 📈 Метрики и мониторинг

### Ключевые метрики для отслеживания
1. **Количество файлов в auth директории** - должно быть < 100
2. **Частота переподключений** - не более 10 в день
3. **Uptime сессии** - стремиться к 99.9%
4. **Время восстановления** - < 5 минут

### Проверка статуса
```bash
# Проверить статус WhatsApp
curl http://localhost:3000/webhook/whatsapp/baileys/status/962302

# Проверить количество файлов в auth
ls -la /opt/ai-admin/baileys_sessions/company_962302 | wc -l

# Проверить логи на ошибки
pm2 logs ai-admin-api --err --lines 50
```

## 🎯 Выводы и уроки

### Что мы узнали
1. **WhatsApp Security строгий** - любые аномалии приводят к отключению
2. **Baileys требует активного управления** - библиотека не идеальна в управлении ключами
3. **Мониторинг критичен** - проблемы нужно обнаруживать рано
4. **Автоматизация спасает** - ручное восстановление занимает время

### Best Practices на будущее
1. **Всегда очищать старые сессии** при переподключении
2. **Мониторить файловую систему** на накопление мусора
3. **Иметь автоматическое восстановление** для критичных сервисов
4. **Настроить уведомления** о проблемах
5. **Документировать все инциденты** для обучения

### Предотвращение похожих проблем
- Регулярный аудит всех внешних интеграций
- Проактивный мониторинг здоровья системы
- Автоматическая очистка временных данных
- Резервные каналы связи при сбоях

## 📝 Checklist для будущих инцидентов с WhatsApp

- [ ] Проверить статус соединения через API
- [ ] Проверить количество файлов в auth директории
- [ ] Проверить логи на "stale session" ошибки
- [ ] Очистить auth директорию если нужно
- [ ] Перезапустить API
- [ ] Инициализировать новую сессию
- [ ] Сканировать QR код
- [ ] Проверить что бот отвечает
- [ ] Запустить мониторинг если не запущен

## 🔗 Связанные документы

- [WhatsApp Session Architecture](../technical/WHATSAPP_SESSION_ARCHITECTURE.md)
- [WhatsApp Session Pool](../technical/WHATSAPP_SESSION_POOL.md)
- [Troubleshooting Guide](../TROUBLESHOOTING.md)
- [Emergency Recovery Procedures](../guides/emergency-recovery.md)

---

**Статус**: ✅ Проблема решена и предотвращена на будущее
**Последнее обновление**: 18 сентября 2025, 17:45 МСК