# 🚀 YClients Marketplace → AI Admin: Детальный флоу подключения

## 📋 Обзор процесса

Полный процесс от нажатия кнопки "Подключить" в маркетплейсе YClients до работающего бота в WhatsApp салона.

## 🔄 Детальный флоу подключения

### Шаг 1: Инициация в маркетплейсе YClients
**Где**: Личный кабинет YClients → Маркетплейс → AI Admin

**Действия клиента**:
1. Находит AI Admin в каталоге приложений
2. Читает описание и тарифы
3. Нажимает кнопку **"Подключить"**

**Что происходит технически**:
```http
GET https://ai-admin.ru/marketplace/register?salon_id=123456
```
- YClients добавляет GET параметр `salon_id` 
- Это ID филиала, который подключает интеграцию

### Шаг 2: Переход на нашу страницу регистрации
**Где**: Наш сервер (ai-admin.ru)

**Что видит клиент**:
```html
<!-- Страница регистрации AI Admin -->
<div class="registration-page">
  <h1>Подключение AI Admin к вашему салону</h1>
  <div class="salon-info">
    <h2>Салон: [Название из YClients API]</h2>
    <p>Адрес: [Адрес салона]</p>
  </div>
  
  <div class="steps">
    <div class="step active">1. Подключение WhatsApp</div>
    <div class="step">2. Настройка бота</div>
    <div class="step">3. Готово к работе</div>
  </div>
  
  <div class="whatsapp-section">
    <h3>Подключите WhatsApp вашего салона</h3>
    <div class="qr-code">
      [QR-КОД ДЛЯ WHATSAPP]
    </div>
    <p class="instructions">
      1. Откройте WhatsApp на телефоне<br>
      2. Настройки → Связанные устройства<br>
      3. Отсканируйте QR-код
    </p>
  </div>
</div>
```

**Что происходит на backend**:
```javascript
// 1. Получаем данные салона из YClients
const salonData = await yclientsAPI.get(`/companies/${salon_id}`, {
  headers: { 
    'Authorization': `Bearer ${PARTNER_TOKEN}`
  }
});

// 2. Создаем/обновляем запись в нашей БД
const company = await db.companies.upsert({
  yclients_id: salon_id,
  name: salonData.title,
  phone: salonData.phone,
  status: 'pending_whatsapp'
});

// 3. Генерируем QR для WhatsApp через Baileys
const qrCode = await baileysSession.generateQR(company.id);
```

### Шаг 3: Подключение WhatsApp
**Где**: Страница с QR-кодом

**Действия клиента**:
1. Берет телефон с WhatsApp салона
2. Открывает WhatsApp → Настройки → Связанные устройства
3. Нажимает "Привязать устройство"
4. Сканирует QR-код с экрана

**Real-time обновления через WebSocket**:
```javascript
// WebSocket соединение для обновления статуса
socket.on('whatsapp-status', (data) => {
  switch(data.status) {
    case 'qr-updated':
      // Обновляем QR-код (каждые 20 сек)
      updateQRCode(data.qr);
      break;
      
    case 'connecting':
      showStatus('⏳ Подключение...');
      break;
      
    case 'connected':
      showStatus('✅ WhatsApp подключен!');
      // Сохраняем данные сессии
      saveWhatsAppSession(data.phone, data.session);
      // Переходим к следующему шагу
      proceedToConfiguration();
      break;
  }
});
```

### Шаг 4: Автоматическая настройка
**Где**: Наш backend (происходит автоматически)

**Что происходит**:
```javascript
async function configureBot(companyId) {
  // 1. Синхронизируем данные из YClients
  await syncServices(companyId);    // Загружаем услуги
  await syncStaff(companyId);       // Загружаем мастеров
  await syncSchedule(companyId);    // Загружаем расписание
  
  // 2. Настраиваем базовые сценарии бота
  await setupBotScenarios(companyId, {
    greeting: 'Здравствуйте! Я AI-ассистент салона {name}',
    booking: true,
    reminders: true,
    reviews: true
  });
  
  // 3. Создаем webhook в YClients для получения событий
  const webhookUrl = `https://ai-admin.ru/webhook/yclients/${companyId}`;
  await yclientsAPI.post('/webhooks', {
    salon_id: companyId,
    url: webhookUrl,
    events: ['record_created', 'record_updated', 'record_deleted']
  });
}
```

### Шаг 5: Возврат в YClients с настройками
**Где**: Callback в YClients API

**Что отправляем обратно в YClients**:
```javascript
// POST https://api.yclients.com/marketplace/partner/callback/redirect
const callbackData = {
  salon_id: salon_id,
  application_id: AI_ADMIN_APP_ID, // Наш ID в маркетплейсе
  api_key: company.api_key,        // Сгенерированный API ключ
  webhook_urls: [
    `https://ai-admin.ru/webhook/yclients/${company.id}`,
    `https://ai-admin.ru/webhook/whatsapp/${company.id}`
  ]
};

// Отправляем форму для редиректа
res.send(`
  <form id="callback" method="POST" 
        action="https://api.yclients.com/marketplace/partner/callback/redirect">
    <input type="hidden" name="salon_id" value="${salon_id}">
    <input type="hidden" name="application_id" value="${AI_ADMIN_APP_ID}">
    <input type="hidden" name="api_key" value="${company.api_key}">
    <input type="hidden" name="webhook_urls[]" value="${webhookUrl1}">
    <input type="hidden" name="webhook_urls[]" value="${webhookUrl2}">
  </form>
  <script>
    document.getElementById('callback').submit();
  </script>
`);
```

### Шаг 6: Финализация в YClients
**Где**: Личный кабинет YClients

**Что видит клиент**:
- ✅ "AI Admin успешно подключен"
- Настройки интеграции в разделе "Приложения"
- Возможность управления подпиской

**Что происходит в YClients**:
1. Сохраняет настройки интеграции
2. Активирует приложение для салона
3. Начинает отправлять webhooks на наши URL

### Шаг 7: Первый тест и онбординг
**Где**: WhatsApp салона

**Автоматическое приветственное сообщение**:
```
🎉 Поздравляем! AI Admin успешно подключен!

Я готов помогать вашим клиентам:
✅ Записывать на услуги
✅ Отвечать на вопросы
✅ Напоминать о визитах

Для теста отправьте мне сообщение:
"Хочу записаться на стрижку"

📱 Ваш номер для клиентов: +7 XXX XXX-XX-XX
💡 Инструкция: ai-admin.ru/guide
```

## 🔧 Технические детали интеграции

### Требуемые данные от YClients

1. **При регистрации партнера**:
   - `partner_token` - токен партнера для API
   - `application_id` - ID нашего приложения в маркетплейсе

2. **При подключении салона**:
   - `salon_id` - ID конкретного салона
   - `user_token` - токен пользователя (опционально)

### API endpoints которые мы должны реализовать

```javascript
// 1. Страница регистрации (куда приходит из маркетплейса)
GET /marketplace/register?salon_id={id}

// 2. WebSocket для real-time обновлений QR
WS /socket/whatsapp-qr

// 3. Callback для YClients после успешной настройки
POST /marketplace/callback

// 4. Webhook для событий от YClients
POST /webhook/yclients/{company_id}

// 5. Статус интеграции (для проверки)
GET /api/integration/status/{company_id}
```

### Структура данных в БД

```sql
-- Таблица companies с полями для YClients
ALTER TABLE companies ADD COLUMN IF NOT EXISTS (
  yclients_id INTEGER UNIQUE,
  yclients_api_key VARCHAR(255),
  whatsapp_session TEXT,
  whatsapp_phone VARCHAR(20),
  integration_status VARCHAR(50) DEFAULT 'pending',
  integration_date TIMESTAMP,
  webhook_secret VARCHAR(255)
);
```

## 📊 Статусы процесса подключения

```javascript
const INTEGRATION_STATUSES = {
  'pending': 'Ожидание подключения',
  'whatsapp_qr': 'Отображен QR-код',
  'whatsapp_connecting': 'Подключение WhatsApp',
  'whatsapp_connected': 'WhatsApp подключен',
  'syncing_data': 'Синхронизация данных',
  'configuring': 'Настройка бота',
  'active': 'Активно',
  'error': 'Ошибка',
  'suspended': 'Приостановлено'
};
```

## ⚠️ Обработка ошибок

### Возможные проблемы и решения

1. **QR-код не сканируется**
   - Обновляется каждые 20 секунд
   - Максимум 5 попыток
   - Затем показываем кнопку "Попробовать снова"

2. **Не удается получить данные из YClients**
   - Retry с exponential backoff
   - Сохраняем минимальные данные
   - Предлагаем ввести вручную

3. **WhatsApp отключился после подключения**
   - Автоматическое переподключение
   - Уведомление администратору салона
   - Инструкция по восстановлению

## 🎯 Чек-лист для проверки интеграции

- [ ] YClients передает `salon_id` при редиректе
- [ ] Мы получаем данные салона через API YClients
- [ ] QR-код генерируется и обновляется
- [ ] WhatsApp успешно подключается
- [ ] Данные сессии сохраняются в БД
- [ ] Callback в YClients отправляется корректно
- [ ] YClients активирует интеграцию
- [ ] Webhooks от YClients приходят
- [ ] Бот отвечает на сообщения в WhatsApp
- [ ] Синхронизация данных работает

## 📈 Метрики успеха

| Метрика | Цель | Текущее |
|---------|------|---------|
| Время подключения | < 2 мин | - |
| Успешных подключений | > 90% | - |
| Отвалов на QR-коде | < 10% | - |
| Повторных подключений | < 5% | - |

## 🔗 Полезные ссылки

- [YClients API Docs - Маркетплейс](https://developers.yclients.com/ru/#tag/Marketplejs)
- [Baileys Docs](https://github.com/WhiskeySockets/Baileys)
- [Наша документация](https://ai-admin.ru/docs)

---

*Документ создан: 12 сентября 2025*
*Версия: 1.0*