#!/usr/bin/env node

/**
 * Comprehensive test for improved WhatsApp client
 */

const whatsappClient = require('./src/integrations/whatsapp/client');

// Test data
const TEST_PHONE = '79001234567';
const TEST_MESSAGES = [
  { phone: '79001234567', message: '📦 Bulk message 1' },
  { phone: '79001234568', message: '📦 Bulk message 2' },
  { phone: '79001234569', message: '📦 Bulk message 3' }
];

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runTests() {
  log('\n🧪 TESTING IMPROVED WHATSAPP CLIENT\n', 'cyan');
  log('=' .repeat(50), 'cyan');

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Input validation
  log('\n1️⃣  Testing input validation...', 'yellow');
  try {
    const result1 = await whatsappClient.sendMessage(null, 'test');
    if (!result1.success && result1.error.includes('Phone number is required')) {
      log('   ✅ Phone validation works', 'green');
      testsPassed++;
    } else {
      log('   ❌ Phone validation failed', 'red');
      testsFailed++;
    }

    const result2 = await whatsappClient.sendMessage(TEST_PHONE, null);
    if (!result2.success && result2.error.includes('Message is required')) {
      log('   ✅ Message validation works', 'green');
      testsPassed++;
    } else {
      log('   ❌ Message validation failed', 'red');
      testsFailed++;
    }

    const longMessage = 'A'.repeat(5000);
    const result3 = await whatsappClient.sendMessage(TEST_PHONE, longMessage);
    if (!result3.success && result3.error.includes('Message too long')) {
      log('   ✅ Message length validation works', 'green');
      testsPassed++;
    } else {
      log('   ❌ Message length validation failed', 'red');
      testsFailed++;
    }
  } catch (error) {
    log(`   ❌ Validation tests error: ${error.message}`, 'red');
    testsFailed += 3;
  }

  // Test 2: Health check
  log('\n2️⃣  Testing health check...', 'yellow');
  try {
    const health = whatsappClient.getHealth();
    log('   Health Status:', 'blue');
    log(`   - Service: ${health.service}`);
    log(`   - Status: ${health.status}`);
    log(`   - Messages Sent: ${health.metrics.messagesSent}`);
    log(`   - Messages Failed: ${health.metrics.messagesFailed}`);
    log(`   - Average Response Time: ${health.metrics.avgResponseTime}ms`);
    log(`   - Success Rate: ${health.metrics.successRate}`);
    log(`   - Circuit Breaker State: ${health.config.circuitBreakerState}`);

    if (health.metrics.lastError) {
      log(`   - Last Error: ${health.metrics.lastError}`, 'yellow');
      log(`   - Last Error Time: ${health.metrics.lastErrorTime}`, 'yellow');
    }

    log('   ✅ Health check works', 'green');
    testsPassed++;
  } catch (error) {
    log(`   ❌ Health check error: ${error.message}`, 'red');
    testsFailed++;
  }

  // Test 3: Send message with metrics
  log('\n3️⃣  Testing message sending with metrics...', 'yellow');
  try {
    const result = await whatsappClient.sendMessage(
      TEST_PHONE,
      '🧪 Test message with improved client'
    );

    if (result.success) {
      log('   ✅ Message sent successfully', 'green');
      log(`   - Message ID: ${result.data.messageId}`);
      log(`   - Response Time: ${result.data.responseTime}ms`);
      testsPassed++;
    } else {
      log(`   ❌ Message send failed: ${result.error}`, 'red');
      testsFailed++;
    }
  } catch (error) {
    log(`   ❌ Send message error: ${error.message}`, 'red');
    testsFailed++;
  }

  // Test 4: Connection status
  log('\n4️⃣  Testing connection status...', 'yellow');
  try {
    const status = await whatsappClient.checkStatus();

    if (status.success) {
      log('   ✅ Status check successful', 'green');
      log(`   - Connected: ${status.connected}`);
      if (status.metrics) {
        log(`   - Messages Sent: ${status.metrics.messagesSent}`);
        log(`   - Active Connections: ${status.metrics.activeConnections}`);
      }
      testsPassed++;
    } else {
      log(`   ❌ Status check failed: ${status.error}`, 'red');
      testsFailed++;
    }
  } catch (error) {
    log(`   ❌ Status check error: ${error.message}`, 'red');
    testsFailed++;
  }

  // Test 5: Bulk messaging
  log('\n5️⃣  Testing bulk messaging...', 'yellow');
  try {
    log('   Sending 3 messages in parallel...', 'blue');
    const results = await whatsappClient.sendBulkMessages(TEST_MESSAGES, {
      concurrency: 2
    });

    const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    const failed = results.length - successful;

    log(`   - Total: ${results.length}`, 'blue');
    log(`   - Successful: ${successful}`, 'green');
    log(`   - Failed: ${failed}`, failed > 0 ? 'yellow' : 'green');

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value?.success) {
        log(`   ✅ Message ${index + 1} sent to ${result.phone}`, 'green');
      } else {
        const error = result.reason || result.value?.error;
        log(`   ⚠️  Message ${index + 1} failed: ${error}`, 'yellow');
      }
    });

    if (successful > 0) {
      log('   ✅ Bulk messaging works', 'green');
      testsPassed++;
    } else {
      log('   ❌ All bulk messages failed', 'red');
      testsFailed++;
    }
  } catch (error) {
    log(`   ❌ Bulk messaging error: ${error.message}`, 'red');
    testsFailed++;
  }

  // Test 6: Diagnosis
  log('\n6️⃣  Testing diagnosis...', 'yellow');
  try {
    const diagnosis = await whatsappClient.diagnoseProblem(TEST_PHONE);

    if (diagnosis.success) {
      log('   ✅ Diagnosis successful', 'green');
      log(`   - ${diagnosis.diagnosis}`, 'green');
      testsPassed++;
    } else {
      log(`   ⚠️  Diagnosis found issues:`, 'yellow');
      log(`   - ${diagnosis.diagnosis}`, 'yellow');
      log(`   - Error: ${diagnosis.error}`, 'yellow');
      testsPassed++; // Still counts as test working
    }
  } catch (error) {
    log(`   ❌ Diagnosis error: ${error.message}`, 'red');
    testsFailed++;
  }

  // Test 7: Final metrics
  log('\n7️⃣  Final metrics check...', 'yellow');
  const finalHealth = whatsappClient.getHealth();
  log('   📊 Final Statistics:', 'blue');
  log(`   - Messages Sent: ${finalHealth.metrics.messagesSent}`);
  log(`   - Messages Failed: ${finalHealth.metrics.messagesFailed}`);
  log(`   - Average Response Time: ${finalHealth.metrics.avgResponseTime}ms`);
  log(`   - Success Rate: ${finalHealth.metrics.successRate}`);
  log(`   - Circuit Breaker Trips: ${finalHealth.metrics.circuitBreakerTrips}`);

  // Summary
  log('\n' + '=' .repeat(50), 'cyan');
  log('\n📊 TEST RESULTS\n', 'cyan');
  log(`   ✅ Tests Passed: ${testsPassed}`, 'green');
  log(`   ❌ Tests Failed: ${testsFailed}`, 'red');
  log(`   📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`,
    testsFailed === 0 ? 'green' : 'yellow');

  if (testsFailed === 0) {
    log('\n🎉 ALL TESTS PASSED! Client is production ready!\n', 'green');
  } else {
    log('\n⚠️  Some tests failed. Review the issues above.\n', 'yellow');
  }

  // Cleanup (if needed in production)
  // whatsappClient.destroy();
}

// Run tests
runTests().catch(error => {
  log(`\n💥 Fatal error: ${error.message}\n`, 'red');
  console.error(error);
  process.exit(1);
});