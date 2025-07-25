#!/usr/bin/env node

const express = require('express');
const venom = require('venom-bot');
const logger = require('../src/utils/logger');

const app = express();
app.use(express.json());

let client = null;

// Initialize Venom Bot
venom
  .create({
    session: 'ai-admin-webhook',
    multidevice: true,
    disableWelcome: true,
    disableSpins: true,
    headless: 'new',
    executablePath: '/usr/bin/chromium-browser',
    useChrome: false,
    puppeteerOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    }
  })
  .then((venomClient) => {
    client = venomClient;
    logger.info('✅ Venom Bot initialized');
  })
  .catch((error) => {
    logger.error('Failed to initialize Venom Bot:', error);
    process.exit(1);
  });

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    venomReady: !!client,
    timestamp: new Date().toISOString()
  });
});

// Send message endpoint
app.post('/send-message', async (req, res) => {
  const { to, message } = req.body;
  
  if (!client) {
    return res.status(503).json({ 
      success: false, 
      error: 'Venom Bot not initialized' 
    });
  }
  
  if (!to || !message) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: to, message' 
    });
  }
  
  try {
    await client.sendText(to, message);
    logger.info(`📤 Message sent: ${to}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to send message:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Start server
const PORT = process.env.VENOM_PORT || 3001;
app.listen(PORT, () => {
  logger.info(`🚀 Venom webhook server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down Venom Bot...');
  if (client) {
    await client.close();
  }
  process.exit(0);
});