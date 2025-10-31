// test-phone-normalization.js
const InternationalPhone = require('./src/utils/international-phone');
const contextServiceV2 = require('./src/services/context/context-service-v2');

console.log('=== Тестирование нормализации в системе ===\n');

// Тестируем разные форматы для контекста
const testPhones = [
  '79001234567',           // Российский без +
  '+79001234567',          // Российский с +
  '8 900 123 45 67',       // Российский с 8
  '9001234567',            // Российский без кода
  '+16475883553',          // Канадский
  '16475883553@c.us',      // WhatsApp формат
  '+447012345678'          // Британский
];

testPhones.forEach(phone => {
  const normalized = InternationalPhone.normalize(phone);
  const key = contextServiceV2._normalizePhoneForKey(phone);
  
  console.log(`Телефон: ${phone}`);
  console.log(`  Normalized: ${normalized}`);
  console.log(`  Redis Key: context:${key}:962302`);
  console.log(`  Валидный: ${InternationalPhone.isValid(phone)}`);
  console.log('');
});

// Проверка equals для разных форматов
console.log('=== Проверка сравнения номеров ===');
const pairs = [
  ['+79001234567', '8 900 123 45 67'],
  ['79001234567@c.us', '9001234567'],
  ['+16475883553', '16475883553@c.us']
];

pairs.forEach(([phone1, phone2]) => {
  const equal = InternationalPhone.equals(phone1, phone2);
  console.log(`"${phone1}" == "${phone2}": ${equal}`);
});
