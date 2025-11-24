/**
 * GlitchTip Performance Test Script
 * Sends 100 errors to test error capture under load
 */

const Sentry = require('@sentry/node');

// Initialize Sentry with GlitchTip DSN
Sentry.init({
  dsn: 'http://a7a6528779f148d68ac5b3079aabfd2e@localhost:8080/1',
  environment: 'performance-test',
  tracesSampleRate: 0,
  profilesSampleRate: 0,
});

async function sendError(index) {
  try {
    throw new Error(`Performance Test Error #${index}`);
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        test: 'performance',
        batch: Math.floor(index / 10).toString(),
      },
      extra: {
        errorNumber: index,
        timestamp: new Date().toISOString(),
      },
      level: 'error',
    });
  }
}

async function main() {
  console.log('🚀 Starting performance test...');
  console.log(`📊 Sending 100 errors to GlitchTip`);
  console.log(`⏰ Start time: ${new Date().toISOString()}\n`);

  const startTime = Date.now();

  // Send 100 errors in batches of 10
  for (let batch = 0; batch < 10; batch++) {
    console.log(`📦 Batch ${batch + 1}/10 (errors ${batch * 10 + 1}-${(batch + 1) * 10})...`);

    const promises = [];
    for (let i = 0; i < 10; i++) {
      const errorIndex = batch * 10 + i + 1;
      promises.push(sendError(errorIndex));
    }

    await Promise.all(promises);

    // Small delay between batches to avoid overwhelming
    if (batch < 9) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Wait for all errors to be sent
  await Sentry.close(2000);

  const duration = Date.now() - startTime;

  console.log(`\n✅ Performance test complete!`);
  console.log(`📊 Total errors sent: 100`);
  console.log(`⏱️  Total duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
  console.log(`📈 Rate: ${(100 / (duration / 1000)).toFixed(2)} errors/sec`);
  console.log(`⏰ End time: ${new Date().toISOString()}`);
  console.log(`\n💡 Now check GlitchTip UI at http://localhost:8080 to verify all errors captured`);
}

main().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
