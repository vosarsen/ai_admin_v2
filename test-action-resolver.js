// Simple test for ActionResolver logic
const ActionResolver = require('./src/services/nlu/action-resolver');

const actionResolver = new ActionResolver();

console.log('Testing ActionResolver logic...\n');

// Test 1: Time preference should trigger search_slots
const test1 = {
  intent: 'booking',
  entities: {
    date: '2025-07-10',
    time: '18:00',
    staff: 'Рамзан',
    time_preference: 'evening'
  }
};

console.log('Test 1: With time_preference');
console.log('Input:', JSON.stringify(test1, null, 2));
const action1 = actionResolver.determineAction(test1);
console.log('Action:', action1);
console.log(action1 === 'search_slots' ? '✅ PASS' : '❌ FAIL');

console.log('\n---\n');

// Test 2: Without time_preference, valid time format
const test2 = {
  intent: 'booking',
  entities: {
    date: '2025-07-10',
    time: '16:00',
    staff: 'Бари'
  }
};

console.log('Test 2: Without time_preference, valid time');
console.log('Input:', JSON.stringify(test2, null, 2));
const action2 = actionResolver.determineAction(test2);
console.log('Action:', action2);
console.log(action2 === 'create_booking' ? '✅ PASS' : '❌ FAIL');

console.log('\n---\n');

// Test 3: Invalid time format
const test3 = {
  intent: 'booking',
  entities: {
    date: '2025-07-10',
    time: 'вечером',
    staff: 'Рамзан'
  }
};

console.log('Test 3: Invalid time format');
console.log('Input:', JSON.stringify(test3, null, 2));
const action3 = actionResolver.determineAction(test3);
console.log('Action:', action3);
console.log(action3 === 'search_slots' ? '✅ PASS' : '❌ FAIL');