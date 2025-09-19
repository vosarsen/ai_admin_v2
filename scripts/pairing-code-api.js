#!/usr/bin/env node
// Script optimized for API usage - maintains session after pairing

const { Boom } = require('@hapi/boom');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');

const companyId = process.argv[2] || '962302';
const sessionPath = path.join(__dirname, '..', 'baileys_sessions', `company_${companyId}`);

console.log(`📱 Starting pairing process for company ${companyId}...`);
console.log(`📂 Session path: ${sessionPath}`);

// Ensure session directory exists
if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
}

let sock = null;
let pairingCodeGenerated = false;

async function connectWithPairingCode() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            mobile: false,
            browser: ['AI Admin', 'Chrome', '120.0.0.0'],
            markOnlineOnConnect: false,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            // Extended timeouts for better stability
            connectTimeoutMs: 120000,
            defaultQueryTimeoutMs: 120000,
            keepAliveIntervalMs: 30000,
            retryRequestDelayMs: 3000,
            maxMsgRetryCount: 5,
            qrTimeout: 90000
        });

        // Save credentials on update
        sock.ev.on('creds.update', saveCreds);

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && !pairingCodeGenerated) {
                console.log('📱 QR Code mode detected, switching to pairing code...');
            }

            if (connection === 'connecting') {
                console.log('🔄 Connecting to WhatsApp...');
            } else if (connection === 'open') {
                console.log('\n' + '='.repeat(50));
                console.log('✅ SUCCESSFULLY CONNECTED!');
                console.log(`📱 Connected as: ${sock.user?.id}`);
                console.log(`📂 Session saved in: ${sessionPath}`);
                console.log('✨ WhatsApp is now ready for company', companyId);
                console.log('='.repeat(50) + '\n');

                // Keep the process running to maintain the session
                console.log('🟢 Session active. Keeping connection alive...');

                // Set up a heartbeat to keep the session active
                setInterval(() => {
                    if (sock.user) {
                        console.log(`💚 Session healthy for ${companyId} at ${new Date().toLocaleTimeString()}`);
                    }
                }, 30000); // Log every 30 seconds

            } else if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
                console.log('❌ Connection closed:', lastDisconnect?.error?.message);

                if (shouldReconnect) {
                    console.log('🔄 Attempting to reconnect in 5 seconds...');
                    setTimeout(() => connectWithPairingCode(), 5000);
                } else {
                    console.log('🛑 Logged out. Session terminated.');
                    process.exit(0);
                }
            }
        });

        // Wait for connection to establish
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Request pairing code if not registered
        if (!sock.authState.creds.registered) {
            const phoneNumber = process.env.WHATSAPP_PHONE_NUMBER || '+79686484488';
            const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');

            console.log(`📞 Requesting pairing code for phone: ${phoneNumber}`);

            try {
                const code = await sock.requestPairingCode(cleanPhone);
                pairingCodeGenerated = true;

                console.log('\n' + '='.repeat(50));
                console.log('🔑 PAIRING CODE:', code);
                console.log('='.repeat(50));
                console.log('\n📱 Instructions:');
                console.log('1. Open WhatsApp on your phone');
                console.log('2. Go to Settings → Linked Devices');
                console.log('3. Tap "Link a Device"');
                console.log('4. Choose "Link with phone number instead"');
                console.log('5. Enter this code:', code);
                console.log('\n⏰ Code valid for 60-90 seconds');
                console.log('⏳ Waiting for pairing to complete...');
                console.log('='.repeat(50) + '\n');

            } catch (err) {
                console.error('❌ Failed to get pairing code:', err.message);

                if (err.message.includes('rate')) {
                    console.log('\n⚠️ Rate limit detected!');
                    console.log('Please wait 30-60 minutes before trying again.');
                    console.log('Alternatively, use QR code method.');
                } else {
                    console.log('\n💡 Troubleshooting tips:');
                    console.log('1. Check phone number format (digits only)');
                    console.log('2. Ensure WhatsApp is up to date');
                    console.log('3. Try QR code method if pairing fails');
                }

                process.exit(1);
            }
        } else {
            console.log('✅ Already registered! Session is active.');
            console.log(`📱 Connected as: ${sock.user?.id}`);

            // Keep running to maintain session
            console.log('🟢 Maintaining active session...');
        }

    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Start connection
connectWithPairingCode().catch(console.error);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down gracefully...');
    if (sock) {
        sock.end();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received termination signal...');
    if (sock) {
        sock.end();
    }
    process.exit(0);
});

// Keep process alive
process.stdin.resume();