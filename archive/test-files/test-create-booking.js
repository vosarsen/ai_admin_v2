#!/usr/bin/env node

const bookingService = require('./src/services/booking');
const { supabase } = require('./src/database/supabase');

async function testCreateBooking() {
  console.log('\n=== Тестирование создания записи ===\n');
  
  const companyId = 962302;
  const phone = '79686484488';
  const staffId = 2895125; // Сергей
  const serviceId = 18356010; // МУЖСКАЯ СТРИЖКА
  const date = '2025-08-05';
  const time = '14:00';
  
  try {
    // 1. Проверяем доступность слота
    console.log('1. Проверяем доступность слота...');
    const yclientsClient = bookingService.getYclientsClient();
    
    const slotsResult = await yclientsClient.getAvailableSlots(
      date,
      companyId,
      staffId,
      [serviceId]
    );
    
    console.log('Результат проверки слотов:', {
      success: slotsResult.success,
      slotsCount: slotsResult.data?.length || 0,
      hasTargetSlot: slotsResult.data?.some(s => s.time === time)
    });
    
    if (!slotsResult.success) {
      console.error('Ошибка получения слотов:', slotsResult);
      return;
    }
    
    const targetSlot = slotsResult.data?.find(s => s.time === time);
    if (!targetSlot) {
      console.error(`Слот ${time} не найден среди доступных`);
      return;
    }
    
    // 2. Создаем запись
    console.log('\n2. Создаем запись...');
    const bookingData = {
      phone: phone,
      fullname: 'Арсен',
      email: '',
      comment: 'Тестовая запись через AI администратора',
      appointments: [{
        id: 1,
        services: [serviceId],
        staff_id: staffId,
        datetime: `${date} ${time}:00`
      }]
    };
    
    console.log('Данные для записи:', JSON.stringify(bookingData, null, 2));
    
    const result = await bookingService.createBooking(bookingData, companyId);
    
    console.log('\n3. Результат создания записи:');
    console.log('Success:', result.success);
    
    if (result.success) {
      console.log('Запись создана успешно!');
      console.log('ID записи:', result.data?.data?.[0]?.record_id);
    } else {
      console.error('Ошибка создания записи:');
      console.error('Error:', result.error);
      
      if (result.yclientsErrors) {
        console.error('YClients errors:', result.yclientsErrors);
      }
      
      if (result.error?.yclientsErrors) {
        console.error('Nested YClients errors:', result.error.yclientsErrors);
      }
      
      console.error('Full result:', JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('Критическая ошибка:', error);
  }
}

// Запускаем тест
testCreateBooking();