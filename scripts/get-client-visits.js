#!/usr/bin/env node

const axios = require('axios');
const config = require('../src/config');
const logger = require('../src/utils/logger');

/**
 * Скрипт для получения истории посещений клиента через YClients API
 */

const PHONE = process.argv[2]; // Телефон клиента передается как аргумент

if (!PHONE) {
  console.log('Использование: node scripts/get-client-visits.js +79XXXXXXXXX');
  process.exit(1);
}

async function getClientVisits(phone) {
  try {
    const normalizedPhone = phone.replace(/\D/g, ''); // Убираем все нецифровые символы
    
    // Настраиваем даты для поиска (последние 3 месяца)
    const today = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const params = {
      client_phone: normalizedPhone,
      from: threeMonthsAgo.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0],
      payment_statuses: [], // Все статусы оплаты
      attendance: -1 // Все статусы посещения
    };
    
    console.log('📅 Период поиска:', params.from, '-', params.to);
    console.log('📱 Телефон:', normalizedPhone);
    
    const response = await axios.post(
      `${config.yclients.apiUrl}/company/${config.yclients.companyId}/clients/visits/search`,
      params,
      {
        headers: {
          'Authorization': `Bearer ${config.yclients.bearerToken}, User ${config.yclients.userToken}`,
          'Accept': 'application/vnd.yclients.v2+json',
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      // Если клиент не найден, попробуем с client_id null
      console.log('⚠️  Клиент не найден, пробуем альтернативный поиск...');
      
      const normalizedPhone = phone.replace(/\D/g, '');
      const today = new Date();
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      try {
        const response = await axios.post(
          `${config.yclients.apiUrl}/company/${config.yclients.companyId}/clients/visits/search`,
          {
            client_id: null,
            client_phone: normalizedPhone,
            from: threeMonthsAgo.toISOString().split('T')[0],
            to: today.toISOString().split('T')[0],
            payment_statuses: [],
            attendance: -1
          },
          {
            headers: {
              'Authorization': `Bearer ${config.yclients.bearerToken}, User ${config.yclients.userToken}`,
              'Accept': 'application/vnd.yclients.v2+json',
              'Content-Type': 'application/json'
            }
          }
        );
        return response.data;
      } catch (altError) {
        logger.error('Alternative search failed:', altError.response?.data || altError.message);
        throw altError;
      }
    }
    
    logger.error('Error getting client visits:', error.response?.data || error.message);
    throw error;
  }
}

function formatVisitInfo(visit) {
  const totalCost = visit.services.reduce((sum, service) => sum + service.cost_to_pay, 0);
  const paidSum = visit.services.reduce((sum, service) => sum + service.paid_sum, 0);
  
  return {
    date: new Date(visit.date).toLocaleString('ru-RU'),
    staff: visit.staff?.name || 'Не указан',
    services: visit.services.map(s => ({
      name: s.title,
      cost: s.cost_to_pay,
      paid: s.paid_sum,
      status: s.payment_status
    })),
    totalCost,
    paidSum,
    attendance: visit.attendance,
    comment: visit.comment
  };
}

async function main() {
  console.log(`🔍 Ищем историю посещений по телефону: ${PHONE}\n`);
  
  try {
    const result = await getClientVisits(PHONE);
    
    if (!result.success) {
      console.log('❌ Не удалось получить историю посещений');
      return;
    }
    
    const { records = [], goods_transactions = [] } = result.data;
    
    console.log(`📊 Статистика:`);
    console.log(`   Визитов: ${records.length}`);
    console.log(`   Покупок товаров: ${goods_transactions.length}\n`);
    
    if (records.length === 0 && goods_transactions.length === 0) {
      console.log('📭 История посещений пуста');
      return;
    }
    
    // Выводим историю записей
    if (records.length > 0) {
      console.log('📋 ИСТОРИЯ ЗАПИСЕЙ:\n');
      
      records.forEach((record, index) => {
        const visit = formatVisitInfo(record);
        
        console.log(`${index + 1}. ${visit.date}`);
        console.log(`   👤 Мастер: ${visit.staff}`);
        console.log(`   📋 Услуги:`);
        
        visit.services.forEach(service => {
          const statusEmoji = service.status === 'paid_full' ? '✅' : 
                             service.status === 'paid_not_full' ? '⚠️' : '❌';
          console.log(`      ${statusEmoji} ${service.name} - ${service.cost}₽ (оплачено: ${service.paid}₽)`);
        });
        
        console.log(`   💰 Итого: ${visit.totalCost}₽ (оплачено: ${visit.paidSum}₽)`);
        
        const attendanceStatus = visit.attendance === 1 ? '✅ Клиент пришел' :
                                visit.attendance === 0 ? '⏳ Ожидается' :
                                visit.attendance === 2 ? '📝 Подтвержден' :
                                '❌ Не пришел';
        console.log(`   📌 Статус: ${attendanceStatus}`);
        
        if (visit.comment) {
          console.log(`   💬 Комментарий: ${visit.comment}`);
        }
        
        console.log('---');
      });
    }
    
    // Выводим историю покупок товаров
    if (goods_transactions.length > 0) {
      console.log('\n🛍 ИСТОРИЯ ПОКУПОК ТОВАРОВ:\n');
      
      goods_transactions.forEach((transaction, index) => {
        console.log(`${index + 1}. ${new Date(transaction.date).toLocaleString('ru-RU')}`);
        console.log(`   👤 Продавец: ${transaction.staff?.name || 'Не указан'}`);
        console.log(`   📦 Товары:`);
        
        transaction.goods.forEach(item => {
          const statusEmoji = item.payment_status === 'paid_full' ? '✅' : '❌';
          console.log(`      ${statusEmoji} ${item.title} - ${item.amount} ${item.unit} × ${item.cost_per_unit}₽ = ${item.cost_to_pay}₽`);
        });
        
        if (transaction.comment) {
          console.log(`   💬 Комментарий: ${transaction.comment}`);
        }
        
        console.log('---');
      });
    }
    
    // Выводим информацию о навигации
    if (result.meta?.dateCursor) {
      console.log('\n📅 Навигация по датам:');
      const cursor = result.meta.dateCursor;
      
      if (cursor.previous) {
        console.log(`   ← Предыдущий период: ${cursor.previous.from} - ${cursor.previous.to} (${cursor.previous.count} записей)`);
      }
      if (cursor.next) {
        console.log(`   → Следующий период: ${cursor.next.from} - ${cursor.next.to} (${cursor.next.count} записей)`);
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response?.data) {
      console.error('Детали:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

main().catch(error => {
  console.error('❌ Критическая ошибка:', error.message);
  process.exit(1);
});