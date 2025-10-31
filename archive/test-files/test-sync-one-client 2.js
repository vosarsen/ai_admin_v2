require('dotenv').config();
const { ClientsSync } = require('./src/sync/clients-sync');
const { supabase } = require('./src/database/supabase');

async function testOneClient() {
  const sync = new ClientsSync();
  
  // Тестовые данные клиента от API
  const testClient = {
    id: 212393401,
    name: "Леонид",
    phone: "+79035059524",
    email: "bodnarleo@gmail.com",
    sold_amount: 114590,
    visits_count: 27,
    first_visit_date: "2023-01-15",
    last_visit_date: "2024-12-20"
  };
  
  console.log('🔍 Подготовка данных клиента...');
  const clientData = sync.prepareClientData(testClient);
  console.log('Подготовленные данные:', clientData);
  
  console.log('\n💾 Сохранение в базу...');
  const { data, error } = await supabase
    .from('clients')
    .upsert(clientData, { 
      onConflict: 'yclients_id,company_id',
      ignoreDuplicates: false 
    })
    .select();
    
  if (error) {
    console.error('❌ Ошибка:', error);
  } else {
    console.log('✅ Успешно сохранено:', data);
  }
  
  // Проверяем что сохранилось
  const { data: checkData } = await supabase
    .from('clients')
    .select('name, phone, total_spent, visit_count')
    .eq('yclients_id', 212393401)
    .single();
    
  console.log('\n📊 Проверка базы:');
  console.log('Сохраненные данные:', checkData);
}

testOneClient().catch(console.error);
