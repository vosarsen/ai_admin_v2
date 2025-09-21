#!/usr/bin/env node

/**
 * Test script for Baileys WhatsApp connection
 * Тестирует подключение к WhatsApp с использованием улучшенной версии session-pool
 *
 * Использование:
 * node test-baileys-connection.js [options]
 *
 * Options:
 * --pairing   - Use pairing code instead of QR
 * --phone     - Phone number for pairing code (e.g., 79936363848)
 * --company   - Company ID (default: 962302)
 */

const { getSessionPool } = require('../../src/integrations/whatsapp/session-pool');
const readline = require('readline');
const qrcodeTerminal = require('qrcode-terminal');

// Parse command line arguments
const args = process.argv.slice(2);
const usePairingCode = args.includes('--pairing');
const phoneIndex = args.indexOf('--phone');
const phoneNumber = phoneIndex > -1 ? args[phoneIndex + 1] : process.env.WHATSAPP_PHONE_NUMBER || '79936363848';
const companyIndex = args.indexOf('--company');
const companyId = companyIndex > -1 ? args[companyIndex + 1] : '962302';

console.log('🚀 Starting Baileys WhatsApp Connection Test');
console.log('='.repeat(50));
console.log(`Company ID: ${companyId}`);
console.log(`Connection method: ${usePairingCode ? 'Pairing Code' : 'QR Code'}`);
if (usePairingCode) {
    console.log(`Phone number: ${phoneNumber}`);
}
console.log('='.repeat(50));

async function testConnection() {
    try {
        // Get session pool instance
        const pool = getSessionPool();

        // Set up event listeners
        pool.on('qr', async ({ companyId: cId, qr }) => {
            if (cId !== companyId) return;

            console.log('\n📱 QR CODE GENERATED - SCAN WITH WHATSAPP');
            console.log('='.repeat(50));

            // Generate terminal QR
            qrcodeTerminal.generate(qr, { small: true });

            console.log('\n' + '='.repeat(50));
            console.log('Steps to connect:');
            console.log('1. Open WhatsApp on your phone');
            console.log('2. Tap Menu (⋮) or Settings');
            console.log('3. Tap Linked Devices');
            console.log('4. Tap Link a Device');
            console.log('5. Scan this QR code');
            console.log('='.repeat(50));
        });

        pool.on('pairing-code', ({ companyId: cId, code, phoneNumber: phone }) => {
            if (cId !== companyId) return;

            console.log('\n🔑 PAIRING CODE GENERATED');
            console.log('='.repeat(50));
            console.log(`Code: ${code}`);
            console.log(`Phone: ${phone}`);
            console.log('\n' + '='.repeat(50));
            console.log('Steps to connect:');
            console.log('1. Open WhatsApp on your phone');
            console.log('2. Tap Menu (⋮) or Settings');
            console.log('3. Tap Linked Devices');
            console.log('4. Tap Link a Device');
            console.log('5. Tap "Link with phone number instead"');
            console.log(`6. Enter this code: ${code}`);
            console.log('='.repeat(50));
        });

        pool.on('connected', ({ companyId: cId, user, phoneNumber: phone }) => {
            if (cId !== companyId) return;

            console.log('\n✅ SUCCESSFULLY CONNECTED TO WHATSAPP!');
            console.log('='.repeat(50));
            console.log(`User: ${JSON.stringify(user, null, 2)}`);
            console.log(`Phone: ${phone}`);
            console.log('='.repeat(50));
            console.log('\nBot is ready to send and receive messages.');
            console.log('Press Ctrl+C to exit or type "send" to send test message\n');
        });

        pool.on('message', ({ companyId: cId, message }) => {
            if (cId !== companyId) return;

            const from = message.key.remoteJid;
            const text = message.message?.conversation ||
                        message.message?.extendedTextMessage?.text ||
                        '[Non-text message]';

            console.log(`\n📨 New message from ${from}:`);
            console.log(`> ${text}\n`);
        });

        pool.on('logout', ({ companyId: cId }) => {
            if (cId !== companyId) return;
            console.log('\n❌ Session logged out');
            process.exit(0);
        });

        pool.on('error', ({ companyId: cId, error }) => {
            if (cId !== companyId) return;
            console.error('\n❌ Error:', error.message);
        });

        // Create session
        console.log('\n🔄 Creating WhatsApp session...\n');
        const session = await pool.createSession(companyId, {
            usePairingCode,
            phoneNumber
        });

        // Set up command line interface
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.on('line', async (input) => {
            if (input.toLowerCase() === 'send') {
                await sendTestMessage(pool, companyId);
            } else if (input.toLowerCase() === 'status') {
                const status = pool.getSessionStatus(companyId);
                console.log('\nSession Status:', JSON.stringify(status, null, 2));
            } else if (input.toLowerCase() === 'metrics') {
                const metrics = pool.getMetrics();
                console.log('\nMetrics:', JSON.stringify(metrics, null, 2));
            } else if (input.toLowerCase() === 'help') {
                console.log('\nAvailable commands:');
                console.log('  send     - Send test message');
                console.log('  status   - Show session status');
                console.log('  metrics  - Show metrics');
                console.log('  help     - Show this help');
                console.log('  exit     - Exit the program\n');
            } else if (input.toLowerCase() === 'exit') {
                process.exit(0);
            }
        });

        // Show initial help
        console.log('\nType "help" for available commands\n');

    } catch (error) {
        console.error('Failed to create session:', error);
        process.exit(1);
    }
}

async function sendTestMessage(pool, companyId) {
    try {
        const testNumber = process.env.TEST_PHONE_NUMBER || '79686484488';

        console.log(`\n📤 Sending test message to ${testNumber}...`);

        await pool.sendMessage(companyId, testNumber,
            '🎉 *Тест подключения Baileys*\n\n' +
            '✅ Подключение успешно установлено\n' +
            '🚀 Улучшенная версия session-pool\n' +
            '📱 WhatsApp Business готов к работе\n\n' +
            '_Это тестовое сообщение от AI Admin_'
        );

        console.log('✅ Test message sent successfully!\n');
    } catch (error) {
        console.error('❌ Failed to send message:', error.message);
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down...');
    const pool = getSessionPool();
    await pool.disconnectSession(companyId);
    process.exit(0);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    process.exit(1);
});

// Start the test
testConnection();