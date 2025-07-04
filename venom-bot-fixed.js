// opt/venom-bot/index.js
  const express = require('express');
  const cors = require('cors');
  const venom = require('venom-bot');
  const crypto = require('crypto');

  const app = express();
  const PORT = 3001;

  // Middleware
  app.use(cors());
  app.use(express.json());

  let client = null;
  let isClientReady = false;

  // Функция для генерации подписи webhook (совместимо с AI Admin)
  function generateWebhookSignature(method, path, timestamp, messageData, secret) {
    // AI Admin использует JSON.stringify(req.body) ПОСЛЕ парсинга
    // Поэтому нужно воссоздать точно такую же строку
    const body = JSON.stringify(messageData);
    const payload = `${method}:${path}:${timestamp}:${body}`;
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  // Функция отправки webhook с подписью
  async function sendWebhookWithSignature(messageData) {
    try {
      const timestamp = Date.now();
      const method = 'POST';
      const path = '/webhook/whatsapp';
      const secret = 'sk_venom_webhook_3553'; // Тот же что в .env
      
      const signature = generateWebhookSignature(method, path, timestamp, messageData, secret);
      
      // Отладочное логирование
      console.log(`🔐 Webhook signature debug:`, {
        method,
        path,
        timestamp,
        messageData,
        signature: signature.substring(0, 10) + '...'
      });
      
      const response = await fetch('http://localhost:3000/webhook/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Timestamp': timestamp.toString(),
          'X-Signature': signature
        },
        body: JSON.stringify(messageData)
      });

      console.log(`📨 Message forwarded with signature: ${messageData.from} -> AI Admin`);
      return response;
    } catch (error) {
      console.error('❌ Error forwarding message:', error);
      throw error;
    }
  }

  // Инициализация venom-bot
  async function initClient() {
    try {
      console.log('🚀 Starting venom-bot...');

      client = await venom.create({
        session: 'ai-admin-session',
        multiDevice: true,
        headless: 'new',
        devtools: false,
        useChrome: false,
        debug: false,
        logQR: true,
        browserArgs: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      isClientReady = true;
      console.log('✅ Venom-bot ready!');

      // Обработка входящих сообщений
      client.onMessage(async (message) => {
        try {
          // Отправляем сообщение в AI Admin через webhook с подписью
          await sendWebhookWithSignature({
            from: message.from,
            message: message.body,
            timestamp: message.timestamp
          });
        } catch (error) {
          console.error('❌ Error forwarding message:', error);
        }
      });

    } catch (error) {
      console.error('❌ Error starting venom-bot:', error);
      isClientReady = false;
    }
  }

  // API Routes
  app.get('/status', (req, res) => {
    res.json({
      status: isClientReady ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  });

  app.post('/send-message', async (req, res) => {
    try {
      const { to, message } = req.body;

      if (!isClientReady || !client) {
        return res.status(503).json({
          success: false,
          error: 'WhatsApp client not ready'
        });
      }

      await client.sendText(to, message);

      res.json({
        success: true,
        message: 'Message sent successfully'
      });

      console.log(`📤 Message sent: ${to}`);
    } catch (error) {
      console.error("❌ Error sending message:", error.message || error);
      res.status(500).json({
        success: false,
        error: error.message || "Unknown error"
      });
    }
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      whatsapp: isClientReady ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  });

  // Запуск сервера
  app.listen(PORT, () => {
    console.log(`🌐 Venom-bot server running on port ${PORT}`);
    initClient();
  });