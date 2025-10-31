require('dotenv').config();
const { supabase } = require('./src/database/supabase');

async function checkStats() {
  // Общее количество клиентов
  const { count: totalClients } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true });
    
  // Клиенты с total_spent > 0
  const { count: clientsWithSpent } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .gt('total_spent', 0);
    
  // Клиенты по уровням лояльности
  const { data: loyaltyStats } = await supabase
    .from('clients')
    .select('loyalty_level')
    .gt('total_spent', 0);
    
  const loyaltyCounts = {};
  loyaltyStats.forEach(c => {
    loyaltyCounts[c.loyalty_level] = (loyaltyCounts[c.loyalty_level] || 0) + 1;
  });
  
  console.log('📊 СТАТИСТИКА КЛИЕНТОВ ПОСЛЕ СИНХРОНИЗАЦИИ');
  console.log('=' .repeat(50));
  console.log('Всего клиентов: ' + totalClients);
  console.log('С покупками (total_spent > 0): ' + clientsWithSpent + ' (' + Math.round(clientsWithSpent/totalClients*100) + '%)');
  console.log('Без покупок: ' + (totalClients - clientsWithSpent));
  console.log('\n💎 Распределение по уровням лояльности:');
  Object.entries(loyaltyCounts).forEach(([level, count]) => {
    console.log('  ' + level + ': ' + count + ' клиентов');
  });
}

checkStats().catch(console.error);
