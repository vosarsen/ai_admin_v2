// test-international-phone.js
const InternationalPhone = require('./src/utils/international-phone');

console.log('=== Тестирование международных номеров ===\n');

const testCases = [
  // Российские номера
  '+7 900 123 45 67',
  '8 900 123 45 67',
  '9001234567',
  '79001234567',
  '+79001234567',
  
  // Международные номера
  '+1 647 588 3553',  // Канада
  '+44 20 1234 5678',  // UK
  '+49 30 12345678',   // Германия
  '+33 1 23 45 67 89', // Франция
  '+972 50 123 4567',  // Израиль
  
  // WhatsApp формат
  '79001234567@c.us',
  '16475883553@c.us',
];

console.log('Нормализация номеров:');
testCases.forEach(phone => {
  const normalized = InternationalPhone.normalize(phone);
  const formatted = InternationalPhone.format(phone);
  const country = InternationalPhone.getCountry(phone);
  const isRussian = InternationalPhone.isRussian(phone);
  const whatsapp = InternationalPhone.formatForWhatsApp(phone);
  
  console.log(`\nИсходный: ${phone}`);
  console.log(`  Нормализован: ${normalized}`);
  console.log(`  Форматирован: ${formatted}`);
  console.log(`  Страна: ${country}`);
  console.log(`  Российский: ${isRussian}`);
  console.log(`  WhatsApp: ${whatsapp}`);
});

console.log('\n=== Проверка равенства ===');
console.log('"+7 900 123 45 67" == "8 900 123 45 67":', 
  InternationalPhone.equals('+7 900 123 45 67', '8 900 123 45 67'));
console.log('"9001234567" == "+7 (900) 123-45-67":', 
  InternationalPhone.equals('9001234567', '+7 (900) 123-45-67'));
console.log('"+1 647 588 3553" == "16475883553@c.us":', 
  InternationalPhone.equals('+1 647 588 3553', '16475883553@c.us'));