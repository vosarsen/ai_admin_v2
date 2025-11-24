# Contact Form Setup Guide

## Overview

Интеграция контактной формы с отправкой email на support@adminai.tech реализована в трех местах:
1. **Футер** - отображение контактной информации и ссылок
2. **Отдельная секция "Контакты"** - inline форма с контактной информацией
3. **Модальное окно** - всплывающая форма по клику на кнопки "ПОПРОБОВАТЬ БЕСПЛАТНО" и т.д.

## Architecture

### Backend
- **Route**: `POST /api/contact`
- **Location**: `src/api/routes/contact.js`
- **Features**:
  - Rate limiting для защиты от спама
  - Валидация данных с express-validator
  - Email отправка через nodemailer (Gmail SMTP)
  - Красивый HTML шаблон письма
  - Полное логирование

### Frontend
- **Location**: `public/landing/index.html`
- **Forms**:
  1. Modal form (`#contactForm`) - модальное окно
  2. Inline form (`#inlineContactForm`) - в секции контактов
- **Features**:
  - Async/await отправка
  - Loading state на кнопках
  - Обработка ошибок с user-friendly сообщениями
  - Автоматическое закрытие модального окна при успехе

## Setup Instructions

### 1. Install Dependencies

Nodemailer уже установлен:
```bash
npm install nodemailer
```

### 2. Configure Email Credentials

#### For Gmail:

1. **Enable 2-Factor Authentication** в вашем Google аккаунте
2. **Generate App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "AI Admin Contact Form"
   - Copy the generated 16-character password

3. **Update .env file**:
```bash
CONTACT_EMAIL_USER=your-email@gmail.com
CONTACT_EMAIL_PASSWORD=xxxx-xxxx-xxxx-xxxx  # App Password from step 2
```

#### For Other Email Providers:

Edit `src/api/routes/contact.js` and change the transporter configuration:

**For Outlook/Office365:**
```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.CONTACT_EMAIL_USER,
    pass: process.env.CONTACT_EMAIL_PASSWORD
  }
});
```

**For Custom SMTP:**
```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp.your-domain.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.CONTACT_EMAIL_USER,
    pass: process.env.CONTACT_EMAIL_PASSWORD
  }
});
```

### 3. Test the Integration

#### Start the server:
```bash
npm start
# or
npm run dev
```

#### Test endpoints:

**Via curl:**
```bash
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "+7 (999) 123-45-67",
    "message": "This is a test message"
  }'
```

**Expected response (success):**
```json
{
  "success": true,
  "message": "Спасибо! Ваша заявка отправлена. Мы свяжемся с вами в течение 24 часов."
}
```

**Expected response (validation error):**
```json
{
  "success": false,
  "errors": [
    {
      "msg": "Некорректный email",
      "param": "email",
      "location": "body"
    }
  ]
}
```

#### Test via browser:

1. Open http://localhost:3000/landing/index.html
2. Scroll to "Свяжитесь с нами" section
3. Fill out the inline form
4. Submit and check for success message
5. Try the modal form by clicking any "ПОПРОБОВАТЬ БЕСПЛАТНО" button

### 4. Check Email Delivery

After submitting the form, check:
1. Server logs for successful email send
2. The recipient inbox (support@adminai.tech)
3. Spam folder if email not received

## Features

### Security
- ✅ Rate limiting на endpoint
- ✅ Input validation с express-validator
- ✅ Sanitization (trim, normalizeEmail)
- ✅ CORS headers настроены
- ✅ App Password вместо основного пароля Gmail

### User Experience
- ✅ Loading state на кнопках отправки
- ✅ Clear error messages на русском
- ✅ Автоматическая очистка форм после отправки
- ✅ Responsive design для мобильных
- ✅ Доступность: placeholder, label, required fields

### Email Template
- ✅ Professional HTML design
- ✅ Responsive layout
- ✅ Clickable email and phone links
- ✅ Timestamp в московском времени
- ✅ Branding (AI Admin colors)

## Troubleshooting

### Email not sending

**Check logs:**
```bash
# Look for errors in server logs
npm start
# or check PM2 logs if deployed
pm2 logs ai-admin
```

**Common issues:**

1. **Gmail blocking sign-in attempts**
   - Solution: Use App Password (not regular password)
   - Enable "Less secure app access" is NOT recommended

2. **Network/Firewall issues**
   - Check if port 587 (SMTP) is open
   - Test SMTP connection:
   ```bash
   telnet smtp.gmail.com 587
   ```

3. **Rate limiting**
   - Gmail has sending limits (500/day for free accounts)
   - Consider using SendGrid/AWS SES for production

### Frontend not working

**Check browser console:**
```javascript
// Should see fetch request to /api/contact
// Check Network tab in DevTools
```

**Common issues:**

1. **CORS errors**
   - Solution: Check CORS configuration in `src/api/index.js`

2. **API endpoint not found (404)**
   - Verify route is registered in `src/api/index.js`
   - Check server is running

3. **Form not submitting**
   - Check JavaScript errors in console
   - Verify form IDs match in HTML and JS

## Production Recommendations

### 1. Use Professional Email Service

For production, consider using:
- **SendGrid** (free tier: 100 emails/day)
- **AWS SES** (cheap, reliable)
- **Mailgun** (good API)
- **Postmark** (excellent deliverability)

### 2. Add Email Queue

For reliability, add email queue:
```javascript
// In src/api/routes/contact.js
await emailQueue.add('send-contact-email', {
  to: 'support@adminai.tech',
  from: formData.email,
  subject: `Новая заявка от ${formData.name}`,
  html: emailTemplate
});
```

### 3. Add Analytics

Track form submissions:
```javascript
// Google Analytics event
gtag('event', 'form_submit', {
  'event_category': 'Contact',
  'event_label': 'Landing Page'
});
```

### 4. Add Honeypot Field

Prevent bot submissions:
```html
<!-- Hidden field for bots -->
<input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
```

```javascript
// In backend validation
if (req.body.website) {
  // Bot detected, silently reject
  return res.json({ success: true });
}
```

### 5. Monitor Delivery

Set up monitoring:
- Email delivery rate
- Failed send attempts
- Average response time
- Form submission rate

## Files Changed

### Backend
- ✅ `src/api/routes/contact.js` - новый маршрут
- ✅ `src/api/index.js` - подключение маршрута
- ✅ `package.json` - добавлен nodemailer

### Frontend
- ✅ `public/landing/index.html`:
  - Обновлен футер с контактной информацией
  - Добавлена секция "Свяжитесь с нами"
  - Обновлен JavaScript для обработки форм
  - Добавлены CSS стили для контактов и футера

### Configuration
- ✅ `.env` - добавлены CONTACT_EMAIL_USER и CONTACT_EMAIL_PASSWORD
- ✅ `.env.example` - документация для новых переменных

## API Documentation

### POST /api/contact

**Request:**
```json
{
  "name": "string (required)",
  "email": "string (required, valid email)",
  "phone": "string (required)",
  "message": "string (optional)"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Спасибо! Ваша заявка отправлена. Мы свяжемся с вами в течение 24 часов."
}
```

**Response (Validation Error - 400):**
```json
{
  "success": false,
  "errors": [
    {
      "msg": "Некорректный email",
      "param": "email",
      "location": "body"
    }
  ]
}
```

**Response (Server Error - 500):**
```json
{
  "success": false,
  "message": "Произошла ошибка при отправке сообщения. Пожалуйста, попробуйте позже или свяжитесь с нами напрямую по email: support@adminai.tech"
}
```

## Support

For issues or questions:
- Email: support@adminai.tech
- Phone: +7 (993) 636-38-48
- Check logs: `pm2 logs ai-admin` (production) or console (development)
