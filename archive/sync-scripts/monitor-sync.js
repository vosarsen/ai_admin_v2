#!/usr/bin/env node

/**
 * Мониторинг прогресса синхронизации визитов
 */

require('dotenv').config();
const { supabase } = require('./src/database/supabase');

let lastCount = 0;
let startTime = Date.now();

async function monitorProgress() {
  const { count } = await supabase.from('visits').select('*', { count: 'exact', head: true });
  
  // Получаем уникальных клиентов
  const { data: uniqueData } = await supabase
    .from('visits')
    .select('client_id');
  
  const uniqueClients = new Set(uniqueData?.map(v => v.client_id)).size;
  
  // Скорость синхронизации
  const elapsed = (Date.now() - startTime) / 1000;
  const speed = Math.round((count - lastCount) / 5); // визитов в секунду
  
  // Прогресс бар
  const expectedTotal = 3042;
  const progress = Math.min(100, Math.round((count / expectedTotal) * 100));
  const progressBar = '█'.repeat(Math.floor(progress / 2)) + '░'.repeat(50 - Math.floor(progress / 2));
  
  console.clear();
  console.log('📊 МОНИТОРИНГ СИНХРОНИЗАЦИИ ВИЗИТОВ');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log(`Прогресс: [${progressBar}] ${progress}%`);
  console.log('');
  console.log(`📈 Статистика:`);
  console.log(`  • Визитов синхронизировано: ${count} / ~${expectedTotal}`);
  console.log(`  • Уникальных клиентов: ${uniqueClients} / ~1000`);
  console.log(`  • Скорость: ${speed} визитов/сек`);
  console.log(`  • Время работы: ${Math.round(elapsed)} сек`);
  console.log('');
  
  if (speed > 0) {
    const remaining = Math.max(0, expectedTotal - count);
    const eta = Math.round(remaining / speed);
    console.log(`⏱️  Осталось времени: ~${Math.floor(eta / 60)}м ${eta % 60}с`);
  }
  
  lastCount = count;
  
  // Проверяем завершение
  if (count >= expectedTotal * 0.95) {
    console.log('');
    console.log('✅ Синхронизация почти завершена!');
    process.exit(0);
  }
}

// Запускаем мониторинг каждые 5 секунд
console.log('🚀 Запуск мониторинга синхронизации...\n');
monitorProgress();
setInterval(monitorProgress, 5000);