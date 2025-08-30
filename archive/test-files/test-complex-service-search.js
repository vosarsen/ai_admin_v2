const serviceMatcher = require('./src/services/ai-admin-v2/modules/service-matcher');

// Тестовые услуги
const services = [
  { id: 1, yclients_id: 18356261, title: 'СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ', price_min: 3800 },
  { id: 2, yclients_id: 15031274, title: 'ВОСК КОМПЛЕКС', price_min: 900 },
  { id: 3, yclients_id: 15031276, title: 'КОМПЛЕКСНЫЙ УХОД ЗА КОЖЕЙ ГОЛОВЫ | LUXINA', price_min: 1500 },
  { id: 4, yclients_id: 18356010, title: 'МУЖСКАЯ СТРИЖКА', price_min: 2000 },
  { id: 5, yclients_id: 18356349, title: 'СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ | LUXINA', price_min: 4000 },
];

console.log('\n=== Тест поиска по слову "комплекс" ===\n');

const result = serviceMatcher.findBestMatch('комплекс', services);

if (result) {
  console.log('✅ Найдена услуга:', result.title);
  console.log('   ID:', result.yclients_id);
  console.log('   Цена:', result.price_min, 'руб');
} else {
  console.log('❌ Услуга не найдена');
}

console.log('\n=== Детальные оценки для каждой услуги ===\n');

services.forEach(service => {
  const score = serviceMatcher.calculateMatchScore('комплекс', service);
  console.log(`${service.title}: ${score} баллов`);
});

console.log('\n=== Тест других запросов ===\n');

const testQueries = [
  'стрижка',
  'борода',
  'стрижка и борода',
  'полный комплекс',
  'все включено'
];

testQueries.forEach(query => {
  const result = serviceMatcher.findBestMatch(query, services);
  console.log(`"${query}" → ${result ? result.title : 'НЕ НАЙДЕНО'}`);
});