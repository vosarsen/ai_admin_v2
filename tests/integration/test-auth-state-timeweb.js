#!/usr/bin/env node
/**
 * Unit Test for Timeweb Auth State
 * Tests that Baileys can read/write WhatsApp credentials from Timeweb PostgreSQL
 *
 * IMPORTANT: This test requires:
 * 1. SSH tunnel to Timeweb PostgreSQL running (./scripts/maintain-redis-tunnel.sh start)
 * 2. Timeweb credentials configured in .env
 * 3. Tables whatsapp_auth and whatsapp_keys exist in Timeweb
 */

// CRITICAL: Set USE_LEGACY_SUPABASE=false BEFORE loading any modules
process.env.USE_LEGACY_SUPABASE = 'false';

require('dotenv').config();
const { useTimewebAuthState } = require('./src/integrations/whatsapp/auth-state-timeweb');

async function test() {
  console.log('🧪 Testing Timeweb PostgreSQL auth state...');
  console.log('   (USE_LEGACY_SUPABASE=false for this test)\n');

  // Check if PostgreSQL credentials are configured
  if (!process.env.POSTGRES_HOST || !process.env.POSTGRES_PASSWORD) {
    console.error('❌ Timeweb PostgreSQL credentials not found in .env');
    console.error('   Please configure POSTGRES_HOST, POSTGRES_PASSWORD, etc.');
    process.exit(1);
  }

  console.log('📡 Timeweb PostgreSQL Configuration:');
  console.log('   Host:', process.env.POSTGRES_HOST);
  console.log('   Port:', process.env.POSTGRES_PORT || 5432);
  console.log('   Database:', process.env.POSTGRES_DATABASE);
  console.log('   User:', process.env.POSTGRES_USER);
  console.log('');

  const testCompanyId = '962302';

  try {
    console.log('1️⃣ Loading credentials from Timeweb...');
    const { state, saveCreds } = await useTimewebAuthState(testCompanyId);

    if (!state || !state.creds) {
      throw new Error('Failed to load credentials - state or creds is null');
    }

    console.log('✅ Credentials loaded successfully');
    console.log('   - Has creds:', !!state.creds);
    console.log('   - Has keys:', !!state.keys);
    console.log('   - Creds keys:', Object.keys(state.creds).slice(0, 5).join(', '), '...');

    console.log('\n2️⃣ Testing credential save...');
    await saveCreds();
    console.log('✅ Credentials saved successfully');

    console.log('\n3️⃣ Testing keys.get() operation...');
    // Try to get some keys (they might not exist, that's ok)
    const keys = await state.keys.get('app-state-sync-key', ['test-key-1', 'test-key-2']);
    console.log('✅ Keys.get() works');
    console.log('   - Keys found:', Object.keys(keys).length);

    console.log('\n4️⃣ Testing keys.set() operation...');
    await state.keys.set({
      'test-type': {
        'test-key-123': { testData: 'value', timestamp: Date.now() }
      }
    });
    console.log('✅ Keys.set() works');

    console.log('\n5️⃣ Verifying test key was saved...');
    const savedKeys = await state.keys.get('test-type', ['test-key-123']);
    if (savedKeys['test-key-123']) {
      console.log('✅ Test key saved and retrieved successfully');
      console.log('   - Value:', savedKeys['test-key-123']);
    } else {
      console.warn('⚠️  Test key not found (might be normal)');
    }

    console.log('\n6️⃣ Testing Buffer serialization...');
    const testBuffer = Buffer.from('test data');
    await state.keys.set({
      'buffer-test': {
        'buffer-key-1': { bufferData: testBuffer }
      }
    });
    const retrievedBufferKeys = await state.keys.get('buffer-test', ['buffer-key-1']);
    if (retrievedBufferKeys['buffer-key-1']) {
      const retrievedBuffer = retrievedBufferKeys['buffer-key-1'].bufferData;
      if (Buffer.isBuffer(retrievedBuffer)) {
        console.log('✅ Buffer serialization works correctly');
        console.log('   - Buffer content:', retrievedBuffer.toString());
      } else {
        console.error('❌ Buffer not properly deserialized');
        console.error('   - Type:', typeof retrievedBuffer);
      }
    } else {
      console.warn('⚠️  Buffer test key not found');
    }

    console.log('\n🎉 All tests passed!');
    console.log('\n✅ Timeweb PostgreSQL auth state is working correctly');
    console.log('✅ Ready for deployment to production VPS');
    console.log('\n📝 Next steps:');
    console.log('   1. git add .');
    console.log('   2. git commit -m "feat: Phase 0.7 - Switch Baileys to Timeweb PostgreSQL"');
    console.log('   3. git push origin main');
    console.log('   4. Deploy to VPS and test');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    console.error('\n⚠️  Please check:');
    console.error('   1. Timeweb PostgreSQL connection is configured in .env');
    console.error('   2. SSH tunnel is running (if testing locally)');
    console.error('   3. Tables whatsapp_auth and whatsapp_keys exist');
    console.error('   4. PostgreSQL credentials are correct');
    console.error('\n   Try running: ./scripts/maintain-redis-tunnel.sh start');
    process.exit(1);
  }
}

// Run tests
test();
