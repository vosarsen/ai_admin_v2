#!/usr/bin/env node

// Analyze key creation rate and predict future growth

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

async function analyzeGrowth() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('📊 Анализ роста ключей...\n');

  // Total keys
  const { count: total } = await supabase
    .from('whatsapp_keys')
    .select('*', { count: 'exact', head: true });

  // Keys created in last 24 hours
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);

  const { count: last24h } = await supabase
    .from('whatsapp_keys')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', yesterday.toISOString());

  // Keys created in last 7 days
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);

  const { count: last7days } = await supabase
    .from('whatsapp_keys')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', lastWeek.toISOString());

  // Oldest key
  const { data: oldest } = await supabase
    .from('whatsapp_keys')
    .select('created_at')
    .order('created_at', { ascending: true })
    .limit(1);

  const daysOld = oldest && oldest[0]
    ? Math.floor((Date.now() - new Date(oldest[0].created_at).getTime()) / 1000 / 60 / 60 / 24)
    : 0;

  console.log('📈 Текущее состояние:');
  console.log(`   Всего ключей: ${total}`);
  console.log(`   Самый старый ключ: ${daysOld} дней назад\n`);

  console.log('🔄 Скорость создания:');
  console.log(`   За последние 24 часа: ${last24h || 0} ключей`);
  console.log(`   За последние 7 дней: ${last7days || 0} ключей`);

  const dailyRate = last7days ? Math.round(last7days / 7) : 0;
  console.log(`   Среднее в день: ~${dailyRate} ключей/день\n`);

  console.log('💡 Прогноз с TTL:');

  // Scenario 1: TTL = 7 days
  const equilibrium7d = dailyRate * 7;
  console.log(`\n1️⃣  С TTL = 7 дней:`);
  console.log(`   Равновесие: ~${equilibrium7d} ключей`);
  console.log(`   Изменение: ${total} → ${equilibrium7d} (${equilibrium7d - total >= 0 ? '+' : ''}${equilibrium7d - total})`);

  if (equilibrium7d < total) {
    const reduction = Math.round((1 - equilibrium7d / total) * 100);
    console.log(`   ✅ Уменьшение на ${reduction}%`);
  } else {
    console.log(`   ⚠️  Количество останется примерно таким же`);
  }

  // Scenario 2: TTL = 14 days
  const equilibrium14d = dailyRate * 14;
  console.log(`\n2️⃣  С TTL = 14 дней:`);
  console.log(`   Равновесие: ~${equilibrium14d} ключей`);
  console.log(`   Изменение: ${total} → ${equilibrium14d} (${equilibrium14d - total >= 0 ? '+' : ''}${equilibrium14d - total})`);

  console.log('\n📊 Вывод:');

  if (dailyRate === 0) {
    console.log('⚠️  Нет новых ключей за последние 7 дней!');
    console.log('   Все 665 ключей - старые накопленные.');
    console.log('   ✅ Cleanup удалит ВСЕ старые ключи через 7-14 дней');
    console.log(`   Останется: 0-50 активных ключей`);
  } else if (equilibrium7d < total * 0.5) {
    console.log('✅ Количество ключей ЗНАЧИТЕЛЬНО УМЕНЬШИТСЯ');
  } else if (equilibrium7d < total) {
    console.log('✅ Количество ключей уменьшится');
  } else if (equilibrium7d <= total * 1.1) {
    console.log('⚠️  Количество останется примерно таким же');
  } else {
    console.log('🔴 ВНИМАНИЕ: Количество будет расти!');
    console.log('   Нужно уменьшить TTL или проверить почему создается так много ключей');
  }
}

analyzeGrowth().catch(console.error);
