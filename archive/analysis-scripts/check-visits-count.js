const { supabase } = require('./src/database/supabase');

async function checkVisitsCount() {
  const { count } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Визитов в БД: ${count || 0}`);
  
  const { data: uniqueClients } = await supabase
    .from('visits')
    .select('client_id')
    .not('client_id', 'is', null);
  
  const unique = new Set(uniqueClients?.map(v => v.client_id)).size;
  console.log(`Клиентов с визитами: ${unique}`);
}

checkVisitsCount().catch(console.error);