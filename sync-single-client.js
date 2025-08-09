const axios = require('axios');
const { supabase } = require('./src/database/supabase');
require('dotenv').config();

async function syncSingleClient(yclientsId) {
  console.log(`🔧 Синхронизация клиента YClients ID: ${yclientsId}`);
  
  const bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
  const userToken = process.env.YCLIENTS_USER_TOKEN;
  const companyId = 962302;
  
  // Находим клиента в БД
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('yclients_id', yclientsId)
    .eq('company_id', companyId)
    .single();
  
  if (!client) {
    console.log('❌ Клиент не найден в БД');
    return;
  }
  
  console.log(`Найден: ${client.name}\n`);
  
  // Получаем визиты
  const url = `https://api.yclients.com/api/v1/records/${companyId}`;
  
  const response = await axios.get(url, {
    params: {
      client_id: yclientsId,
      start_date: '2023-01-01',
      end_date: '2025-12-31',
      include_finance_transactions: 1
    },
    headers: {
      'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
      'Accept': 'application/vnd.api.v2+json',
      'Content-Type': 'application/json'
    }
  });
  
  const records = response.data?.data || [];
  const clientRecords = records.filter(r => 
    String(r.client?.id) === String(yclientsId)
  );
  
  console.log(`Найдено ${clientRecords.length} визитов\n`);
  
  if (clientRecords.length === 0) return;
  
  // Сохраняем визиты
  const visitsToSave = clientRecords.map(record => ({
    yclients_visit_id: record.visit_id || null,
    yclients_record_id: record.id,
    company_id: companyId,
    client_id: client.id,
    client_yclients_id: yclientsId,
    client_phone: record.client?.phone?.replace(/\D/g, '').replace(/^8/, '7') || '',
    client_name: record.client?.name || client.name,
    staff_name: record.staff?.name || '',
    staff_yclients_id: record.staff?.id || null,
    service_names: (record.services || []).map(s => s.title || s.name),
    service_ids: (record.services || []).map(s => s.id),
    visit_date: record.date?.split(' ')[0] || record.date,
    visit_time: record.datetime ? record.datetime.split(' ')[1]?.substring(0, 5) : null,
    datetime: record.datetime || record.date,
    total_cost: record.cost || 0,
    paid_amount: record.paid_full || 0,
    status: 'completed'
  }));
  
  await supabase
    .from('visits')
    .upsert(visitsToSave, {
      onConflict: 'company_id,yclients_record_id',
      ignoreDuplicates: true
    });
  
  // Обновляем данные клиента
  const visitHistory = visitsToSave.slice(0, 50).map(v => ({
    date: v.visit_date,
    time: v.visit_time,
    services: v.service_names || []
  }));
  
  const lastServices = visitsToSave[0]?.service_names || [];
  
  await supabase
    .from('clients')
    .update({
      visit_history: visitHistory,
      last_services: lastServices
    })
    .eq('id', client.id);
  
  console.log(`✅ Синхронизировано ${visitsToSave.length} визитов`);
  console.log(`✅ Обновлены данные клиента`);
}

// Синхронизируем Дмитрия
syncSingleClient(208471717).catch(console.error);