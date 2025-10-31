require('dotenv').config();
const { ServicesSync } = require('./src/sync/services-sync');

async function test() {
  const sync = new ServicesSync();
  
  // Получаем услуги из YClients
  const services = await sync.fetchServices();
  
  console.log('Total services:', services.length);
  console.log('\nFirst 3 services structure from YClients API:');
  
  services.slice(0, 3).forEach((s, idx) => {
    console.log(`\nService ${idx + 1}:`);
    console.log('  title:', s.title);
    console.log('  category_id:', s.category_id);
    console.log('  category:', s.category);
    console.log('  Has category object:', !!s.category);
    if (s.category) {
      console.log('  Category structure:', JSON.stringify(s.category, null, 2));
    }
  });
  
  // Проверяем есть ли вообще категории
  const withCategories = services.filter(s => s.category && s.category.title);
  console.log(`\nServices with categories: ${withCategories.length} out of ${services.length}`);
  
  if (withCategories.length > 0) {
    console.log('\nExample category:', withCategories[0].category);
  }
}

test().catch(console.error);