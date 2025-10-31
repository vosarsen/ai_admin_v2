#!/usr/bin/env node

// Backfill TTL for existing whatsapp_keys
// Sets expires_at for keys that don't have it

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

async function backfillTTL() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔄 Backfilling TTL for existing whatsapp_keys...\n');

  // Get all keys without expires_at
  const { data: keys, error } = await supabase
    .from('whatsapp_keys')
    .select('company_id, key_type, key_id, created_at, updated_at')
    .is('expires_at', null);

  if (error) {
    console.error('❌ Error fetching keys:', error.message);
    return;
  }

  if (!keys || keys.length === 0) {
    console.log('✅ All keys already have TTL!');
    return;
  }

  console.log(`📊 Found ${keys.length} keys without TTL\n`);

  // Group by key_type for statistics
  const byType = keys.reduce((acc, k) => {
    acc[k.key_type] = (acc[k.key_type] || 0) + 1;
    return acc;
  }, {});

  console.log('Breakdown:');
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type}: ${count}`);
  }
  console.log('');

  // Prepare updates
  const updates = keys.map(key => {
    const expiryDate = new Date();

    // Same logic as in auth-state-supabase.js
    if (key.key_type.includes('lid-mapping')) {
      expiryDate.setDate(expiryDate.getDate() + 7);
    } else if (key.key_type === 'pre-key') {
      expiryDate.setDate(expiryDate.getDate() + 30);
    } else if (key.key_type === 'session') {
      expiryDate.setDate(expiryDate.getDate() + 7);
    } else if (key.key_type === 'sender-key') {
      expiryDate.setDate(expiryDate.getDate() + 7);
    } else {
      // Default: 30 days
      expiryDate.setDate(expiryDate.getDate() + 30);
    }

    return {
      company_id: key.company_id,
      key_type: key.key_type,
      key_id: key.key_id,
      expires_at: expiryDate.toISOString()
    };
  });

  // Update one by one (Supabase doesn't support batch UPDATE with filters)
  let updated = 0;
  let errors = 0;

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('whatsapp_keys')
      .update({ expires_at: update.expires_at })
      .eq('company_id', update.company_id)
      .eq('key_type', update.key_type)
      .eq('key_id', update.key_id);

    if (updateError) {
      errors++;
      if (errors <= 5) {
        console.error(`❌ Error updating ${update.key_type}/${update.key_id}:`, updateError.message);
      }
    } else {
      updated++;
    }

    if (updated % 50 === 0) {
      process.stdout.write(`\r⏳ Progress: ${updated}/${updates.length} (${Math.round(updated/updates.length*100)}%) ${errors ? `[${errors} errors]` : ''}`);
    }
  }

  if (errors > 5) {
    console.log(`\n⚠️  ${errors - 5} more errors (hidden)`);
  }

  console.log('\n\n✅ Backfill complete!');
  console.log(`📊 Updated ${updated} keys with TTL`);
  console.log('\n💡 New keys will automatically get TTL from now on.');
  console.log('🧹 Run cleanup to remove old expired keys: node scripts/cleanup-expired-keys.js');
}

backfillTTL().catch(console.error);
