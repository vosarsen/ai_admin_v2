#!/usr/bin/env node
// test-rate-limiting.js - Тест Rate Limiter и Rapid-Fire Protection

const express = require('express');
const rateLimiter = require('./src/middlewares/rate-limiter');
const rapidFireProtection = require('./src/services/rapid-fire-protection');

async function testRateLimiting() {
  console.log('🛡️ Testing Rate Limiting + Rapid-Fire Protection...\n');

  // Создаем простой Express сервер для тестирования
  const app = express();
  app.use(express.json());
  app.use(rateLimiter);

  app.post('/webhook/whatsapp', (req, res) => {
    res.json({ success: true, message: 'Request processed' });
  });

  const server = app.listen(0, () => {
    const port = server.address().port;
    console.log(`🚀 Test server started on port ${port}\n`);
  });

  try {
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    // Тест 1: Нормальные запросы
    console.log('📝 Test 1: Normal requests (should pass)');
    for (let i = 0; i < 5; i++) {
      const response = await fetch(`${baseUrl}/webhook/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: '79999999999@c.us',
          message: `Test message ${i + 1}`
        })
      });
      
      console.log(`Request ${i + 1}: ${response.status} ${response.statusText}`);
      
      if (i < 4) await new Promise(resolve => setTimeout(resolve, 200)); // Небольшая пауза
    }

    // Тест 2: Burst protection
    console.log('\n🔥 Test 2: Burst protection (6 requests in 1 second)');
    const burstPromises = [];
    for (let i = 0; i < 6; i++) {
      burstPromises.push(
        fetch(`${baseUrl}/webhook/whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: '79999999998@c.us',
            message: `Burst message ${i + 1}`
          })
        })
      );
    }
    
    const burstResults = await Promise.all(burstPromises);
    burstResults.forEach((response, i) => {
      const status = response.status === 429 ? '🚫 BLOCKED' : '✅ PASSED';
      console.log(`Burst ${i + 1}: ${response.status} ${status}`);
    });

    // Тест 3: Rapid-Fire Protection
    console.log('\n🔥 Test 3: Rapid-Fire Protection');
    
    let messagesProcessed = 0;
    const testPhone = '79999999997';
    
    // Mock callback для тестирования
    const mockCallback = async (combinedMessage, metadata) => {
      messagesProcessed++;
      console.log(`📦 Processed batch ${messagesProcessed}:`, {
        message: combinedMessage.substring(0, 50) + '...',
        isRapidFire: metadata.isRapidFireBatch || false,
        originalCount: metadata.originalMessagesCount || 1,
        waitTime: metadata.totalWaitTime || 0
      });
    };

    // Отправляем rapid-fire сообщения
    console.log('Sending 5 rapid messages...');
    rapidFireProtection.processMessage(testPhone, 'Первое сообщение', mockCallback);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    rapidFireProtection.processMessage(testPhone, 'Второе сообщение', mockCallback);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    rapidFireProtection.processMessage(testPhone, 'Третье сообщение', mockCallback);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    rapidFireProtection.processMessage(testPhone, 'Четвертое сообщение', mockCallback);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    rapidFireProtection.processMessage(testPhone, 'Пятое сообщение', mockCallback);

    // Ждем обработки
    console.log('Waiting for rapid-fire processing...');
    await new Promise(resolve => setTimeout(resolve, 6000));

    // Тест 4: Статистика
    console.log('\n📊 Test 4: Statistics');
    
    const rapidFireStats = rapidFireProtection.getStats();
    console.log('Rapid-Fire Stats:', {
      pendingBatches: rapidFireStats.pendingBatches,
      totalPendingMessages: rapidFireStats.totalPendingMessages
    });

    // Тест 5: Единичное сообщение (должно обработаться сразу)
    console.log('\n⚡ Test 5: Single message (should process immediately)');
    const singleStart = Date.now();
    rapidFireProtection.processMessage('79999999996', 'Одиночное сообщение', async (msg, meta) => {
      const time = Date.now() - singleStart;
      console.log(`Single message processed in ${time}ms`);
    });

    // Ждем немного для single message
    await new Promise(resolve => setTimeout(resolve, 6000));

    console.log('\n✅ Rate limiting tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    server.close();
    await rapidFireProtection.flushAll();
  }
}

// Helper function для fetch (если нет глобально)
async function fetch(url, options) {
  const https = require('https');
  const http = require('http');
  const { URL } = require('url');
  
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = protocol.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          json: () => Promise.resolve(JSON.parse(data || '{}'))
        });
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Запуск теста
if (require.main === module) {
  testRateLimiting().then(() => {
    console.log('\n🎉 All rate limiting tests completed!');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Rate limiting test suite failed:', error);
    process.exit(1);
  });
}

module.exports = testRateLimiting;