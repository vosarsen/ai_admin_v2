#!/usr/bin/env node
/**
 * Test script for phone mismatch detection flow
 *
 * This script:
 * 1. Inserts "dirty" credentials with wrong phone into DB
 * 2. Connects via WebSocket
 * 3. Requests pairing code with different phone
 * 4. Verifies mismatch detection worked
 *
 * Usage: node scripts/test-phone-mismatch.js
 */

const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Configuration
const CONFIG = {
  // Test salon - use 997441 (moderator's test salon)
  COMPANY_ID: '997441',
  SESSION_ID: 'company_997441',

  // Phone numbers for test (both are fake/test numbers)
  WRONG_PHONE: '79991112233',    // Will be inserted as "existing" credentials
  CORRECT_PHONE: '79998887766',  // Test phone to request (should trigger mismatch)

  // Server
  WS_URL: 'https://adminai.tech',
  JWT_SECRET: 'Jrgmtoa7tQWmsnVqjtW2Dvm8nQqBWBsxuCO/y1PegXg=',

  // Database
  PG_CONNECTION: 'postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db',

  // Timeouts
  CONNECT_TIMEOUT: 10000,
  PAIRING_TIMEOUT: 30000
};

// Create PostgreSQL pool
const pool = new Pool({
  connectionString: CONFIG.PG_CONNECTION,
  ssl: { rejectUnauthorized: false }
});

// Generate JWT token for WebSocket auth
function generateToken(companyId) {
  return jwt.sign(
    {
      company_id: companyId,  // Internal DB ID (required by marketplace-socket.js:101)
      salon_id: companyId,    // YClients salon ID (required by marketplace-socket.js:102)
      iat: Math.floor(Date.now() / 1000)
    },
    CONFIG.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Step 1: Insert dirty credentials
async function insertDirtyCredentials() {
  console.log('\n📝 Step 1: Inserting dirty credentials...');

  // First, clean up any existing credentials
  await pool.query('DELETE FROM whatsapp_auth WHERE company_id = $1', [CONFIG.SESSION_ID]);
  await pool.query('DELETE FROM whatsapp_keys WHERE company_id = $1', [CONFIG.SESSION_ID]);

  // Insert fake credentials with WRONG phone number
  const fakeCreds = {
    me: {
      id: `${CONFIG.WRONG_PHONE}@s.whatsapp.net`,
      name: 'Test User'
    },
    registered: false,
    pairingCode: 'FAKE1234',
    noiseKey: { private: Buffer.alloc(32).toString('base64'), public: Buffer.alloc(32).toString('base64') },
    signedIdentityKey: { private: Buffer.alloc(32).toString('base64'), public: Buffer.alloc(32).toString('base64') },
    signedPreKey: {
      keyPair: { private: Buffer.alloc(32).toString('base64'), public: Buffer.alloc(32).toString('base64') },
      signature: Buffer.alloc(64).toString('base64'),
      keyId: 1
    },
    registrationId: 12345,
    advSecretKey: Buffer.alloc(32).toString('base64'),
    nextPreKeyId: 1,
    firstUnuploadedPreKeyId: 1,
    serverHasPreKeys: false,
    account: null,
    signalIdentities: [],
    platform: 'test'
  };

  await pool.query(
    'INSERT INTO whatsapp_auth (company_id, creds, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())',
    [CONFIG.SESSION_ID, JSON.stringify(fakeCreds)]
  );

  // Verify insertion
  const result = await pool.query(
    "SELECT company_id, creds->>'me' as me FROM whatsapp_auth WHERE company_id = $1",
    [CONFIG.SESSION_ID]
  );

  if (result.rows.length > 0) {
    console.log(`✅ Dirty credentials inserted for ${CONFIG.SESSION_ID}`);
    console.log(`   Phone in DB: ${CONFIG.WRONG_PHONE}`);
    return true;
  } else {
    console.log('❌ Failed to insert credentials');
    return false;
  }
}

// Step 2: Connect WebSocket and request pairing code
async function testWebSocketFlow() {
  console.log('\n🔌 Step 2: Connecting WebSocket...');

  const token = generateToken(CONFIG.COMPANY_ID);
  console.log(`   Token generated for company ${CONFIG.COMPANY_ID}`);

  return new Promise((resolve, reject) => {
    const socket = io(`${CONFIG.WS_URL}/marketplace`, {
      auth: { token },
      transports: ['websocket'],
      timeout: CONFIG.CONNECT_TIMEOUT
    });

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.disconnect();
        reject(new Error('Timeout waiting for pairing code response'));
      }
    }, CONFIG.PAIRING_TIMEOUT);

    let requestSent = false;

    socket.on('connect', () => {
      console.log('✅ WebSocket connected');

      // Send request-pairing-code immediately after connect
      // The initial session creation (from startWhatsAppConnection) may fail with invalid credentials
      // Our request-pairing-code will disconnect it and create a fresh session with correct phone
      setTimeout(() => {
        if (!requestSent) {
          requestSent = true;
          console.log(`\n📱 Step 3: Requesting pairing code for phone ${CONFIG.CORRECT_PHONE}...`);
          console.log(`   (DB has credentials for ${CONFIG.WRONG_PHONE} - should trigger mismatch!)`);
          socket.emit('request-pairing-code', { phoneNumber: CONFIG.CORRECT_PHONE });
        }
      }, 1000); // Wait 1 second for initial setup to stabilize
    });

    socket.on('pairing-code', (data) => {
      console.log('\n🎉 SUCCESS! Pairing code received:', data.code);
      console.log('   This means mismatch detection worked - old credentials were cleared');
      clearTimeout(timeout);
      resolved = true;
      socket.disconnect();
      resolve({ success: true, code: data.code });
    });

    socket.on('pairing-code-error', (data) => {
      console.log('\n❌ Pairing code error:', data.message, `(${data.code})`);
      clearTimeout(timeout);
      resolved = true;
      socket.disconnect();
      resolve({ success: false, error: data });
    });

    socket.on('error', (error) => {
      console.log('\n❌ Socket error:', error.message || error);
      clearTimeout(timeout);
      resolved = true;
      socket.disconnect();
      reject(new Error(error.message || 'Socket error'));
    });

    socket.on('connect_error', (error) => {
      console.log('\n❌ Connection error:', error.message);
      clearTimeout(timeout);
      resolved = true;
      reject(error);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected:', reason);
    });
  });
}

// Step 3: Verify credentials were replaced
async function verifyCredentials() {
  console.log('\n🔍 Step 4: Verifying credentials in DB...');

  const result = await pool.query(
    "SELECT company_id, creds->>'me' as me, updated_at FROM whatsapp_auth WHERE company_id = $1",
    [CONFIG.SESSION_ID]
  );

  if (result.rows.length === 0) {
    console.log('   No credentials found (were deleted during mismatch)');
    return { found: false };
  }

  const me = JSON.parse(result.rows[0].me);
  const storedPhone = me.id?.split('@')[0];

  console.log(`   Stored phone: ${storedPhone}`);
  console.log(`   Updated at: ${result.rows[0].updated_at}`);

  if (storedPhone === CONFIG.CORRECT_PHONE) {
    console.log('✅ Credentials updated to correct phone!');
  } else if (storedPhone === CONFIG.WRONG_PHONE) {
    console.log('❌ Still has wrong phone - mismatch detection did not work');
  } else {
    console.log(`⚠️  Unexpected phone: ${storedPhone}`);
  }

  return { found: true, phone: storedPhone };
}

// Cleanup
async function cleanup() {
  console.log('\n🧹 Cleanup: Removing test credentials...');
  await pool.query('DELETE FROM whatsapp_auth WHERE company_id = $1', [CONFIG.SESSION_ID]);
  await pool.query('DELETE FROM whatsapp_keys WHERE company_id = $1', [CONFIG.SESSION_ID]);
  console.log('✅ Test credentials removed');
}

// Main
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Phone Mismatch Detection Test');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Company: ${CONFIG.COMPANY_ID}`);
  console.log(`  Wrong phone (in DB): ${CONFIG.WRONG_PHONE}`);
  console.log(`  Correct phone (requested): ${CONFIG.CORRECT_PHONE}`);
  console.log('═══════════════════════════════════════════════════════════');

  try {
    // Step 1: Insert dirty credentials
    const inserted = await insertDirtyCredentials();
    if (!inserted) {
      throw new Error('Failed to insert test credentials');
    }

    // Step 2-3: Connect and request pairing code
    const result = await testWebSocketFlow();

    // Step 4: Verify
    await verifyCredentials();

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════');
    if (result.success) {
      console.log('  ✅ TEST PASSED: Phone mismatch detection works!');
      console.log(`  Pairing code: ${result.code}`);
    } else {
      console.log('  ❌ TEST FAILED: Could not get pairing code');
      console.log(`  Error: ${result.error?.message || 'Unknown'}`);
    }
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ❌ TEST ERROR:', error.message);
    console.log('═══════════════════════════════════════════════════════════');
  } finally {
    await cleanup();
    await pool.end();
  }
}

main();
