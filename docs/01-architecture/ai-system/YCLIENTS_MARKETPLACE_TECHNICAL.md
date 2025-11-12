# 🔧 Техническая реализация интеграции с маркетплейсом YClients

## 📋 Обзор API маркетплейса YClients

### Основные концепции
- **salon_id** - уникальный ID филиала в YClients
- **application_id** - ID нашего приложения в маркетплейсе (выдается при регистрации)
- **partner_token** - токен партнера для авторизации API запросов
- **webhook_urls** - массив URL для получения событий от YClients

## 🚀 Пошаговая техническая реализация

### Шаг 1: Регистрация в маркетплейсе как партнер

**Что нужно сделать**:
1. Зарегистрироваться на https://yclients.com/appstore/developers
2. Получить `partner_token` в настройках аккаунта
3. Создать приложение и получить `application_id`

### Шаг 2: Реализация endpoint для приема пользователей

```javascript
// src/api/routes/marketplace.js

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const BaileysProvider = require('../../integrations/whatsapp/baileys-provider');

// GET /marketplace/register - точка входа из маркетплейса
router.get('/marketplace/register', async (req, res) => {
  const { salon_id } = req.query;
  
  if (!salon_id) {
    return res.status(400).render('error', { 
      message: 'Отсутствует идентификатор салона' 
    });
  }
  
  try {
    // 1. Получаем данные салона из YClients API
    const salonResponse = await fetch(
      `https://api.yclients.com/api/v1/company/${salon_id}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.YCLIENTS_PARTNER_TOKEN}`,
          'Accept': 'application/vnd.yclients.v2+json'
        }
      }
    );
    
    const salonData = await salonResponse.json();
    
    // 2. Создаем или обновляем компанию в нашей БД
    const { data: company, error } = await supabase
      .from('companies')
      .upsert({
        yclients_id: salon_id,
        name: salonData.data.title,
        phone: salonData.data.phone,
        email: salonData.data.email,
        address: salonData.data.address,
        timezone: salonData.data.timezone,
        integration_status: 'pending_whatsapp',
        created_at: new Date().toISOString()
      }, {
        onConflict: 'yclients_id'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // 3. Генерируем временный токен для сессии
    const sessionToken = jwt.sign(
      { 
        company_id: company.id,
        salon_id: salon_id,
        timestamp: Date.now()
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    // 4. Сохраняем токен в Redis для tracking
    await redis.setex(
      `session:${sessionToken}`,
      3600, // 1 час
      JSON.stringify({ company_id: company.id, salon_id })
    );
    
    // 5. Рендерим страницу с QR-кодом
    res.render('whatsapp-connect', {
      company,
      salon_id,
      session_token: sessionToken,
      application_id: process.env.YCLIENTS_APPLICATION_ID
    });
    
  } catch (error) {
    console.error('Ошибка при регистрации:', error);
    res.status(500).render('error', {
      message: 'Ошибка при подключении интеграции'
    });
  }
});
```

### Шаг 3: Страница подключения WhatsApp с QR-кодом

```html
<!-- views/whatsapp-connect.ejs -->
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Подключение AI Admin - <%= company.name %></title>
  <script src="/socket.io/socket.io.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
</head>
<body>
  <div class="container">
    <h1>Подключение AI Admin</h1>
    <h2><%= company.name %></h2>
    
    <div id="qr-container">
      <canvas id="qr-canvas"></canvas>
      <div id="status">Инициализация...</div>
    </div>
    
    <script>
      const sessionToken = '<%= session_token %>';
      const companyId = '<%= company.id %>';
      const salonId = '<%= salon_id %>';
      
      // Подключаемся к WebSocket
      const socket = io('/whatsapp', {
        query: { 
          token: sessionToken,
          company_id: companyId 
        }
      });
      
      // Слушаем обновления QR
      socket.on('qr', (qr) => {
        QRCode.toCanvas(
          document.getElementById('qr-canvas'), 
          qr,
          { width: 300 }
        );
        document.getElementById('status').innerText = 
          'Отсканируйте QR-код в WhatsApp';
      });
      
      // Слушаем успешное подключение
      socket.on('connected', async (data) => {
        document.getElementById('status').innerText = 
          '✅ WhatsApp подключен! Завершение настройки...';
        
        // Отправляем callback в YClients
        setTimeout(() => {
          document.getElementById('callback-form').submit();
        }, 2000);
      });
      
      // Запрашиваем первый QR
      socket.emit('request-qr');
    </script>
    
    <!-- Скрытая форма для callback -->
    <form id="callback-form" method="POST" 
          action="https://api.yclients.com/marketplace/partner/callback/redirect">
      <input type="hidden" name="salon_id" value="<%= salon_id %>">
      <input type="hidden" name="application_id" 
             value="<%= application_id %>">
      <input type="hidden" name="api_key" 
             value="<%= company.api_key %>">
      <input type="hidden" name="webhook_urls[]" 
             value="https://ai-admin.ru/webhook/yclients/<%= company.id %>">
    </form>
  </div>
</body>
</html>
```

### Шаг 4: WebSocket сервер для real-time QR обновлений

```javascript
// src/websocket/whatsapp-qr-handler.js

const { Server } = require('socket.io');
const BaileysProvider = require('../integrations/whatsapp/baileys-provider');

class WhatsAppQRHandler {
  constructor(httpServer) {
    this.io = new Server(httpServer);
    this.sessions = new Map();
    
    this.setupNamespace();
  }
  
  setupNamespace() {
    const whatsappNS = this.io.of('/whatsapp');
    
    whatsappNS.on('connection', async (socket) => {
      const { token, company_id } = socket.handshake.query;
      
      // Валидация токена
      const sessionData = await redis.get(`session:${token}`);
      if (!sessionData) {
        socket.disconnect();
        return;
      }
      
      console.log(`Company ${company_id} connected for QR`);
      
      // Обработка запроса QR
      socket.on('request-qr', async () => {
        try {
          // Создаем новую сессию Baileys для компании
          const baileys = new BaileysProvider(company_id);
          
          // Подписываемся на события QR
          baileys.on('qr', (qr) => {
            socket.emit('qr', qr);
          });
          
          // Подписываемся на успешное подключение
          baileys.on('connected', async (connectionData) => {
            const { phone, pushName } = connectionData;
            
            // Сохраняем данные подключения
            await this.saveWhatsAppConnection(company_id, {
              phone,
              pushName,
              session: baileys.getSessionData()
            });
            
            // Уведомляем клиента
            socket.emit('connected', {
              phone,
              name: pushName
            });
          });
          
          // Инициализируем подключение
          await baileys.initialize();
          
          // Сохраняем сессию
          this.sessions.set(company_id, baileys);
          
        } catch (error) {
          console.error('QR generation error:', error);
          socket.emit('error', { 
            message: 'Ошибка генерации QR-кода' 
          });
        }
      });
      
      // Очистка при отключении
      socket.on('disconnect', () => {
        console.log(`Company ${company_id} disconnected`);
      });
    });
  }
  
  async saveWhatsAppConnection(companyId, data) {
    // Сохраняем в БД
    await supabase
      .from('companies')
      .update({
        whatsapp_phone: data.phone,
        whatsapp_name: data.pushName,
        whatsapp_session: data.session,
        whatsapp_connected_at: new Date().toISOString(),
        integration_status: 'whatsapp_connected'
      })
      .eq('id', companyId);
    
    // Сохраняем сессию в Redis для быстрого доступа
    await redis.set(
      `whatsapp:session:${companyId}`,
      JSON.stringify(data.session)
    );
  }
}
```

### Шаг 5: Callback в YClients после успешного подключения

```javascript
// src/api/routes/marketplace-callback.js

// Этот endpoint вызывается после успешного подключения WhatsApp
router.post('/marketplace/callback/prepare', async (req, res) => {
  const { company_id, salon_id } = req.body;
  
  try {
    // 1. Генерируем API ключ для компании
    const apiKey = crypto.randomBytes(32).toString('hex');
    
    // 2. Сохраняем в БД
    await supabase
      .from('companies')
      .update({
        api_key: apiKey,
        integration_status: 'configuring'
      })
      .eq('id', company_id);
    
    // 3. Запускаем синхронизацию данных из YClients
    await syncYClientsData(company_id, salon_id);
    
    // 4. Формируем данные для callback
    const callbackData = {
      salon_id: salon_id,
      application_id: process.env.YCLIENTS_APPLICATION_ID,
      api_key: apiKey,
      webhook_urls: [
        `https://ai-admin.ru/webhook/yclients/${company_id}`,
        `https://ai-admin.ru/webhook/events/${company_id}`
      ]
    };
    
    // 5. Отправляем POST запрос в YClients
    const response = await fetch(
      'https://api.yclients.com/marketplace/partner/callback/redirect',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.YCLIENTS_PARTNER_TOKEN}`
        },
        body: JSON.stringify(callbackData)
      }
    );
    
    if (response.status === 301) {
      // Успешно! YClients активирует интеграцию
      await supabase
        .from('companies')
        .update({
          integration_status: 'active',
          activated_at: new Date().toISOString()
        })
        .eq('id', company_id);
      
      // Отправляем welcome сообщение в WhatsApp
      await sendWelcomeMessage(company_id);
      
      res.json({ success: true });
    } else {
      throw new Error('YClients callback failed');
    }
    
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Шаг 6: Синхронизация данных из YClients

```javascript
// src/sync/initial-sync.js

async function syncYClientsData(companyId, salonId) {
  const headers = {
    'Authorization': `Bearer ${process.env.YCLIENTS_PARTNER_TOKEN}`,
    'Accept': 'application/vnd.yclients.v2+json'
  };
  
  try {
    // 1. Синхронизируем услуги
    const servicesResponse = await fetch(
      `https://api.yclients.com/api/v1/book_services/${salonId}`,
      { headers }
    );
    const services = await servicesResponse.json();
    
    for (const service of services.data.services) {
      await supabase.from('services').upsert({
        company_id: companyId,
        yclients_id: service.id,
        title: service.title,
        category_id: service.category_id,
        price_min: service.price_min,
        price_max: service.price_max,
        duration: service.duration,
        active: service.active
      }, {
        onConflict: 'company_id,yclients_id'
      });
    }
    
    // 2. Синхронизируем сотрудников
    const staffResponse = await fetch(
      `https://api.yclients.com/api/v1/book_staff/${salonId}`,
      { headers }
    );
    const staff = await staffResponse.json();
    
    for (const employee of staff.data) {
      await supabase.from('staff').upsert({
        company_id: companyId,
        yclients_id: employee.id,
        name: employee.name,
        specialization: employee.specialization,
        avatar: employee.avatar,
        active: !employee.fired && !employee.hidden
      }, {
        onConflict: 'company_id,yclients_id'
      });
    }
    
    // 3. Синхронизируем расписание
    await syncSchedules(companyId, salonId);
    
    console.log(`✅ Синхронизация завершена для компании ${companyId}`);
    
  } catch (error) {
    console.error('Sync error:', error);
    throw error;
  }
}
```

### Шаг 7: Обработка webhook событий от YClients

```javascript
// src/api/routes/yclients-webhook.js

router.post('/webhook/yclients/:company_id', async (req, res) => {
  const { company_id } = req.params;
  const event = req.body;
  
  try {
    // Проверяем подпись (если YClients поддерживает)
    if (!verifyWebhookSignature(req)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Обрабатываем разные типы событий
    switch (event.type) {
      case 'record_created':
        await handleNewBooking(company_id, event.data);
        break;
        
      case 'record_updated':
        await handleBookingUpdate(company_id, event.data);
        break;
        
      case 'record_deleted':
        await handleBookingCancellation(company_id, event.data);
        break;
        
      case 'client_created':
        await handleNewClient(company_id, event.data);
        break;
        
      default:
        console.log(`Unknown event type: ${event.type}`);
    }
    
    // Подтверждаем получение
    res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

async function handleNewBooking(companyId, bookingData) {
  // Отправляем подтверждение клиенту через WhatsApp
  const client = await getClientInfo(bookingData.client_id);
  
  if (client.phone) {
    await sendWhatsAppMessage(companyId, client.phone, {
      text: `✅ Ваша запись подтверждена!\n\n` +
            `📅 ${formatDate(bookingData.datetime)}\n` +
            `💇 ${bookingData.services.map(s => s.title).join(', ')}\n` +
            `👤 Мастер: ${bookingData.staff.name}\n\n` +
            `Ждем вас!`
    });
  }
}
```

### Шаг 8: Обработка событий жизненного цикла приложения

```javascript
// src/api/routes/marketplace-lifecycle.js

// YClients отправляет эти события
router.post('/marketplace/webhook', async (req, res) => {
  const { salon_id, application_id, event, partner_token } = req.body;
  
  // Проверяем токен партнера
  if (partner_token !== process.env.YCLIENTS_PARTNER_TOKEN) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  try {
    switch (event) {
      case 'uninstall':
        // Приложение удалено из салона
        await handleUninstall(salon_id);
        break;
        
      case 'freeze':
        // Подписка приостановлена
        await handleFreeze(salon_id);
        break;
        
      case 'unfreeze':
        // Подписка возобновлена
        await handleUnfreeze(salon_id);
        break;
    }
    
    res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('Lifecycle event error:', error);
    res.status(500).json({ error: error.message });
  }
});

async function handleUninstall(salonId) {
  // 1. Находим компанию
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('yclients_id', salonId)
    .single();
  
  if (!company) return;
  
  // 2. Отключаем WhatsApp сессию
  await BaileysProvider.disconnect(company.id);
  
  // 3. Обновляем статус
  await supabase
    .from('companies')
    .update({
      integration_status: 'uninstalled',
      uninstalled_at: new Date().toISOString()
    })
    .eq('id', company.id);
  
  // 4. Отправляем уведомление админу
  await notifyAdmin(`Салон ${company.name} удалил интеграцию`);
}
```

## 🔒 Безопасность

### Проверка подписи webhook

```javascript
function verifyWebhookSignature(req) {
  const signature = req.headers['x-yclients-signature'];
  const body = JSON.stringify(req.body);
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.YCLIENTS_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  
  return signature === expectedSignature;
}
```

### Хранение чувствительных данных

```javascript
// Используем переменные окружения
const config = {
  YCLIENTS_PARTNER_TOKEN: process.env.YCLIENTS_PARTNER_TOKEN,
  YCLIENTS_APPLICATION_ID: process.env.YCLIENTS_APPLICATION_ID,
  YCLIENTS_WEBHOOK_SECRET: process.env.YCLIENTS_WEBHOOK_SECRET,
  JWT_SECRET: process.env.JWT_SECRET
};

// WhatsApp сессии шифруем перед сохранением
const encryptedSession = encrypt(sessionData, process.env.ENCRYPTION_KEY);
```

## 📊 Мониторинг интеграции

```javascript
// src/monitoring/integration-health.js

async function checkIntegrationHealth(companyId) {
  const checks = {
    whatsapp: false,
    yclients: false,
    lastSync: null,
    lastMessage: null,
    errors: []
  };
  
  try {
    // Проверка WhatsApp
    const whatsappStatus = await BaileysProvider.getStatus(companyId);
    checks.whatsapp = whatsappStatus === 'connected';
    
    // Проверка YClients API
    const testResponse = await fetch(
      `https://api.yclients.com/api/v1/company/${salonId}`,
      {
        headers: {
          'Authorization': `Bearer ${PARTNER_TOKEN}`
        }
      }
    );
    checks.yclients = testResponse.ok;
    
    // Проверка последней синхронизации
    const { data: syncLog } = await supabase
      .from('sync_logs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    checks.lastSync = syncLog?.created_at;
    
    // Проверка последнего сообщения
    const { data: lastMessage } = await supabase
      .from('messages')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    checks.lastMessage = lastMessage?.created_at;
    
  } catch (error) {
    checks.errors.push(error.message);
  }
  
  return checks;
}
```

## 🚦 Статус-коды и ошибки

| Код | Описание | Действие |
|-----|----------|----------|
| 200 | Успешно | Продолжить |
| 301 | Редирект (callback успешен) | Следовать редиректу |
| 400 | Неверные параметры | Показать ошибку пользователю |
| 401 | Не авторизован | Проверить токены |
| 404 | Салон не найден | Проверить salon_id |
| 429 | Rate limit | Повторить через время |
| 500 | Ошибка сервера | Логировать и повторить |

## 📝 Чек-лист внедрения

- [ ] Зарегистрироваться как партнер в YClients
- [ ] Получить partner_token и application_id
- [ ] Реализовать endpoint `/marketplace/register`
- [ ] Создать страницу с QR-кодом
- [ ] Настроить WebSocket для real-time обновлений
- [ ] Реализовать Baileys интеграцию
- [ ] Настроить callback в YClients
- [ ] Реализовать webhook обработчики
- [ ] Добавить синхронизацию данных
- [ ] Настроить мониторинг
- [ ] Протестировать полный флоу
- [ ] Добавить обработку ошибок
- [ ] Настроить логирование
- [ ] Документировать API

---

*Документ создан: 12 сентября 2025*
*Версия: 1.0*