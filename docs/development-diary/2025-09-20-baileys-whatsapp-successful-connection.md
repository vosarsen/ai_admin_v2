# Baileys WhatsApp - Успешное подключение и решение проблем

**Дата**: 20 сентября 2025
**Автор**: AI Admin Team
**Статус**: ✅ Успешно подключено к production

## 📋 Контекст

Необходимо было настроить подключение WhatsApp через Baileys библиотеку для компании 962302 (KULLTURA Малаховка). Основные проблемы:
1. QR код не отображался полностью в логах
2. Сессия сразу логаутилась после создания
3. Множество дублирующихся процессов

## 🎯 Цель

Установить стабильное подключение WhatsApp к боту AI Admin через Baileys v7.0.0 на production сервере.

## ✅ Решение

### 1. Архитектурные изменения

#### Упрощение до одного менеджера сессий
- **Удалён**: `baileys-manager.js` (архивирован в `archive/old-whatsapp/`)
- **Оставлен**: `session-pool.js` - единственный менеджер с поддержкой:
  - Circuit breaker pattern
  - Health checks
  - Метрики производительности
  - Mutex защита от гонки

#### Обновление для Baileys v7.0.0
```javascript
// Убрали несуществующие в v7 импорты
const {
    makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
    // proto - убран
    // makeInMemoryStore - не существует в v7
} = require('@whiskeysockets/baileys');

// Упрощена функция getMessage
getMessage: async () => undefined
```

### 2. Решение проблемы с QR кодом

#### Добавлен полный вывод QR в ASCII
```javascript
const qrcodeTerminal = require('qrcode-terminal');

pool.on('qr', async ({ companyId: cId, qr }) => {
    // Сохранение полного QR в файл
    const qrPath = path.join(process.cwd(), `qr_${companyId}.txt`);
    await fs.writeFile(qrPath, qr, 'utf8');

    // Отображение QR в терминале в виде ASCII
    qrcodeTerminal.generate(qr, { small: true });
});
```

### 3. Решение проблемы с быстрым logout

#### Причина
- Множественные процессы пытались использовать одну сессию
- Конфликт сессий между локальными тестами и production

#### Решение
```bash
# 1. Найти все процессы
ps aux | grep -E '(baileys|962302)'

# 2. Убить дублирующиеся процессы
kill <PID1> <PID2> ...

# 3. Очистить старые сессии
rm -rf baileys_sessions/company_962302

# 4. Перезапустить чисто
pm2 restart baileys-whatsapp
```

### 4. Финальная конфигурация

#### ecosystem.baileys.config.js
```javascript
{
    name: 'baileys-whatsapp',
    script: 'scripts/baileys-service.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
        NODE_ENV: 'production',
        COMPANY_ID: '962302'
    }
}
```

#### scripts/baileys-service.js
- Автоматическая генерация QR при старте
- Health checks каждые 60 секунд
- Автоматическое переподключение при разрыве
- Forwarding сообщений на webhook для обработки

## 📊 Результаты

### Успешное подключение
```
✅ WHATSAPP CONNECTED SUCCESSFULLY!
Phone: 79936363848:37
Name: KULLTURA Малаховка
Ready to send and receive messages
```

### Метрики
- Время подключения: ~2 секунды после сканирования QR
- Стабильность: Сессия остаётся активной
- Restart count: 0 (после исправлений)

## 🔧 Технические детали

### Версии
- Baileys: 7.0.0-rc.3
- Node.js: 20.19.5
- PM2: последняя версия

### Структура файлов
```
src/integrations/whatsapp/
├── session-pool.js          # Основной менеджер сессий
└── whatsapp-manager-unified.js  # Унифицированный менеджер

scripts/
├── baileys-service.js       # PM2 сервис для Baileys
└── ...

archive/old-whatsapp/
└── baileys-manager-archived-20250920.js  # Архивированный старый менеджер
```

### Команды для управления

#### Просмотр логов
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs baileys-whatsapp --lines 50"
```

#### Перезапуск
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 restart baileys-whatsapp"
```

#### Получение QR кода
```bash
# Вариант 1: Из логов с ASCII отображением
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs baileys-whatsapp --lines 40"

# Вариант 2: Из файла (полная строка)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cat /opt/ai-admin/qr_962302.txt"
```

## 📝 Важные уроки

1. **Всегда проверяйте дублирующиеся процессы** - они могут конфликтовать за сессию
2. **QR коды имеют ограниченное время жизни** - около 60 секунд
3. **Baileys v7 отличается от v6** - нет Store, упрощённый getMessage
4. **Используйте circuit breaker** - защита от слишком частых переподключений
5. **Логи PM2 обрезают длинные строки** - сохраняйте QR в файл

## 🚀 Следующие шаги

1. ✅ Создать веб-интерфейс для управления подключением
2. ✅ Добавить поддержку pairing code (альтернатива QR)
3. ⏳ Реализовать backup/restore сессий
4. ⏳ Добавить поддержку медиа-сообщений
5. ⏳ Создать мониторинг dashboard

## 📚 Ссылки

- [Официальный репозиторий Baileys](https://github.com/WhiskeySockets/Baileys)
- [Документация Baileys](https://baileys.wiki)
- [PM2 документация](https://pm2.keymetrics.io/)

---

*Документация создана после успешного подключения WhatsApp к production боту AI Admin*