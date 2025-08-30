#!/usr/bin/env node

const axios = require('axios');
const crypto = require('crypto');

// Конфигурация
const WEBHOOK_URL = 'http://46.149.70.219:3000/webhook/yclients';
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';
const YOUR_PHONE = '+79686484488';

// Генерация подписи для webhook
function generateSignature(data) {
  return crypto
    .createHmac('sha256', SECRET_KEY)
    .update(JSON.stringify(data))
    .digest('hex');
}

// Создаем тестовое событие об изменении записи
function createTestEvent(recordId, iteration, fixedAppointmentTime = null) {
  const now = new Date();
  const appointmentTime = fixedAppointmentTime || new Date(now.getTime() + 24 * 60 * 60 * 1000); // Завтра
  
  return {
    event_id: `test_${Date.now()}_${iteration}`,
    event_type: 'record.updated',
    resource: 'record',
    resource_id: recordId,
    company_id: 962302,
    timestamp: now.toISOString(),
    data: {
      id: recordId,
      company_id: 962302,
      services: [
        {
          id: 45,
          title: "Мужская стрижка",
          cost: 1500,
          manual_cost: 1500,
          cost_per_unit: 1500,
          discount: 0,
          first_cost: 1500,
          amount: 1
        }
      ],
      goods_transactions: [],
      staff: {
        id: 3,
        name: "Бари",
        specialization: "Барбер",
        position: {
          id: 1,
          title: "Барбер"
        }
      },
      client: {
        id: 123456,
        name: "Тестовый Клиент",
        phone: YOUR_PHONE.replace('+', ''),
        email: null
      },
      clients_count: 1,
      datetime: appointmentTime.toISOString(),
      create_date: now.toISOString(),
      online: true,
      attendance: 0,
      confirmed: true,
      seance_length: 3600,
      length: 3600,
      sms_before: 0,
      sms_now: false,
      sms_now_text: "",
      email_now: false,
      notified: 0,
      master_request: false,
      api_id: "",
      from_url: "",
      review_requested: false,
      visit_id: 0,
      created_user_id: 1,
      deleted: false,
      paid_full: 0,
      prepaid: false,
      prepaid_confirmed: false,
      last_change_date: now.toISOString(),
      custom_color: "",
      custom_font_color: "",
      record_labels: [],
      activity_id: 0,
      comment: "Тест дедупликации webhook",
      sms_remain_hours: 24,
      email_remain_hours: 24,
      bookform_id: 0,
      record_from: "",
      is_mobile: 0,
      is_sale_bill_printed: false,
      visit_attendance: 0,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null
    }
  };
}

// Отправка webhook
async function sendWebhook(eventData, attempt) {
  try {
    const signature = generateSignature(eventData);
    
    console.log(`\n📤 Отправка webhook #${attempt}...`);
    console.log(`Event ID: ${eventData.event_id}`);
    console.log(`Record ID: ${eventData.data.id}`);
    
    const response = await axios.post(WEBHOOK_URL, eventData, {
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
        'X-Event-Type': eventData.event_type,
        'X-Company-Id': eventData.company_id
      }
    });

    console.log(`✅ Webhook #${attempt} отправлен успешно`);
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, response.data);
    
    return response.data;
  } catch (error) {
    console.error(`❌ Ошибка при отправке webhook #${attempt}:`, error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

// Основная функция теста
async function testDuplicateWebhooks() {
  console.log('🧪 Тест дедупликации webhook событий');
  console.log('=====================================');
  console.log(`📱 Телефон клиента: ${YOUR_PHONE}`);
  console.log(`🔗 Webhook URL: ${WEBHOOK_URL}`);
  
  const recordId = Date.now(); // Уникальный ID записи
  const fixedAppointmentTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // Фиксированное время записи
  
  // Сценарий 1: Отправляем 3 одинаковых события подряд
  console.log('\n📊 Сценарий 1: 3 одинаковых события подряд');
  console.log('Ожидаемый результат: только первое должно быть обработано');
  
  for (let i = 1; i <= 3; i++) {
    const event = createTestEvent(recordId, 1, fixedAppointmentTime); // Одинаковые данные с одинаковым временем
    await sendWebhook(event, i);
    
    // Небольшая задержка между запросами
    if (i < 3) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Ждем 2 секунды
  console.log('\n⏳ Ждем 2 секунды...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Сценарий 2: Изменяем данные и отправляем снова
  console.log('\n📊 Сценарий 2: Событие с измененными данными');
  console.log('Ожидаемый результат: должно быть обработано как новое изменение');
  
  const modifiedEvent = createTestEvent(recordId, 2);
  modifiedEvent.data.services[0].cost = 2000; // Изменяем стоимость
  modifiedEvent.data.comment = "Изменен комментарий"; // Изменяем комментарий
  
  await sendWebhook(modifiedEvent, 4);
  
  // Сценарий 3: Отправляем то же измененное событие еще раз
  console.log('\n📊 Сценарий 3: Повтор измененного события');
  console.log('Ожидаемый результат: должно быть пропущено как дубликат');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  await sendWebhook(modifiedEvent, 5);
  
  console.log('\n✅ Тест завершен!');
  console.log('\n📋 Что проверить:');
  console.log('1. В логах API должны быть сообщения о дубликатах');
  console.log('2. Клиент должен получить только 2 уведомления (не 5)');
  console.log('3. Статистика дебаунсера должна показать 3 дубликата');
}

// Запуск теста
testDuplicateWebhooks().catch(console.error);