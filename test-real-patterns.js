// Test real error handling patterns from AI Admin v2 codebase
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: 'http://a7a6528779f148d68ac5b3079aabfd2e@localhost:8080/1',
  environment: 'test',
  release: 'test@1.0.0',
});

console.log('🧪 Testing real code patterns from AI Admin v2...\n');

// Pattern 1: Database error (from src/database/postgres.js)
async function testDatabaseError() {
  console.log('Pattern 1: Database error (postgres.js)');
  try {
    throw new Error('ECONNREFUSED - Database connection failed');
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        component: 'database',
        operation: 'connect',
        backend: 'postgres',
      },
      extra: {
        host: 'a84c973324fdaccfc68d929d.twc1.net',
        port: 5432,
        database: 'default_db',
        attemptNumber: 3,
      },
    });
  }
}

// Pattern 2: Repository error (from src/repositories/BaseRepository.js)
async function testRepositoryError() {
  console.log('Pattern 2: Repository error (BaseRepository.js)');
  try {
    throw new Error('Unique constraint violation: duplicate key value');
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        repository: 'ClientRepository',
        operation: 'upsert',
        backend: 'postgres',
      },
      extra: {
        filters: { phone: '79001234567' },
        data: {
          name: 'Test Client',
          phone: '79001234567',
        },
      },
    });
  }
}

// Pattern 3: WhatsApp error (from src/integrations/whatsapp/auth-state-timeweb.js)
async function testWhatsAppError() {
  console.log('Pattern 3: WhatsApp error (auth-state-timeweb.js)');
  try {
    throw new Error('Session not found in PostgreSQL for company 962302');
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        component: 'whatsapp',
        subcomponent: 'auth-state',
        companyId: '962302',
        backend: 'postgres',
      },
      extra: {
        sessionId: 'baileys-962302',
        action: 'getCreds',
      },
    });
  }
}

// Pattern 4: Service error with nested data
async function testServiceError() {
  console.log('Pattern 4: Service error (complex nested data)');
  try {
    throw new Error('Failed to process booking notification');
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        service: 'booking-monitor',
        operation: 'sendReminder',
        backend: 'postgres',
      },
      extra: {
        booking: {
          id: 12345,
          clientPhone: '79001234567',
          serviceTitle: 'Стрижка',
          datetime: '2025-11-25T10:00:00Z',
        },
        attempts: 3,
        lastError: 'WhatsApp client not connected',
      },
    });
  }
}

// Pattern 5: Queue worker error
async function testQueueError() {
  console.log('Pattern 5: Queue worker error (BullMQ)');
  try {
    throw new Error('Job processing failed: Invalid message format');
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        component: 'queue',
        queue: 'whatsapp-messages',
        jobId: 'msg-12345',
      },
      extra: {
        job: {
          id: 'msg-12345',
          attemptsMade: 2,
          maxAttempts: 3,
        },
        messageData: {
          phone: '79001234567',
          text: 'Test message',
        },
      },
    });
  }
}

// Run all tests
(async () => {
  await testDatabaseError();
  await testRepositoryError();
  await testWhatsAppError();
  await testServiceError();
  await testQueueError();

  setTimeout(() => {
    console.log('\n✅ All 5 real pattern tests sent to GlitchTip!');
    console.log('📊 Check GlitchTip UI: http://localhost:8080');
    console.log('   You should see 5 new errors with production-like patterns.');
    console.log('\n🔍 Verify:');
    console.log('   - Tags are grouped correctly (component, operation, etc.)');
    console.log('   - Extra data is displayed properly');
    console.log('   - Errors are easy to identify and triage');
    process.exit(0);
  }, 2000);
})();
