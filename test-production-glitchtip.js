/**
 * GlitchTip Production Test Script
 * Sends test error to production GlitchTip instance
 */

const Sentry = require('@sentry/node');

// Initialize Sentry with Production GlitchTip DSN
Sentry.init({
  dsn: 'http://90eb81e7cd8b4a53b3bd5076d499047e@46.149.70.219:8080/1',
  environment: 'production-test',
  tracesSampleRate: 0,
  profilesSampleRate: 0,
});

async function sendProductionTest() {
  console.log('🚀 Testing Production GlitchTip...');
  console.log(`📊 DSN: http://90eb81e7cd8b4a53b3bd5076d499047e@46.149.70.219:8080/1`);
  console.log(`⏰ Time: ${new Date().toISOString()}\n`);

  try {
    throw new Error('Production GlitchTip Test Error - Phase 2 Deployment Verification');
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        test: 'production-deployment',
        phase: 'phase-2',
        component: 'verification',
      },
      extra: {
        timestamp: new Date().toISOString(),
        deployment: 'production',
        server: '46.149.70.219',
      },
      level: 'info',
    });
  }

  // Wait for error to be sent
  await Sentry.close(2000);

  console.log(`✅ Test error sent to production GlitchTip!`);
  console.log(`\n💡 Check GlitchTip UI at: http://localhost:9090`);
  console.log(`   (or via tunnel: http://46.149.70.219:8080)`);
}

sendProductionTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
