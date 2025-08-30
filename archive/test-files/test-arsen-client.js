#!/usr/bin/env node

const { supabase } = require('./src/database/supabase');

async function testArsenClient() {
  console.log('\n=== Проверка клиента Арсен в базе ===');
  
  // Тестовый номер Арсена
  const phone = '79068831915';
  const companyId = 962302;
  
  console.log('Ищем клиента:');
  console.log('- Телефон:', phone);
  console.log('- Компания:', companyId);
  
  try {
    // Поиск по phone
    const { data: clientByPhone, error: error1 } = await supabase
      .from('clients')
      .select('*')
      .eq('phone', phone)
      .eq('company_id', companyId)
      .maybeSingle();
      
    if (clientByPhone) {
      console.log('\n✅ Клиент найден по phone:');
      console.log('- ID:', clientByPhone.id);
      console.log('- Имя:', clientByPhone.name);
      console.log('- Телефон (phone):', clientByPhone.phone);
      console.log('- Телефон (raw_phone):', clientByPhone.raw_phone);
    } else {
      console.log('\n❌ Клиент не найден по phone');
      if (error1) console.error('Ошибка:', error1);
    }
    
    // Поиск по raw_phone
    const { data: clientByRawPhone, error: error2 } = await supabase
      .from('clients')
      .select('*')
      .eq('raw_phone', '+' + phone)
      .eq('company_id', companyId)
      .maybeSingle();
      
    if (clientByRawPhone) {
      console.log('\n✅ Клиент найден по raw_phone:');
      console.log('- ID:', clientByRawPhone.id);
      console.log('- Имя:', clientByRawPhone.name);
      console.log('- Телефон (phone):', clientByRawPhone.phone);
      console.log('- Телефон (raw_phone):', clientByRawPhone.raw_phone);
    } else {
      console.log('\n❌ Клиент не найден по raw_phone');
      if (error2) console.error('Ошибка:', error2);
    }
    
    // Проверим все клиенты с похожим номером
    const { data: similarClients, error: error3 } = await supabase
      .from('clients')
      .select('id, name, phone, raw_phone, company_id')
      .ilike('phone', '%831915%')
      .limit(10);
      
    if (similarClients && similarClients.length > 0) {
      console.log('\n📝 Клиенты с похожим номером:');
      similarClients.forEach(client => {
        console.log(`- ${client.name}: phone=${client.phone}, raw_phone=${client.raw_phone}, company=${client.company_id}`);
      });
    }
    
    // Если не нашли, попробуем создать
    if (!clientByPhone && !clientByRawPhone) {
      console.log('\n💡 Рекомендация: создать клиента в базе');
      console.log('INSERT INTO clients (phone, raw_phone, name, company_id) VALUES');
      console.log(`('${phone}', '+${phone}', 'Арсен', ${companyId});`);
    }
    
  } catch (error) {
    console.error('Ошибка:', error);
  }
}

// Запускаем тест
testArsenClient();