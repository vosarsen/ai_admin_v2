// scripts/export-whatsapp-dialogs.js
// Экспорт реальных диалогов из БД для анализа

require('dotenv').config();
const { supabase } = require('../src/database/supabase');
const fs = require('fs').promises;
const path = require('path');

async function exportDialogs() {
  console.log('📱 Экспорт диалогов из WhatsApp...\n');
  
  try {
    // Получаем последние сообщения
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        id,
        phone_from,
        message_text,
        ai_response,
        intent_detected,
        commands_executed,
        created_at,
        company_id,
        processing_time_ms
      `)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    
    // Группируем по диалогам
    const dialogs = {};
    messages.forEach(msg => {
      const phone = msg.phone_from;
      if (!dialogs[phone]) {
        dialogs[phone] = [];
      }
      dialogs[phone].push({
        time: msg.created_at,
        user: msg.message_text,
        bot: msg.ai_response,
        intent: msg.intent_detected,
        commands: msg.commands_executed,
        processingMs: msg.processing_time_ms
      });
    });
    
    // Сохраняем в файлы
    const exportDir = path.join(__dirname, '../test-data/real-dialogs');
    await fs.mkdir(exportDir, { recursive: true });
    
    // Сохраняем каждый диалог
    for (const [phone, messages] of Object.entries(dialogs)) {
      const filename = `dialog_${phone.slice(-4)}_${new Date().toISOString().split('T')[0]}.json`;
      await fs.writeFile(
        path.join(exportDir, filename),
        JSON.stringify(messages, null, 2)
      );
      console.log(`✅ Сохранен диалог: ${filename} (${messages.length} сообщений)`);
    }
    
    // Создаем сводный отчет
    const report = {
      exportDate: new Date().toISOString(),
      totalDialogs: Object.keys(dialogs).length,
      totalMessages: messages.length,
      intentsDetected: {},
      commandsUsed: {},
      avgProcessingTime: 0
    };
    
    // Анализируем интенты и команды
    let totalTime = 0;
    let countTime = 0;
    
    messages.forEach(msg => {
      // Интенты
      if (msg.intent_detected) {
        report.intentsDetected[msg.intent_detected] = (report.intentsDetected[msg.intent_detected] || 0) + 1;
      }
      
      // Команды
      if (msg.commands_executed) {
        try {
          const commands = JSON.parse(msg.commands_executed);
          commands.forEach(cmd => {
            report.commandsUsed[cmd.command] = (report.commandsUsed[cmd.command] || 0) + 1;
          });
        } catch (e) {}
      }
      
      // Время обработки
      if (msg.processing_time_ms) {
        totalTime += msg.processing_time_ms;
        countTime++;
      }
    });
    
    report.avgProcessingTime = countTime > 0 ? Math.round(totalTime / countTime) : 0;
    
    // Сохраняем отчет
    await fs.writeFile(
      path.join(exportDir, 'report.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n📊 Статистика:');
    console.log(`- Диалогов: ${report.totalDialogs}`);
    console.log(`- Сообщений: ${report.totalMessages}`);
    console.log(`- Среднее время обработки: ${report.avgProcessingTime}ms`);
    console.log('\n🎯 Обнаруженные интенты:');
    Object.entries(report.intentsDetected).forEach(([intent, count]) => {
      console.log(`  - ${intent}: ${count}`);
    });
    console.log('\n🔧 Использованные команды:');
    Object.entries(report.commandsUsed).forEach(([command, count]) => {
      console.log(`  - ${command}: ${count}`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск
exportDialogs();