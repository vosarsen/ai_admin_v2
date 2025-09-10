#!/usr/bin/env node

// Baileys QR Server - Web interface for QR code authentication
require('dotenv').config();
const express = require('express');
const http = require('http');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const PORT = 3002;

let currentQR = null;
let isConnected = false;
let connectionStatus = 'Waiting for initialization...';

// HTML page for QR display
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>WhatsApp QR Authentication</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: #f0f2f5;
        }
        .container {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 2px 20px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 400px;
        }
        h1 { color: #128c7e; }
        #qrcode {
          margin: 20px 0;
          padding: 20px;
          background: white;
          border: 2px solid #128c7e;
          border-radius: 8px;
          min-height: 280px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .status {
          padding: 10px;
          border-radius: 5px;
          margin-top: 10px;
        }
        .waiting { background: #fff3cd; color: #856404; }
        .connected { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .instructions {
          background: #e7f3ff;
          padding: 15px;
          border-radius: 8px;
          margin-top: 20px;
          text-align: left;
        }
        .instructions h3 { margin-top: 0; }
        .instructions ol { margin: 10px 0; padding-left: 20px; }
      </style>
      <script>
        function checkQR() {
          fetch('/qr-status')
            .then(res => res.json())
            .then(data => {
              const qrDiv = document.getElementById('qrcode');
              const statusDiv = document.getElementById('status');
              
              statusDiv.textContent = data.status;
              statusDiv.className = 'status ' + (data.connected ? 'connected' : 'waiting');
              
              if (data.qr && !data.connected) {
                qrDiv.innerHTML = '<img src="' + data.qr + '" alt="QR Code" />';
              } else if (data.connected) {
                qrDiv.innerHTML = '<h2 style="color: #128c7e;">✅ Connected!</h2>';
                setTimeout(() => {
                  window.location.reload();
                }, 5000);
              } else {
                qrDiv.innerHTML = '<p>Waiting for QR code...</p>';
              }
            });
        }
        
        setInterval(checkQR, 2000);
        window.onload = checkQR;
      </script>
    </head>
    <body>
      <div class="container">
        <h1>🤖 AI Admin WhatsApp</h1>
        <h2>Baileys Authentication</h2>
        
        <div id="qrcode">
          <p>Loading...</p>
        </div>
        
        <div id="status" class="status waiting">
          Initializing...
        </div>
        
        <div class="instructions">
          <h3>📱 How to connect:</h3>
          <ol>
            <li>Open WhatsApp on your phone</li>
            <li>Tap Menu (⋮) → Linked Devices</li>
            <li>Tap "Link a Device"</li>
            <li>Scan the QR code above</li>
          </ol>
        </div>
      </div>
    </body>
    </html>
  `);
});

// API endpoint for QR status
app.get('/qr-status', async (req, res) => {
  res.json({
    qr: currentQR,
    connected: isConnected,
    status: connectionStatus
  });
});

// Start Baileys
async function startBaileys() {
  const baileysProvider = require('../src/integrations/whatsapp/providers/baileys-provider');
  
  console.log('Initializing Baileys...');
  await baileysProvider.initialize();
  
  // Listen for QR code
  baileysProvider.on('qr', async ({ companyId, qr }) => {
    console.log('QR Code received!');
    connectionStatus = 'QR Code ready - Please scan';
    
    try {
      // Convert QR to data URL for web display
      currentQR = await QRCode.toDataURL(qr, {
        width: 280,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      console.log('QR code available at: http://46.149.70.219:3002');
    } catch (err) {
      console.error('QR generation error:', err);
    }
  });
  
  // Listen for connection
  baileysProvider.on('ready', ({ companyId }) => {
    console.log('✅ WhatsApp Connected!');
    isConnected = true;
    connectionStatus = 'Connected successfully!';
    currentQR = null;
    
    // Send test message
    setTimeout(async () => {
      try {
        await baileysProvider.sendMessage(
          companyId,
          '79686484488',
          '✅ Baileys успешно подключен через веб-интерфейс!\n\n' +
          '🚀 Система готова к работе\n' +
          '💾 Сессия сохранена'
        );
        console.log('Test message sent!');
      } catch (error) {
        console.error('Failed to send test message:', error);
      }
    }, 2000);
  });
  
  // Connect
  const companyId = process.env.YCLIENTS_COMPANY_ID || '962302';
  console.log(`Connecting for company: ${companyId}`);
  connectionStatus = 'Connecting to WhatsApp...';
  
  try {
    await baileysProvider.connectSession(companyId);
  } catch (error) {
    console.error('Connection error:', error);
    connectionStatus = 'Connection error: ' + error.message;
  }
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌐 QR Server running at: http://46.149.70.219:${PORT}`);
  console.log('Open this URL in your browser to see the QR code\n');
  
  // Start Baileys after server is ready
  startBaileys().catch(console.error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.close();
  process.exit(0);
});