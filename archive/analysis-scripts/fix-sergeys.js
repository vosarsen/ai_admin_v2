const { supabase } = require('./src/database/supabase');

async function fixSergeys() {
  console.log('🔧 ИСПРАВЛЕНИЕ ДАННЫХ ДЛЯ КЛИЕНТОВ СЕРГЕЙ');
  console.log('═══════════════════════════════════════════════════\n');
  
  // ID клиентов Сергей из проверки
  const sergeyIds = [60970, 60986, 60988];
  
  for (const clientId of sergeyIds) {
    // Получаем клиента
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
    
    console.log(`\n${client.name} (ID: ${clientId}):`);
    console.log(`  YClients ID: ${client.yclients_id}`);
    console.log(`  visit_count: ${client.visit_count}`);
    
    // Получаем его визиты
    const { data: visits } = await supabase
      .from('visits')
      .select('*')
      .eq('client_id', clientId)
      .order('visit_date', { ascending: false });
    
    console.log(`  Найдено визитов: ${visits?.length || 0}`);
    
    if (visits && visits.length > 0) {
      // Формируем данные
      const visitHistory = visits.slice(0, 50).map(v => ({
        date: v.visit_date,
        time: v.visit_time,
        services: v.service_names || []
      }));
      
      const lastServices = visits[0]?.service_names || [];
      
      // Обновляем клиента
      const { error } = await supabase
        .from('clients')
        .update({
          visit_history: visitHistory,
          last_services: lastServices
        })
        .eq('id', clientId);
      
      if (error) {
        console.log(`  ❌ Ошибка: ${error.message}`);
      } else {
        console.log(`  ✅ Обновлено!`);
        console.log(`     История: ${visitHistory.length} записей`);
        console.log(`     Последние услуги: ${lastServices.join(', ')}`);
      }
    }
  }
  
  console.log('\n\nПроверяем результат:');
  
  const { data: updatedClients } = await supabase
    .from('clients')
    .select('name, visit_history, last_services')
    .in('id', sergeyIds);
  
  for (const client of updatedClients || []) {
    console.log(`\n${client.name}:`);
    console.log(`  • История: ${client.visit_history?.length || 0} записей`);
    console.log(`  • Услуги: ${client.last_services?.join(', ') || 'пусто'}`);
  }
}

fixSergeys().catch(console.error);