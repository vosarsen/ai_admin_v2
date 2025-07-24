const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger').child({ module: 'api:calendar' });
const icsGenerator = require('../../utils/ics-generator');
const crypto = require('crypto');

// Временное хранилище для ics данных (в production лучше использовать Redis)
const icsCache = new Map();

// Очистка старых записей каждые 30 минут
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of icsCache.entries()) {
    if (now - value.timestamp > 3600000) { // 1 час
      icsCache.delete(key);
    }
  }
}, 1800000); // 30 минут

/**
 * Генерация временной ссылки для скачивания .ics файла
 */
router.post('/generate-ics-link', (req, res) => {
  try {
    const { booking, companyName } = req.body;
    
    if (!booking || !booking.datetime) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid booking data' 
      });
    }
    
    // Генерируем уникальный токен для ссылки
    const token = crypto.randomBytes(16).toString('hex');
    
    // Генерируем .ics контент
    const icsContent = icsGenerator.generateBookingICS(
      booking, 
      companyName || 'Салон красоты'
    );
    
    // Сохраняем в кэш
    icsCache.set(token, {
      content: icsContent,
      fileName: icsGenerator.generateFileName(booking),
      timestamp: Date.now()
    });
    
    // Формируем ссылку
    const baseUrl = process.env.API_BASE_URL || `http://${req.get('host')}`;
    const downloadUrl = `${baseUrl}/api/calendar/download/${token}`;
    
    logger.info('Generated ICS download link', { token, fileName: icsCache.get(token).fileName });
    
    res.json({
      success: true,
      url: downloadUrl,
      expiresIn: 3600 // 1 час
    });
    
  } catch (error) {
    logger.error('Failed to generate ICS link:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate calendar link' 
    });
  }
});

/**
 * Скачивание .ics файла по токену
 */
router.get('/download/:token', (req, res) => {
  try {
    const { token } = req.params;
    const icsData = icsCache.get(token);
    
    if (!icsData) {
      return res.status(404).send('Calendar file not found or expired');
    }
    
    // Устанавливаем правильные заголовки для .ics файла
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${icsData.fileName}"`);
    
    // Для iOS важно добавить этот заголовок
    res.setHeader('Content-Description', 'File Transfer');
    
    // Отправляем файл
    res.send(icsData.content);
    
    logger.info('ICS file downloaded', { token, fileName: icsData.fileName });
    
    // Удаляем из кэша после скачивания (опционально)
    // icsCache.delete(token);
    
  } catch (error) {
    logger.error('Failed to download ICS:', error);
    res.status(500).send('Failed to download calendar file');
  }
});

module.exports = router;