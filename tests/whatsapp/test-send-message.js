#!/usr/bin/env node

const { getSessionPool } = require('./src/integrations/whatsapp/session-pool');

async function sendTestMessage() {
    const pool = getSessionPool();
    const companyId = '962302';
    const testPhone = '79686484488'; // или ваш номер для теста

    try {
        console.log('📤 Sending test message...');

        await pool.sendMessage(
            companyId,
            testPhone,
            '🎉 Тест отправки из Baileys!\n\nЕсли вы видите это сообщение, значит отправка работает.\nТеперь попробуйте ответить на это сообщение.'
        );

        console.log('✅ Message sent successfully!');
    } catch (error) {
        console.error('❌ Failed to send message:', error.message);
    }

    // Ждем немного, чтобы увидеть результат
    setTimeout(() => process.exit(0), 2000);
}

sendTestMessage();