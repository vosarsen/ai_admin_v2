const { supabase } = require('./src/database/supabase');

async function checkClient() {
  // Проверяем Алексея
  const clientId = 1453;
  
  const { count: visitsCount } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId);
  
  const { data: clientData } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
  
  console.log(`Клиент: ${clientData?.name}`);
  console.log(`ID: ${clientId}`);
  console.log(`YClients ID: ${clientData?.yclients_id}`);
  console.log(`visit_count в clients: ${clientData?.visit_count}`);
  console.log(`Визитов в таблице visits: ${visitsCount || 0}`);
  console.log(`visit_history: ${clientData?.visit_history?.length || 0} записей`);
  console.log(`last_services: ${JSON.stringify(clientData?.last_services)}`);
  console.log(`favorite_staff_ids: ${JSON.stringify(clientData?.favorite_staff_ids)}`);
}

checkClient().catch(console.error);