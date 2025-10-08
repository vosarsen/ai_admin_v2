#!/usr/bin/env node

// Analyze whatsapp_keys types and their expiration status

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

async function analyzeKeyTypes() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get all keys
  const { data: keys, error } = await supabase
    .from('whatsapp_keys')
    .select('key_type, expires_at');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  // Group by key_type
  const stats = keys.reduce((acc, k) => {
    if (!acc[k.key_type]) {
      acc[k.key_type] = { total: 0, withTTL: 0, withoutTTL: 0 };
    }
    acc[k.key_type].total++;
    if (k.expires_at) {
      acc[k.key_type].withTTL++;
    } else {
      acc[k.key_type].withoutTTL++;
    }
    return acc;
  }, {});

  console.log('\n📊 WhatsApp Keys Breakdown:\n');
  console.log('Type'.padEnd(40), 'Total'.padEnd(10), 'With TTL'.padEnd(12), 'No TTL');
  console.log('─'.repeat(75));

  for (const [type, data] of Object.entries(stats)) {
    console.log(
      type.padEnd(40),
      data.total.toString().padEnd(10),
      data.withTTL.toString().padEnd(12),
      data.withoutTTL.toString()
    );
  }

  console.log('─'.repeat(75));
  console.log('TOTAL'.padEnd(40), keys.length);
  console.log('');
}

analyzeKeyTypes().catch(console.error);
