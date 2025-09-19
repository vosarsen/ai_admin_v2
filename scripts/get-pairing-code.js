#!/usr/bin/env node
// Script to get pairing code for WhatsApp connection

const { Boom } = require('@hapi/boom');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');

const companyId = process.argv[2] || '962302';
const sessionPath = path.join(__dirname, '..', 'baileys_sessions', `company_${companyId}`);

console.log(`📱 Getting pairing code for company ${companyId}...`);
console.log(`📂 Session path: ${sessionPath}`);

// Ensure session directory exists
if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
    console.log('✅ Created session directory');
}

async function connectWithPairingCode() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            mobile: false,
            browser: ['AI Admin', 'Chrome', '120.0.0.0'],
            markOnlineOnConnect: false,
            generateHighQualityLinkPreview: false
        });

        // Request pairing code
        if (!sock.authState.creds.registered) {
            const phoneNumber = process.env.WHATSAPP_PHONE_NUMBER || '+79686484488';
            const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');

            console.log(`📞 Requesting pairing code for phone: ${phoneNumber}`);
            const code = await sock.requestPairingCode(cleanPhone);

            console.log('\n' + '='.repeat(50));
            console.log('🔑 PAIRING CODE:', code);
            console.log('='.repeat(50));
            console.log('\n📱 Instructions:');
            console.log('1. Open WhatsApp on your phone');
            console.log('2. Go to Settings → Linked Devices');
            console.log('3. Tap "Link a Device"');
            console.log('4. Choose "Link with phone number instead"');
            console.log('5. Enter this code:', code);
            console.log('\n⏰ Code expires in 60 seconds!');
            console.log('='.repeat(50) + '\n');
        } else {
            console.log('✅ Already registered! No pairing code needed.');
            process.exit(0);
        }

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
                console.log('❌ Connection closed:', lastDisconnect?.error?.message);

                if (shouldReconnect) {
                    console.log('🔄 Reconnecting...');
                    setTimeout(() => connectWithPairingCode(), 5000);
                } else {
                    console.log('🛑 Logged out. Please run script again.');
                    process.exit(0);
                }
            } else if (connection === 'open') {
                console.log('✅ Successfully connected!');
                console.log(`📱 Connected as: ${sock.user?.id}`);
                console.log(`📂 Session saved in: ${sessionPath}`);
                console.log('\n✨ WhatsApp is now ready for company', companyId);
                process.exit(0);
            }
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Start connection
connectWithPairingCode().catch(console.error);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    process.exit(0);
});