#!/usr/bin/env node

// scripts/check-whatsapp-keys.js
// Проверка состояния whatsapp_keys в базе данных

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

async function checkKeys() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Проверка whatsapp_keys...\n');

  // Общее количество
  const { count: total, error: totalError } = await supabase
    .from('whatsapp_keys')
    .select('*', { count: 'exact', head: true });

  if (totalError) {
    console.error('❌ Ошибка:', totalError.message);
    return;
  }

  // Истёкшие ключи
  const { count: expired, error: expiredError } = await supabase
    .from('whatsapp_keys')
    .select('*', { count: 'exact', head: true })
    .lt('expires_at', new Date().toISOString());

  // Активные ключи
  const active = total - (expired || 0);

  console.log(`📊 Всего ключей: ${total}`);
  console.log(`✅ Активных: ${active}`);
  console.log(`❌ Истёкших: ${expired || 0}`);
  console.log(`📈 % истёкших: ${((expired / total) * 100).toFixed(1)}%\n`);

  // Примеры истёкших ключей
  if (expired > 0) {
    const { data: expiredKeys, error } = await supabase
      .from('whatsapp_keys')
      .select('id, key, created_at, expires_at')
      .lt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })
      .limit(5);

    if (!error && expiredKeys.length > 0) {
      console.log('🗑️  Примеры истёкших ключей (самые старые):');
      expiredKeys.forEach((k, i) => {
        const age = Math.floor((Date.now() - new Date(k.expires_at).getTime()) / 1000 / 60 / 60 / 24);
        console.log(`${i + 1}. ${k.key.substring(0, 30)}... (истёк ${age} дней назад)`);
      });
      console.log('');
    }
  }

  // Самые свежие ключи
  const { data: recentKeys, error: recentError } = await supabase
    .from('whatsapp_keys')
    .select('id, key, created_at, expires_at')
    .order('created_at', { ascending: false })
    .limit(3);

  if (!recentError && recentKeys.length > 0) {
    console.log('🆕 Последние добавленные ключи:');
    recentKeys.forEach((k, i) => {
      const minutesAgo = Math.floor((Date.now() - new Date(k.created_at).getTime()) / 1000 / 60);
      console.log(`${i + 1}. ${k.key.substring(0, 30)}... (${minutesAgo} минут назад)`);
    });
    console.log('');
  }

  // Рекомендации
  console.log('💡 Рекомендации:');
  if (expired > 100) {
    console.log('⚠️  МНОГО истёкших ключей! TTL cleanup не работает!');
    console.log('   Запустите: node scripts/cleanup-expired-keys.js');
  } else if (expired > 50) {
    console.log('⚠️  TTL cleanup работает медленно');
  } else if (total > 200 && expired < 50) {
    console.log('⚠️  Много активных ключей - возможна утечка памяти');
  } else {
    console.log('✅ Всё нормально');
  }
}

checkKeys().catch(console.error);
