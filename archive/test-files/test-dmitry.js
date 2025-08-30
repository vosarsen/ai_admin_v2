const axios = require('axios');
const { supabase } = require('./src/database/supabase');
require('dotenv').config();

async function testDmitry() {
  console.log('🔍 ТЕСТИРУЕМ КЛИЕНТА ДМИТРИЙ (YClients ID: 208471717)');
  console.log('═══════════════════════════════════════════════════\n');
  
  const bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
  const userToken = process.env.YCLIENTS_USER_TOKEN;
  const companyId = 962302;
  const dmitryYclientsId = 208471717;
  
  // Проверяем в БД
  const { data: dmitry } = await supabase
    .from('clients')
    .select('*')
    .eq('yclients_id', dmitryYclientsId)
    .eq('company_id', companyId)
    .single();
  
  if (dmitry) {
    console.log(`✅ Найден в БД:`);
    console.log(`  ID: ${dmitry.id}`);
    console.log(`  Имя: ${dmitry.name}`);
    console.log(`  visit_count: ${dmitry.visit_count}`);
    console.log(`  visit_history: ${dmitry.visit_history?.length || 0} записей`);
    console.log(`  last_services: ${dmitry.last_services || 'пусто'}\n`);
  } else {
    console.log('❌ НЕ найден в БД\n');
  }
  
  // Запрашиваем из API
  console.log('📡 Запрашиваем визиты из YClients API...\n');
  
  try {
    const url = `https://api.yclients.com/api/v1/records/${companyId}`;
    
    const response = await axios.get(url, {
      params: {
        client_id: dmitryYclientsId,
        start_date: '2023-01-01',
        end_date: '2025-12-31',
        include_finance_transactions: 1,
        with_deleted: 0
      },
      headers: {
        'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
        'Accept': 'application/vnd.api.v2+json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    const records = response.data?.data || [];
    const dmitryRecords = records.filter(r => 
      String(r.client?.id) === String(dmitryYclientsId)
    );
    
    console.log(`📥 API вернул ${records.length} записей`);
    console.log(`   Из них для Дмитрия: ${dmitryRecords.length}\n`);
    
    if (dmitryRecords.length > 0) {
      console.log('📅 Примеры визитов:');
      dmitryRecords.slice(0, 5).forEach((r, i) => {
        const services = r.services?.map(s => s.title || s.name).join(', ');
        console.log(`  ${i+1}. ${r.date}: ${services || 'без услуг'}`);
        console.log(`     Мастер: ${r.staff?.name || 'не указан'}`);
        console.log(`     Стоимость: ${r.cost || 0}₽`);
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка API:', error.message);
  }
}

testDmitry().catch(console.error);