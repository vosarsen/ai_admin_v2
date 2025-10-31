require('dotenv').config();
const { ServicesSync } = require('./src/sync/services-sync');

async function test() {
  console.log('🚀 Testing services sync with categories...\n');
  
  const sync = new ServicesSync();
  
  // Запускаем полную синхронизацию
  const result = await sync.sync();
  
  console.log('\n📊 Sync Results:');
  console.log('  Success:', result.success);
  console.log('  Processed:', result.processed);
  console.log('  Errors:', result.errors);
  console.log('  Duration:', result.duration + 'ms');
  
  // Проверяем результат в БД
  if (result.success) {
    const { supabase } = require('./src/database/supabase');
    
    const { data } = await supabase
      .from('services')
      .select('title, category_title')
      .eq('company_id', 962302)
      .not('category_title', 'is', null)
      .limit(5);
    
    console.log('\n✅ Services with categories in DB:');
    data?.forEach(s => {
      console.log(`  - ${s.title}: [${s.category_title}]`);
    });
    
    const { data: allServices } = await supabase
      .from('services')
      .select('category_title')
      .eq('company_id', 962302);
    
    const withCategories = allServices?.filter(s => s.category_title).length || 0;
    console.log(`\n📈 Total: ${withCategories}/${allServices?.length} services have categories`);
  }
}

test().catch(console.error);
