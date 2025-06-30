// scripts/simulate-messages.js
/**
 * Simulate WhatsApp messages for testing
 */

const axios = require('axios');
const config = require('../src/config');

const API_URL = `http://localhost:${config.app.port}`;

const testMessages = [
  {
    from: '79123456789@c.us',
    message: 'Здравствуйте! Хочу записаться на стрижку',
    name: 'Иван'
  },
  {
    from: '79234567890@c.us', 
    message: 'Добрый день! Когда можно сделать маникюр у Марины?',
    name: 'Елена'
  },
  {
    from: '79345678901@c.us',
    message: 'Сколько стоит окрашивание волос?',
    name: 'Ольга'
  },
  {
    from: '79456789012@c.us',
    message: 'Можно записаться к Саше на завтра в 15:00?',
    name: 'Петр'
  },
  {
    from: '79567890123@c.us',
    message: 'Хочу отменить свою запись',
    name: 'Анна'
  }
];

async function simulateMessage(testCase) {
  try {
    console.log(`\n📱 Sending from ${testCase.name}: "${testCase.message}"`);
    
    const response = await axios.post(`${API_URL}/webhook/whatsapp`, {
      from: testCase.from,
      message: testCase.message,
      timestamp: new Date().toISOString()
    });
    
    if (response.data.success) {
      console.log(`✅ Queued successfully: Job ${response.data.jobId}`);
    } else {
      console.log(`❌ Failed to queue message`);
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

async function runSimulation() {
  console.log('🎭 WhatsApp Message Simulation');
  console.log('==============================\n');
  
  // Check if API is running
  try {
    const health = await axios.get(`${API_URL}/health`);
    console.log(`✅ API is ${health.data.status}\n`);
  } catch (error) {
    console.error('❌ API is not running. Please start it first.');
    process.exit(1);
  }
  
  // Send messages with delay
  for (const testCase of testMessages) {
    await simulateMessage(testCase);
    
    // Wait 3 seconds between messages
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('\n✅ Simulation completed!');
  console.log('Check worker logs to see processing results.');
}

// Command line arguments
const args = process.argv.slice(2);

if (args[0] === '--single') {
  // Send single custom message
  const phone = args[1] || '79999999999@c.us';
  const message = args[2] || 'Тестовое сообщение';
  
  simulateMessage({ from: phone, message, name: 'CLI User' })
    .then(() => process.exit(0));
} else {
  // Run full simulation
  runSimulation();
}