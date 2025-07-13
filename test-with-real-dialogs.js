// test-with-real-dialogs.js
// Тестирование AI Admin v2 на реальных диалогах

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const aiAdmin = require('./src/services/ai-admin-v2');

async function testWithRealDialogs() {
  console.log('🧪 Тестирование на реальных диалогах\n');
  
  try {
    // Читаем экспортированные диалоги
    const dialogsDir = path.join(__dirname, 'test-data/real-dialogs');
    const files = await fs.readdir(dialogsDir);
    const dialogFiles = files.filter(f => f.startsWith('dialog_'));
    
    if (dialogFiles.length === 0) {
      console.log('❌ Нет экспортированных диалогов.');
      console.log('Сначала запустите: node scripts/export-whatsapp-dialogs.js');
      return;
    }
    
    // Статистика
    let totalTests = 0;
    let successfulIntents = 0;
    let failedIntents = 0;
    const intentStats = {};
    
    // Тестируем каждый диалог
    for (const file of dialogFiles) {
      const dialog = JSON.parse(
        await fs.readFile(path.join(dialogsDir, file), 'utf-8')
      );
      
      console.log(`\n📁 Тестируем диалог: ${file}`);
      console.log(`   Сообщений: ${dialog.length}`);
      
      // Тестируем каждое сообщение пользователя
      for (const msg of dialog) {
        if (!msg.user) continue;
        
        totalTests++;
        console.log(`\n💬 Пользователь: "${msg.user}"`);
        
        try {
          // Вызываем AI Admin v2
          const result = await aiAdmin.processMessage(
            msg.user,
            '79000000001',
            509113
          );
          
          // Анализируем результат
          const commands = result.executedCommands || [];
          const commandNames = commands.map(c => c.command).join(', ') || 'none';
          
          console.log(`🤖 Команды: ${commandNames}`);
          console.log(`📝 Ответ: ${result.response.substring(0, 100)}...`);
          
          // Сравниваем с оригинальным ответом
          if (msg.bot) {
            console.log(`📊 Оригинальный ответ: ${msg.bot.substring(0, 100)}...`);
          }
          
          // Считаем статистику
          if (commands.length > 0) {
            successfulIntents++;
            commands.forEach(cmd => {
              intentStats[cmd.command] = (intentStats[cmd.command] || 0) + 1;
            });
          } else {
            failedIntents++;
          }
          
        } catch (error) {
          console.error(`❌ Ошибка: ${error.message}`);
          failedIntents++;
        }
        
        // Небольшая задержка
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Итоговая статистика
    console.log('\n' + '='.repeat(50));
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
    console.log('='.repeat(50));
    console.log(`Всего тестов: ${totalTests}`);
    console.log(`✅ Успешно определены интенты: ${successfulIntents} (${Math.round(successfulIntents/totalTests*100)}%)`);
    console.log(`❌ Не определены интенты: ${failedIntents} (${Math.round(failedIntents/totalTests*100)}%)`);
    
    console.log('\n🎯 Использованные команды:');
    Object.entries(intentStats).forEach(([command, count]) => {
      console.log(`  - ${command}: ${count} раз`);
    });
    
    const score = Math.round(successfulIntents / totalTests * 10);
    console.log(`\n🏆 Оценка: ${score}/10`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск
testWithRealDialogs();