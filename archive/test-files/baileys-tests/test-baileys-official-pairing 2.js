#!/usr/bin/env node

const { makeWASocket, fetchLatestBaileysVersion, useMultiFileAuthState, makeCacheableSignalKeyStore, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function connectWithPairingCode() {
    console.log('🚀 Starting WhatsApp connection with Pairing Code...\n');

    // Get phone number
    const phoneNumber = await question('Enter your WhatsApp phone number (without +): ');
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    console.log(`📱 Using phone number: ${cleanPhone}\n`);

    // Setup auth state
    const authFolder = path.join(__dirname, 'baileys_test_auth');
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    // Get latest version
    const { version } = await fetchLatestBaileysVersion();
    console.log(`📦 Using Baileys version: ${version}\n`);

    // Create socket with official example configuration
    const sock = makeWASocket({
        version,
        logger: pino({ level: 'debug' }), // Set to debug to see more details
        printQRInTerminal: false, // Must be false for pairing code
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        // CRITICAL: This exact browser config works with pairing code
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false
    });

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        console.log('📡 Connection update:', { connection, hasQR: !!qr });

        // Request pairing code when QR is available (like in our working code)
        if (qr && !sock.pairingCodeRequested) {
            sock.pairingCodeRequested = true; // Prevent multiple requests
            console.log('🔄 QR available, requesting pairing code...');

            try {
                const code = await sock.requestPairingCode(cleanPhone);
                const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;

                console.log('\n' + '='.repeat(50));
                console.log(`✅ PAIRING CODE: ${formattedCode}`);
                console.log('='.repeat(50));
                console.log('\n📱 To link device:');
                console.log('1. Open WhatsApp on your phone');
                console.log('2. Go to Settings → Linked Devices');
                console.log('3. Tap "Link a Device"');
                console.log('4. Choose "Link with phone number instead"');
                console.log(`5. Enter code: ${code} (without dashes)`);
                console.log('\n⏱️ Code expires in 60 seconds!\n');
            } catch (error) {
                console.error('❌ Failed to get pairing code:', error.message);
                sock.pairingCodeRequested = false; // Allow retry
            }
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            console.log('❌ Connection closed, reconnect:', shouldReconnect);
            if (shouldReconnect) {
                connectWithPairingCode();
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp connected successfully!');
            console.log('📱 You can now use WhatsApp Web features');

            // Test by getting user info
            const me = sock.user;
            console.log('👤 Connected as:', me);
        }
    });

    // Save credentials
    sock.ev.on('creds.update', saveCreds);

    // Handle errors
    sock.ev.on('error', (error) => {
        console.error('❌ Socket error:', error);
    });

    return sock;
}

// Run the connection
connectWithPairingCode()
    .then(() => {
        console.log('✅ Script started successfully');
    })
    .catch((error) => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });

// Keep the process alive
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    process.exit(0);
});