#!/usr/bin/env node
// scripts/export-dialog-contexts.js
// Экспорт реальных диалогов из dialog_contexts для анализа и тестирования

require('dotenv').config();
const { supabase } = require('../src/database/supabase');
const fs = require('fs').promises;
const path = require('path');

async function exportDialogContexts() {
  console.log('📱 Экспорт диалогов из dialog_contexts...\n');
  
  try {
    // Получаем все контексты диалогов
    const { data: contexts, error } = await supabase
      .from('dialog_contexts')
      .select(`
        id,
        user_id,
        messages,
        state,
        data,
        last_activity,
        last_booking_id,
        created_at,
        updated_at,
        company_id,
        message_count,
        context_metadata
      `)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    
    console.log(`📊 Найдено ${contexts.length} диалогов\n`);
    
    // Создаем директорию для экспорта
    const exportDir = path.join(__dirname, '../test-data/dialog-contexts');
    await fs.mkdir(exportDir, { recursive: true });
    
    // Статистика
    const stats = {
      exportDate: new Date().toISOString(),
      totalDialogs: contexts.length,
      totalMessages: 0,
      dialogsWithBookings: 0,
      actionsUsed: {},
      avgMessagesPerDialog: 0,
      avgProcessingTime: 0,
      dialogsByCompany: {}
    };
    
    // Обрабатываем каждый контекст
    const processedDialogs = [];
    
    for (const context of contexts) {
      // Извлекаем телефон из user_id (формат: 79001234567@c.us)
      const phone = context.user_id.replace('@c.us', '');
      
      // Парсим сообщения
      let messages = [];
      try {
        messages = context.messages || [];
      } catch (e) {
        console.warn(`⚠️ Не удалось распарсить сообщения для ${phone}`);
        continue;
      }
      
      if (messages.length === 0) continue;
      
      // Собираем информацию о диалоге
      const dialogInfo = {
        phone,
        companyId: context.company_id,
        messagesCount: messages.length,
        hasBooking: !!context.last_booking_id,
        lastActivity: context.last_activity,
        createdAt: context.created_at,
        updatedAt: context.updated_at,
        state: context.state,
        messages: messages.map(msg => ({
          timestamp: msg.timestamp,
          userMessage: msg.userMessage,
          aiResponse: msg.aiResponse,
          actions: msg.actions || [],
          processingTimeMs: msg.processingTime || msg.processingTimeMs || null,
          success: msg.success !== false
        }))
      };
      
      // Обновляем статистику
      stats.totalMessages += messages.length;
      if (context.last_booking_id) stats.dialogsWithBookings++;
      
      // Считаем действия
      messages.forEach(msg => {
        if (msg.actions && Array.isArray(msg.actions)) {
          msg.actions.forEach(action => {
            const actionName = action.action || action.command || 'unknown';
            stats.actionsUsed[actionName] = (stats.actionsUsed[actionName] || 0) + 1;
          });
        }
        
        // Добавляем время обработки
        if (msg.processingTimeMs) {
          stats.avgProcessingTime += msg.processingTimeMs;
        }
      });
      
      // Статистика по компаниям
      const companyId = context.company_id || 'unknown';
      stats.dialogsByCompany[companyId] = (stats.dialogsByCompany[companyId] || 0) + 1;
      
      // Сохраняем диалог
      const filename = `dialog_${phone.slice(-4)}_${messages.length}msg.json`;
      await fs.writeFile(
        path.join(exportDir, filename),
        JSON.stringify(dialogInfo, null, 2)
      );
      
      console.log(`✅ Сохранен: ${filename} (${messages.length} сообщений)`);
      processedDialogs.push(dialogInfo);
    }
    
    // Финальная статистика
    stats.avgMessagesPerDialog = stats.totalDialogs > 0 
      ? Math.round(stats.totalMessages / stats.totalDialogs * 10) / 10 
      : 0;
    
    const totalProcessingTimeCount = processedDialogs.reduce((sum, d) => 
      sum + d.messages.filter(m => m.processingTimeMs).length, 0
    );
    
    if (totalProcessingTimeCount > 0) {
      stats.avgProcessingTime = Math.round(stats.avgProcessingTime / totalProcessingTimeCount);
    }
    
    // Сохраняем общий файл со всеми диалогами
    await fs.writeFile(
      path.join(exportDir, 'all-dialogs.json'),
      JSON.stringify(processedDialogs, null, 2)
    );
    
    // Сохраняем статистику
    await fs.writeFile(
      path.join(exportDir, 'statistics.json'),
      JSON.stringify(stats, null, 2)
    );
    
    // Выводим статистику
    console.log('\n📊 Статистика экспорта:');
    console.log(`- Всего диалогов: ${stats.totalDialogs}`);
    console.log(`- Всего сообщений: ${stats.totalMessages}`);
    console.log(`- Диалогов с бронированием: ${stats.dialogsWithBookings}`);
    console.log(`- Среднее сообщений на диалог: ${stats.avgMessagesPerDialog}`);
    console.log(`- Среднее время обработки: ${stats.avgProcessingTime}ms`);
    
    console.log('\n🎯 Топ использованных действий:');
    const sortedActions = Object.entries(stats.actionsUsed)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    sortedActions.forEach(([action, count]) => {
      console.log(`  - ${action}: ${count}`);
    });
    
    console.log('\n🏢 Диалоги по компаниям:');
    Object.entries(stats.dialogsByCompany).forEach(([companyId, count]) => {
      console.log(`  - Компания ${companyId}: ${count} диалогов`);
    });
    
    console.log('\n✅ Экспорт завершен!');
    console.log(`📁 Файлы сохранены в: ${exportDir}`);
    
  } catch (error) {
    console.error('❌ Ошибка экспорта:', error);
  }
}

// Запуск
if (require.main === module) {
  exportDialogContexts();
}

module.exports = { exportDialogContexts };