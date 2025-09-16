# 📱 WhatsApp Onboarding Guide для AI Admin

## 🎯 Быстрый старт для новой компании

### Шаг 1: Подготовка компании
```bash
# Замените COMPANY_ID на реальный ID компании (например, 962302)
export COMPANY_ID=YOUR_COMPANY_ID
```

### Шаг 2: Подключение WhatsApp

#### Вариант А: Через веб-интерфейс (рекомендуется)
1. Откройте в браузере:
   ```
   http://46.149.70.219:3000/whatsapp-connect.html?company=YOUR_COMPANY_ID
   ```
2. Отсканируйте QR-код через WhatsApp:
   - Откройте WhatsApp на телефоне
   - Настройки → Связанные устройства → Привязать устройство
   - Отсканируйте QR-код
3. Дождитесь сообщения "✅ Successfully Connected!"

#### Вариант Б: Через консольный скрипт
```bash
ssh root@46.149.70.219
cd /opt/ai-admin
./scripts/connect-whatsapp.sh YOUR_COMPANY_ID
```

### Шаг 3: Проверка подключения
```bash
# Проверить статус
curl http://46.149.70.219:3000/webhook/whatsapp/baileys/status/YOUR_COMPANY_ID

# Отправить тестовое сообщение
curl -X POST http://46.149.70.219:3000/webhook/whatsapp/baileys/send \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "YOUR_COMPANY_ID",
    "phone": "79001234567",
    "message": "Тест подключения WhatsApp"
  }'
```

## 🔧 Управление сессиями

### Переподключение существующей сессии
```bash
# Если сессия отключилась, но ранее была подключена
curl -X POST http://46.149.70.219:3000/webhook/whatsapp/baileys/reconnect/YOUR_COMPANY_ID
```

### Полная переинициализация
```bash
# Удалить старую сессию и начать заново
ssh root@46.149.70.219 "rm -rf /opt/ai-admin/sessions/company_YOUR_COMPANY_ID"
# Затем повторить Шаг 2
```

## 📊 Мониторинг

### Проверка здоровья сессии
```bash
curl http://46.149.70.219:3000/webhook/whatsapp/baileys/health/YOUR_COMPANY_ID
```

### Просмотр метрик
```bash
curl http://46.149.70.219:3000/webhook/whatsapp/baileys/metrics
```

## 🚨 Решение проблем

### Проблема: QR-код не появляется
1. Перезапустите API:
   ```bash
   ssh root@46.149.70.219 "pm2 restart ai-admin-api"
   ```
2. Очистите старую сессию и попробуйте снова

### Проблема: Сессия отключается через несколько секунд
1. Убедитесь, что нет других процессов, использующих ту же сессию
2. Проверьте логи:
   ```bash
   ssh root@46.149.70.219 "pm2 logs ai-admin-api --lines 100 | grep YOUR_COMPANY_ID"
   ```

### Проблема: Сообщения не отправляются
1. Проверьте статус подключения (должен быть connected: true)
2. Убедитесь, что номер телефона в формате 79XXXXXXXXX (без + и пробелов)

## 🔐 Безопасность

- Каждая компания имеет изолированную сессию
- Сессии хранятся в `/opt/ai-admin/sessions/company_XXXXXX`
- Автоматическое переподключение при сбоях
- Keep-alive механизм для стабильности соединения

## 🛠 API Endpoints

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/webhook/whatsapp/baileys/qr/{companyId}` | GET | Получить QR-код |
| `/webhook/whatsapp/baileys/status/{companyId}` | GET | Статус подключения |
| `/webhook/whatsapp/baileys/send` | POST | Отправить сообщение |
| `/webhook/whatsapp/baileys/reconnect/{companyId}` | POST | Переподключить |
| `/webhook/whatsapp/baileys/health/{companyId}` | GET | Проверка здоровья |

## 📝 Чеклист для onboarding

- [ ] Получить Company ID от клиента
- [ ] Добавить компанию в базу данных (если еще нет)
- [ ] Отправить клиенту ссылку на QR-страницу
- [ ] Убедиться, что клиент отсканировал QR-код
- [ ] Проверить статус подключения
- [ ] Отправить тестовое сообщение
- [ ] Настроить webhook для входящих сообщений
- [ ] Проверить работу бота с реальным сценарием

## 🔄 Автоматизация

Для массового подключения компаний используйте:
```bash
./scripts/bulk-whatsapp-onboard.sh companies.txt
```

Где `companies.txt` содержит ID компаний по одному на строку.