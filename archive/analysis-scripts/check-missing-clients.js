const { supabase } = require('./src/database/supabase');

async function checkMissingClients() {
  console.log('\n🔍 ПРОВЕРКА КЛИЕНТОВ БЕЗ ДАННЫХ');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Находим клиентов с visit_count > 10 но без истории
  const { data: problemClients } = await supabase
    .from('clients')
    .select('id, yclients_id, name, visit_count')
    .eq('company_id', 962302)
    .gt('visit_count', 10)
    .or('visit_history.is.null,visit_history.eq.[]')
    .order('visit_count', { ascending: false })
    .limit(20);
  
  console.log(`Найдено ${problemClients?.length || 0} клиентов с visit_count > 10, но без истории:\n`);
  
  for (const client of problemClients || []) {
    console.log(`${client.name}: ${client.visit_count} визитов`);
    console.log(`  ID: ${client.id}, YClients: ${client.yclients_id || 'НЕТ'}`);
    
    // Проверяем есть ли визиты в таблице visits
    const { count } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id);
    
    console.log(`  Визитов в таблице visits: ${count || 0}`);
    
    if (!client.yclients_id) {
      console.log(`  ❌ Нет yclients_id - невозможно синхронизировать!`);
    }
    console.log('');
  }
  
  // Общая статистика
  const { count: totalWithoutData } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 962302)
    .gt('visit_count', 0)
    .or('visit_history.is.null,visit_history.eq.[]');
  
  const { count: totalWithoutYclientsId } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 962302)
    .gt('visit_count', 0)
    .is('yclients_id', null);
  
  console.log('📊 СТАТИСТИКА:');
  console.log(`  • Клиентов с visit_count > 0 без истории: ${totalWithoutData}`);
  console.log(`  • Из них без yclients_id: ${totalWithoutYclientsId}`);
  console.log('\n💡 Клиенты без yclients_id не могут быть синхронизированы!');
}

checkMissingClients().catch(console.error);