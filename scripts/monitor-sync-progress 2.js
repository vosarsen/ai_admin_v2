#!/usr/bin/env node
/**
 * Мониторинг прогресса синхронизации в реальном времени
 */

require('dotenv').config();
const { supabase } = require('../src/database/supabase');

async function monitorProgress() {
  console.clear();
  
  const { count: total } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .gte('visit_count', 1);
    
  const { count: withHistory } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .not('visit_history', 'eq', '[]');
    
  const { count: withServices } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .not('last_services', 'eq', '[]');
    
  const percentage = Math.round(withHistory * 100 / total);
  const remaining = total - withHistory;
  
  // Прогресс-бар
  const barLength = 40;
  const filledLength = Math.round(barLength * percentage / 100);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  
  console.log('\n📊 МОНИТОРИНГ СИНХРОНИЗАЦИИ ВИЗИТОВ');
  console.log('====================================\n');
  
  console.log(`Прогресс: [${bar}] ${percentage}%\n`);
  
  console.log(`✅ Синхронизировано: ${withHistory} / ${total}`);
  console.log(`❌ Осталось: ${remaining}`);
  console.log(`📝 С услугами: ${withServices}`);
  
  console.log('\n------------------------------------');
  console.log('Обновляется каждые 5 секунд...');
  console.log('Нажмите Ctrl+C для выхода');
  
  if (remaining === 0) {
    console.log('\n🎉 СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА!');
    console.log('Все клиенты имеют историю визитов.');
    process.exit(0);
  }
}

// Запуск мониторинга
async function startMonitoring() {
  await monitorProgress();
  setInterval(monitorProgress, 5000); // Обновление каждые 5 секунд
}

startMonitoring().catch(console.error);