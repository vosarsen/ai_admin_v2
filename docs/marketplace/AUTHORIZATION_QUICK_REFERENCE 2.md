# 🚀 YClients Marketplace Authorization - Quick Reference

## ✨ Главное за 30 секунд

```javascript
// ВСЁ что нужно для работы с API салона через маркетплейс:
const headers = {
  'Authorization': `Bearer ${PARTNER_TOKEN}`,  // ТОЛЬКО Partner Token!
  'Accept': 'application/vnd.yclients.v2+json'
};

// Примеры запросов - работают после подключения через маркетплейс:
GET  https://api.yclients.com/api/v1/records/{salon_id}     // ✅ Записи
POST https://api.yclients.com/api/v1/records/{salon_id}     // ✅ Создать запись
GET  https://api.yclients.com/api/v1/clients/{salon_id}     // ✅ Клиенты
GET  https://api.yclients.com/api/v1/services/{salon_id}    // ✅ Услуги
GET  https://api.yclients.com/api/v1/staff/{salon_id}       // ✅ Мастера
```

## ❌ НЕ НУЖНО

- ❌ Запрашивать логин/пароль у клиента
- ❌ Получать User Token через /auth
- ❌ Хранить учетные данные пользователей
- ❌ Беспокоиться о смене паролей

## ✅ НУЖНО

1. **Получить salon_id при редиректе из маркетплейса**
   ```
   https://ai-admin.app/marketplace/register?salon_id=962302
   ```

2. **Отправить callback после настройки**
   ```javascript
   POST https://api.yclients.com/marketplace/partner/callback/redirect
   {
     salon_id: 962302,
     application_id: YOUR_APP_ID,
     api_key: "your-internal-key",
     webhook_urls: ["https://ai-admin.app/webhook/yclients/962302"]
   }
   ```

3. **Использовать Partner Token для всех запросов**
   ```javascript
   Authorization: Bearer ${PARTNER_TOKEN}
   ```

## 📋 Полный чеклист подключения

| Шаг | Действие | Статус |
|-----|----------|--------|
| 1 | Клиент нажимает "Подключить" в маркетплейсе | Автоматически |
| 2 | YClients редиректит на наш сайт с salon_id | Получаем salon_id |
| 3 | Показываем QR-код для WhatsApp | Генерируем через Baileys |
| 4 | Клиент сканирует QR-код | Подключаем WhatsApp |
| 5 | Отправляем callback в YClients | Активируем интеграцию |
| 6 | Используем Partner Token + salon_id | Полный доступ к API |

## 🔑 Переменные окружения

```env
# Всё что нужно в .env файле:
YCLIENTS_PARTNER_TOKEN=your_partner_token_here  # Получили при регистрации в маркетплейсе
YCLIENTS_APP_ID=123                             # ID вашего приложения в маркетплейсе
```

## 📡 Примеры кода

### Получить информацию о салоне
```javascript
const getSalonInfo = async (salonId) => {
  const response = await fetch(`https://api.yclients.com/api/v1/company/${salonId}`, {
    headers: {
      'Authorization': `Bearer ${PARTNER_TOKEN}`,
      'Accept': 'application/vnd.yclients.v2+json'
    }
  });
  return response.json();
};
```

### Создать запись клиента
```javascript
const createBooking = async (salonId, bookingData) => {
  const response = await fetch(`https://api.yclients.com/api/v1/records/${salonId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PARTNER_TOKEN}`,
      'Accept': 'application/vnd.yclients.v2+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bookingData)
  });
  return response.json();
};
```

### Активировать интеграцию (callback)
```javascript
const activateIntegration = async (salonId) => {
  const response = await fetch('https://api.yclients.com/marketplace/partner/callback/redirect', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PARTNER_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      salon_id: salonId,
      application_id: YCLIENTS_APP_ID,
      api_key: generateApiKey(),
      webhook_urls: [`https://ai-admin.app/webhook/yclients/${salonId}`]
    })
  });
  return response.ok;
};
```

## ⚡ Частые ошибки и решения

| Ошибка | Причина | Решение |
|--------|---------|---------|
| 401 Unauthorized | Неверный Partner Token | Проверить YCLIENTS_PARTNER_TOKEN в .env |
| 403 Forbidden | Салон не подключил приложение | Проверить, что callback был отправлен |
| 404 Not Found | Неверный salon_id | Использовать salon_id из параметра при редиректе |
| "Требуется User Token" | Используете не тот endpoint | Для маркетплейса все endpoints работают с Partner Token |

## 🎯 TL;DR

**Partner Token + salon_id = Полный доступ к API салона**

Никаких паролей, никаких User Token, никаких сложностей!

---

*Последнее обновление: 02.10.2025*