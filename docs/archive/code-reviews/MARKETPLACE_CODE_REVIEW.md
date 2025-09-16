# 📋 Код Ревью: Интеграция с маркетплейсом YClients

## 📊 Общая оценка: 7/10

Интеграция реализована на хорошем уровне, но есть критические проблемы, которые нужно исправить перед production.

## 🔴 Критические проблемы

### 1. **Отсутствует файл маршрутов marketplace**
**Проблема**: В `src/api/index.js:72` подключается `./routes/marketplace`, но файл не существует
```javascript
const marketplaceRoutes = require('./routes/marketplace');
app.use('/marketplace', marketplaceRoutes);
```
**Решение**: Создать файл `src/api/routes/marketplace.js` с необходимыми endpoints

### 2. **Хардкод JWT_SECRET**
**Проблема**: В `marketplace-socket.js:38` используется дефолтный секрет
```javascript
jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key')
```
**Решение**: Убрать дефолтное значение, обязательно требовать JWT_SECRET из env

### 3. **SQL Injection уязвимость**
**Проблема**: В `marketplace-service.js` прямая передача параметров в SQL
```javascript
.eq('yclients_id', parseInt(salonId))  // parseInt недостаточно для защиты
```
**Решение**: Использовать параметризованные запросы везде

## 🟡 Важные проблемы

### 1. **Отсутствие валидации данных**
- Нет проверки формата телефона
- Нет валидации email
- Нет проверки обязательных полей при создании компании
- Нет лимитов на длину строк

### 2. **Проблемы с обработкой ошибок**
**marketplace-service.js:111-123**
```javascript
} catch (error) {
  logger.warn(`Не удалось получить информацию о салоне ${salonId}`, error.message);
  // Возвращаем базовую информацию
  return { title: `Салон ${salonId}`, ... };
}
```
Проблема: Скрывает реальную ошибку, может привести к неожиданному поведению

### 3. **Race conditions в WebSocket**
- Несколько QR-кодов могут генерироваться одновременно
- Нет блокировки при создании сессии
- Возможна потеря сессий при множественных подключениях

### 4. **Утечка памяти**
**marketplace-socket.js**
- Map `connections` не очищается при ошибках
- EventListeners не удаляются при отключении
- Сессии Baileys остаются в памяти

### 5. **Безопасность WebSocket**
- Нет rate limiting для WebSocket соединений
- Нет проверки origin
- Токен передается в query параметрах (видно в логах)

## 🟢 Хорошие практики

### Что сделано правильно:
1. ✅ Использование EventEmitter для управления событиями
2. ✅ Разделение логики на сервисы и handlers
3. ✅ Логирование всех важных событий
4. ✅ Использование Redis для временных данных
5. ✅ Хорошая структура HTML с адаптивным дизайном

## 🔧 Рекомендации по исправлению

### 1. Создать отсутствующий файл маршрутов
```javascript
// src/api/routes/marketplace.js
const express = require('express');
const router = express.Router();
const MarketplaceService = require('../../services/marketplace/marketplace-service');

const marketplaceService = new MarketplaceService();

// GET /marketplace/connect - страница подключения
router.get('/connect', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/marketplace/connect.html'));
});

// POST /marketplace/register - регистрация компании
router.post('/register', async (req, res) => {
  try {
    const { salonId } = req.body;

    // Валидация
    if (!salonId || !Number.isInteger(parseInt(salonId))) {
      return res.status(400).json({ error: 'Invalid salon ID' });
    }

    const company = await marketplaceService.createOrGetCompany(salonId);
    const token = marketplaceService.generateAPIKey();
    await marketplaceService.saveToken(token, company.id);

    res.json({
      success: true,
      token,
      companyId: company.id,
      connectUrl: `/marketplace/connect?token=${token}&company=${company.id}`
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// GET /marketplace/qr/:token - получение QR-кода
router.get('/qr/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Валидация токена
    const companyId = await marketplaceService.getCompanyByToken(token);
    if (!companyId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const qr = await marketplaceService.generateQR(companyId);
    res.json({ success: true, qr });
  } catch (error) {
    logger.error('QR generation error:', error);
    res.status(500).json({ error: 'QR generation failed' });
  }
});

module.exports = router;
```

### 2. Добавить валидацию данных
```javascript
// src/utils/validators.js
const validatePhone = (phone) => {
  const phoneRegex = /^7\d{10}$/;
  return phoneRegex.test(phone);
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().substring(0, 255);
};
```

### 3. Исправить проблемы безопасности
```javascript
// Добавить в marketplace-socket.js
const rateLimiter = new Map(); // IP -> последнее подключение

// В setupHandlers()
const clientIp = socket.handshake.address;
const lastConnect = rateLimiter.get(clientIp);

if (lastConnect && Date.now() - lastConnect < 1000) {
  socket.emit('error', { message: 'Too many connections' });
  socket.disconnect();
  return;
}
rateLimiter.set(clientIp, Date.now());

// Проверка origin
const allowedOrigins = ['https://ai-admin.app', 'https://yclients.com'];
const origin = socket.handshake.headers.origin;
if (!allowedOrigins.includes(origin)) {
  socket.disconnect();
  return;
}
```

### 4. Добавить очистку ресурсов
```javascript
// В marketplace-socket.js
socket.on('disconnect', () => {
  logger.info('WebSocket отключен', { companyId, socketId: socket.id });

  // Очистка ресурсов
  this.connections.delete(companyId);

  // Очистка Baileys сессии если не подключена
  const session = this.baileysManager.sessions.get(companyId);
  if (session && session.status !== 'connected') {
    this.baileysManager.removeSession(companyId);
  }

  // Удаление всех listeners
  socket.removeAllListeners();
});
```

### 5. Добавить транзакции для БД
```javascript
// В createOrGetCompany
async createOrGetCompany(salonId) {
  const { data, error } = await this.supabase.rpc('create_or_get_company', {
    p_salon_id: parseInt(salonId)
  });

  if (error) throw error;
  return data;
}
```

## 📝 Checklist исправлений

- [ ] Создать файл `src/api/routes/marketplace.js`
- [ ] Удалить дефолтное значение JWT_SECRET
- [ ] Добавить валидацию всех входных данных
- [ ] Исправить обработку ошибок в fetchSalonInfo
- [ ] Добавить блокировки для предотвращения race conditions
- [ ] Добавить очистку ресурсов при отключении
- [ ] Добавить rate limiting для WebSocket
- [ ] Переместить токен из query в headers
- [ ] Добавить проверку origin для WebSocket
- [ ] Добавить транзакции для операций с БД
- [ ] Добавить unit тесты
- [ ] Добавить мониторинг и метрики

## 🏗️ Архитектурные улучшения

1. **Вынести бизнес-логику из WebSocket handler** - создать отдельный сервис для управления подключениями

2. **Использовать паттерн Repository** для работы с БД

3. **Добавить State Machine** для управления состоянием подключения

4. **Реализовать Circuit Breaker** для внешних API вызовов

5. **Добавить кэширование** для данных компаний

## 🎯 Приоритеты

### Критично (сделать сейчас):
1. Создать отсутствующий файл маршрутов
2. Исправить проблемы безопасности
3. Добавить базовую валидацию

### Важно (сделать в ближайшее время):
1. Исправить утечки памяти
2. Добавить обработку race conditions
3. Улучшить обработку ошибок

### Желательно (можно отложить):
1. Архитектурные улучшения
2. Добавить тесты
3. Оптимизация производительности

## 📊 Итоговая оценка

**Плюсы:**
- Хорошая структура кода
- Правильное использование async/await
- Хорошее логирование
- Красивый и функциональный UI

**Минусы:**
- Критические проблемы с безопасностью
- Отсутствующие файлы
- Недостаточная валидация
- Потенциальные утечки памяти

**Вердикт:** Код требует доработки перед production. После исправления критических проблем можно будет безопасно использовать в production среде.