# Настройка Telegram уведомлений для AI Admin

## 📱 Быстрая настройка (5 минут)

### Шаг 1: Создание бота

1. Откройте Telegram и найдите `@BotFather`
2. Отправьте команду `/newbot`
3. Придумайте имя бота (например: `AI Admin Monitor`)
4. Придумайте username бота (например: `ai_admin_monitor_bot`)
5. Сохраните токен: `7234567890:AAFabcDEF_ghiJKLmnop-qrstUVwxyz`

### Шаг 2: Получение Chat ID

1. Найдите своего бота в Telegram по username
2. Отправьте ему любое сообщение
3. Откройте в браузере:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
4. Найдите `"chat":{"id":123456789}` - это ваш Chat ID

### Шаг 3: Настройка переменных окружения

Добавьте в файл `.env`:

```bash
# Telegram notifications
TELEGRAM_BOT_TOKEN=7234567890:AAFabcDEF_ghiJKLmnop-qrstUVwxyz
TELEGRAM_CHAT_ID=123456789
```

### Шаг 4: Тестирование

```bash
# Проверка отправки
node -e "
const notifier = require('./src/services/telegram-notifier');
notifier.send('✅ Telegram уведомления настроены!').then(console.log);
"
```

## 🤖 Автоматические уведомления

### Что отправляется автоматически:

1. **🚨 Критические ошибки**
   - API не отвечает
   - Redis недоступен
   - База данных недоступна

2. **📱 Проблемы с WhatsApp**
   - Отключение сессии
   - Ошибки авторизации
   - Необходимость QR-кода

3. **⚠️ Предупреждения**
   - Высокое потребление памяти (>500MB)
   - Большая очередь сообщений (>10)
   - Долгое отсутствие активности (>2 часа)

4. **✅ Восстановления**
   - Успешное автоматическое восстановление
   - Система вернулась в норму

## ⚙️ Настройка автоматического мониторинга

### Добавление в cron (рекомендуется):

```bash
# Откройте crontab
crontab -e

# Добавьте строку для проверки каждые 5 минут
*/5 * * * * /usr/bin/node /opt/ai-admin/scripts/health-monitor.js >> /opt/ai-admin/logs/health-monitor.log 2>&1

# Ежедневная сводка в 9:00
0 9 * * * /usr/bin/node /opt/ai-admin/scripts/daily-summary.js
```

### Ручной запуск мониторинга:

```bash
# Проверка здоровья с уведомлениями
node scripts/health-monitor.js

# Проверка без уведомлений
./recovery.sh check
```

## 📊 Команды для бота (опционально)

Можно настроить команды для бота через BotFather (`/setcommands`):

```
status - Показать статус системы
health - Проверить здоровье
restart - Перезапустить систему
help - Показать помощь
```

## 🔒 Безопасность

1. **Никогда не коммитьте токен бота** в Git
2. Используйте `.env` файл (он в `.gitignore`)
3. Ограничьте доступ к боту только вашим Chat ID
4. Регулярно меняйте токен при подозрениях

## 🚨 Troubleshooting

### Сообщения не приходят:

1. Проверьте токен и Chat ID:
   ```bash
   echo $TELEGRAM_BOT_TOKEN
   echo $TELEGRAM_CHAT_ID
   ```

2. Проверьте доступность Telegram API:
   ```bash
   curl https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe
   ```

3. Проверьте логи:
   ```bash
   grep -i telegram /opt/ai-admin/logs/*.log
   ```

### Слишком много уведомлений:

Настройте cooldown в `src/services/telegram-notifier.js`:
```javascript
this.notificationCooldown = 300000; // 5 минут вместо 1
```

## 📈 Расширенные возможности

### Отправка статистики:

```javascript
// В любом месте кода
const telegramNotifier = require('./services/telegram-notifier');

// Отправка кастомного уведомления
await telegramNotifier.send(`
📊 <b>Статистика за час</b>
Обработано: 150 сообщений
Создано записей: 12
Ошибок: 0
`);
```

### Групповые уведомления:

Можно создать группу/канал и отправлять туда:
1. Создайте группу/канал
2. Добавьте бота как администратора
3. Используйте ID группы вместо личного Chat ID

---

**Готово!** Теперь вы будете получать уведомления о всех важных событиях в системе.