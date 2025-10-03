# 📋 Чек-лист интеграции с YClients Marketplace

## ✅ Что уже реализовано

### 1. Registration Redirect URL ✅
- Endpoint: `https://ai-admin.app/auth/yclients/redirect`
- Принимает GET параметры: `salon_id`, `user_id`, `user_name`, `user_phone`, `user_email`
- Создает/обновляет компанию в БД
- Генерирует JWT токен для безопасной передачи данных

### 2. Страница онбординга ✅
- URL: `https://ai-admin.app/marketplace/onboarding`
- Показывает QR-код для подключения WhatsApp
- WebSocket соединение для real-time обновлений
- Автоматическая активация после подключения

### 3. Callback URL ✅
- Endpoint: `https://ai-admin.app/callback/yclients`
- Готов принимать webhook события:
  - `uninstall` - удаление интеграции
  - `freeze` - заморозка интеграции
  - `payment` - информация об оплате
  - `record_created/updated/deleted` - события записей

### 4. Активация интеграции ✅
- Endpoint: `https://ai-admin.app/marketplace/activate`
- Контроль 1-часового таймаута
- Вызывается автоматически после подключения WhatsApp

### 5. База данных ✅
- Миграция применена
- Таблицы `companies`, `marketplace_events`, `marketplace_tokens` созданы

### 6. Инфраструктура ✅
- HTTPS/SSL настроен
- Nginx с поддержкой WebSocket
- Node.js зависимости установлены
- Session Pool для Baileys обновлен

### 7. Health-check ✅
- Endpoint: `https://ai-admin.app/marketplace/health-check`
- Показывает статус всех компонентов

## ⚠️ Что нужно уточнить у YClients

### 1. Partner Token 🔴
**Статус:** Ожидаем от YClients после одобрения заявки
**Действие:** Заменить `test_token_waiting_for_real` на реальный токен в `.env`

### 2. API endpoint для активации интеграции 🔴
**Текущий (предполагаемый):** `https://api.yclients.com/api/v1/marketplace/activate`
**Нужно уточнить:**
- Точный URL endpoint
- Метод (POST?)
- Формат запроса
- Обязательные параметры
- Формат ответа

### 3. User ID системного пользователя 🔴
**Описание:** ID пользователя, который будет добавлен в ЛК клиента
**Где указать:** В настройках приложения в маркетплейсе
**Нужно уточнить:** Как получить или создать этого пользователя

### 4. Формат webhook подписи 🟡
**Вопрос:** Поддерживает ли YClients подпись webhook запросов?
**Если да:** Какой алгоритм и где взять секретный ключ?

### 5. Права доступа к API 🟡
**Вопрос:** Какие конкретно права будут у нашей интеграции?
**Нужно:** Список доступных endpoints и операций

## 📝 Вопросы для техподдержки YClients

1. **Какой точный API endpoint для активации интеграции после регистрации пользователя?**
   - URL
   - Метод (POST/PUT?)
   - Заголовки
   - Тело запроса
   - Пример ответа

2. **Как правильно использовать Partner Token?**
   - В каких запросах он нужен?
   - Формат заголовка авторизации?

3. **Что такое User ID системного пользователя и где его взять?**

4. **Есть ли webhook signature для проверки подлинности запросов?**

5. **Какие API endpoints будут доступны после активации интеграции?**

## 🚀 Действия после получения информации

1. Обновить `.env` с реальным Partner Token:
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin
nano .env
# Заменить YCLIENTS_PARTNER_TOKEN=test_token_waiting_for_real
pm2 restart ai-admin-api
```

2. Исправить endpoint активации в `src/api/routes/yclients-marketplace.js`

3. Добавить User ID системного пользователя

4. Протестировать полный flow с реальным салоном

## 📊 Текущая готовность: 85%

### Блокеры:
- Partner Token от YClients
- Точный API endpoint для активации
- User ID системного пользователя

### Готово к работе после получения токенов!

---
*Обновлено: 03.10.2025*