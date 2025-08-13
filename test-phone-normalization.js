#!/usr/bin/env node

const { normalizePhone } = require('./src/utils/phone-normalizer');

// Тестируем различные форматы номеров
const testPhones = [
  '79163779444@c.us',
  '79163779444',
  '+79163779444',
  '89163779444',
  '+7 (916) 377-94-44',
  '8-916-377-94-44',
  '@c.us',
  '+',
  ''
];

console.log('Testing phone normalization:\n');
console.log('Input'.padEnd(30), '→', 'Normalized');
console.log('-'.repeat(50));

testPhones.forEach(phone => {
  try {
    const normalized = normalizePhone(phone);
    console.log(phone.padEnd(30), '→', normalized);
  } catch (error) {
    console.log(phone.padEnd(30), '→', 'ERROR:', error.message);
  }
});

// Тестируем конкретный случай
console.log('\n\nSpecific test case:');
const venom = '79163779444@c.us';
const normalized = normalizePhone(venom);
console.log(`Venom format: "${venom}"`);
console.log(`Normalized: "${normalized}"`);
console.log(`Length: ${normalized.length}`);
console.log(`Starts with +: ${normalized.startsWith('+')}`);
console.log(`Contains only digits and +: ${/^\+\d+$/.test(normalized)}`);