#!/usr/bin/env node

// Official Baileys implementation following documentation
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeInMemoryStore, Browsers } = require('baileys');
const { Boom } = require('@hapi/boom');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Logger configuration
const logger = P({ 
    level: 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            ignore: 'hostname,pid'
        }
    }
});

// Store for message history (optional but recommended)
const store = makeInMemoryStore({ logger });
store?.readFromFile('./baileys_store.json');

// Save store periodically
setInterval(() => {
    store?.writeToFile('./baileys_store.json');
}, 10_000);

async function connectToWhatsApp() {
    // Create auth folder
    const authFolder = path.join(process.cwd(), 'baileys_auth_info');
    
    // Use multi-file auth state as recommended in docs
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    
    // Fetch latest version
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WA version: ${version.join('.')}, isLatest: ${isLatest}`);
    
    // Create socket connection
    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: true, // This will print QR in terminal
        auth: state,
        browser: Browsers.ubuntu('Chrome'), // Use proper browser identification
        // implement socket connection options
        defaultQueryTimeoutMs: undefined,
        keepAliveIntervalMs: 30000,
        // handle connection updates
        getMessage: async (key) => {
            if(store) {
                const msg = await store.loadMessage(key.remoteJid, key.id);
                return msg?.message || undefined;
            }
            return {
                conversation: 'hello'
            };
        }
    });
    
    // Bind store
    store?.bind(sock.ev);
    
    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // QR Code handling
        if(qr) {
            console.log('\n============================================');
            console.log('QR CODE GENERATED - SCAN WITH WHATSAPP');
            console.log('============================================\n');
            
            // Print QR in terminal
            qrcode.generate(qr, { small: true });
            
            console.log('\n============================================');
            console.log('Steps to connect:');
            console.log('1. Open WhatsApp on your phone');
            console.log('2. Tap Menu (⋮) or Settings');
            console.log('3. Tap Linked Devices');
            console.log('4. Tap Link a Device');
            console.log('5. Scan this QR code');
            console.log('============================================\n');
        }
        
        // Connection status handling
        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
                : true;
            
            console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            
            // Reconnect if not logged out
            if(shouldReconnect) {
                connectToWhatsApp();
            }
        } else if(connection === 'open') {
            console.log('\n✅ Successfully connected to WhatsApp!');
            console.log('Bot is now ready to send and receive messages.\n');
            
            // Send test message after connection
            setTimeout(async () => {
                await sendTestMessage(sock);
            }, 2000);
        }
        
        // Log connection status
        console.log('Connection update:', update);
    });
    
    // Handle credentials update
    sock.ev.on('creds.update', saveCreds);
    
    // Handle messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        console.log('Got messages:', messages.length, 'type:', type);
        
        // Only process notify messages (new messages)
        if(type === 'notify') {
            for(const msg of messages) {
                // Skip if message is from us
                if(msg.key.fromMe) continue;
                
                // Get message content
                const messageContent = msg.message?.conversation || 
                                     msg.message?.extendedTextMessage?.text || 
                                     '';
                
                if(messageContent) {
                    console.log('New message from', msg.key.remoteJid, ':', messageContent);
                    
                    // Auto reply example
                    if(messageContent.toLowerCase().includes('привет')) {
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: 'Привет! Я AI Admin бот на Baileys. Чем могу помочь?'
                        });
                    }
                }
            }
        }
    });
    
    // Handle other events
    sock.ev.on('messages.update', m => console.log('Messages updated:', m));
    sock.ev.on('message-receipt.update', m => console.log('Receipt updated:', m));
    sock.ev.on('presence.update', m => console.log('Presence updated:', m));
    sock.ev.on('chats.update', m => console.log('Chats updated:', m));
    sock.ev.on('contacts.upsert', m => console.log('Contacts upserted:', m));
    
    return sock;
}

// Send test message function
async function sendTestMessage(sock) {
    const testNumber = '79686484488@s.whatsapp.net'; // Your test number
    
    try {
        await sock.sendMessage(testNumber, {
            text: '🎉 *Baileys успешно подключен!*\n\n' +
                  '✅ Официальная версия Baileys\n' +
                  '🚀 Готов к работе\n' +
                  '💾 Сессия сохранена\n' +
                  '🤖 AI Admin готов принимать сообщения\n\n' +
                  '_Отправьте "Привет" для теста автоответа_'
        });
        
        console.log('✅ Test message sent successfully!');
    } catch(error) {
        console.error('Failed to send test message:', error);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n\nShutting down...');
    store?.writeToFile('./baileys_store.json');
    process.exit(0);
});

// Start connection
console.log('Starting Baileys WhatsApp Bot...\n');
connectToWhatsApp()
    .then(() => console.log('Connection initiated'))
    .catch(err => console.error('Failed to connect:', err));