require('dotenv').config();
const { ServicesSync } = require('./src/sync/services-sync');

async function test() {
  console.log('🔄 Testing repeated sync...\n');
  
  const sync = new ServicesSync();
  
  // Запуск 1
  console.log('📌 First sync:');
  const result1 = await sync.sync();
  console.log(`  ✅ Processed: ${result1.processed} services in ${result1.duration}ms`);
  
  // Пауза
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Запуск 2
  console.log('\n📌 Second sync:');
  const result2 = await sync.sync();
  console.log(`  ✅ Processed: ${result2.processed} services in ${result2.duration}ms`);
  
  // Проверяем в БД
  const { supabase } = require('./src/database/supabase');
  const { data } = await supabase
    .from('services')
    .select('category_title')
    .eq('company_id', 962302)
    .not('category_title', 'is', null);
  
  console.log(`\n📊 Result: ${data?.length}/45 services have categories`);
}

test().catch(console.error);
