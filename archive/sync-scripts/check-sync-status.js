const { supabase } = require('./src/database/supabase');

async function checkSyncStatus() {
  console.log('\n📊 СТАТУС СИНХРОНИЗАЦИИ');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Общая статистика
  const { count: totalClients } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 962302);
  
  const { count: totalVisits } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true });
  
  // Клиенты с данными
  const { data: clientsWithHistory } = await supabase
    .from('clients')
    .select('id')
    .eq('company_id', 962302)
    .not('visit_history', 'eq', '[]')
    .not('visit_history', 'is', null);
  
  const { data: clientsWithServices } = await supabase
    .from('clients')
    .select('id')
    .eq('company_id', 962302)
    .not('last_services', 'eq', '[]')
    .not('last_services', 'is', null);
  
  const withHistory = clientsWithHistory?.length || 0;
  const withServices = clientsWithServices?.length || 0;
  
  console.log('📈 РЕЗУЛЬТАТЫ:');
  console.log(`  • Всего клиентов: ${totalClients}`);
  console.log(`  • Всего визитов: ${totalVisits}`);
  console.log(`  • Клиентов с историей: ${withHistory} (${Math.round(withHistory/totalClients*100)}%)`);
  console.log(`  • Клиентов с услугами: ${withServices} (${Math.round(withServices/totalClients*100)}%)`);
  console.log('');
  
  // Проверяем топ клиентов
  const { data: topClients } = await supabase
    .from('clients')
    .select('name, visit_count, visit_history, last_services')
    .eq('company_id', 962302)
    .order('visit_count', { ascending: false })
    .limit(10);
  
  console.log('🏆 ТОП-10 КЛИЕНТОВ:');
  for (const client of topClients || []) {
    const hasData = client.visit_history && client.visit_history.length > 0;
    const icon = hasData ? '✅' : '❌';
    const services = client.last_services?.join(', ') || 'пусто';
    console.log(`  ${icon} ${client.name}: ${client.visit_count} визитов`);
    console.log(`      История: ${client.visit_history?.length || 0}, Услуги: ${services}`);
  }
  
  // Проверяем процесс синхронизации
  const { data: recentVisits } = await supabase
    .from('visits')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (recentVisits && recentVisits[0]) {
    const lastSync = new Date(recentVisits[0].created_at);
    const now = new Date();
    const diffMinutes = Math.round((now - lastSync) / 1000 / 60);
    
    console.log(`\n⏰ Последняя синхронизация: ${diffMinutes} минут назад`);
    
    if (diffMinutes < 2) {
      console.log('   🔄 Синхронизация еще идет...');
    } else {
      console.log('   ✅ Синхронизация завершена');
    }
  }
}

checkSyncStatus().catch(console.error);