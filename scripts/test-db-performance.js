#!/usr/bin/env node

// Test database query performance for whatsapp_keys

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

async function testPerformance() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('📊 Testing database performance...\n');

  // Test 1: Load all keys for company
  const start = Date.now();
  const { data, error } = await supabase
    .from('whatsapp_keys')
    .select('*')
    .eq('company_id', '962302');
  const duration = Date.now() - start;

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`✅ Query completed in: ${duration}ms`);
  console.log(`📦 Keys fetched: ${data.length}`);

  const sizeKB = Math.round(JSON.stringify(data).length / 1024);
  console.log(`💾 Data size: ~${sizeKB}KB\n`);

  // Performance assessment
  console.log('💡 Impact assessment:');

  if (duration < 200) {
    console.log('✅ Performance: EXCELLENT (< 200ms)');
    console.log('   No impact on system performance');
  } else if (duration < 500) {
    console.log('⚠️  Performance: GOOD (200-500ms)');
    console.log('   Minor impact on WhatsApp reconnections');
  } else if (duration < 1000) {
    console.log('🟠 Performance: ACCEPTABLE (500-1000ms)');
    console.log('   Noticeable delay on WhatsApp startup');
  } else {
    console.log('🔴 Performance: SLOW (> 1000ms)');
    console.log('   Significant impact - cleanup needed!');
  }

  console.log('');

  // Breakdown by key type
  const byType = data.reduce((acc, k) => {
    acc[k.key_type] = (acc[k.key_type] || 0) + 1;
    return acc;
  }, {});

  console.log('📊 Keys by type:');
  const sorted = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([type, count]) => {
    const pct = Math.round((count / data.length) * 100);
    console.log(`   ${type.padEnd(20)} ${count.toString().padStart(4)} (${pct}%)`);
  });

  console.log('');

  // Recommendations
  console.log('🔧 Recommendations:');
  if (data.length < 500) {
    console.log('✅ Key count is healthy - no action needed');
  } else if (data.length < 1000) {
    console.log('⚠️  Monitor key growth - TTL cleanup will handle it');
  } else if (data.length < 2000) {
    console.log('🟠 High key count - ensure cleanup runs regularly');
  } else {
    console.log('🔴 Too many keys - manual cleanup recommended!');
    console.log('   Run: node scripts/cleanup-expired-keys.js');
  }
}

testPerformance().catch(console.error);
