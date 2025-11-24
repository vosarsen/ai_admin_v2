// src/api/routes/contact.js
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const logger = require('../../utils/logger');
const { body, validationResult } = require('express-validator');
const rateLimiter = require('../../middlewares/rate-limiter');

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Send contact form email
 *     description: Accepts contact form data and sends email to support
 *     tags:
 *       - Contact
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Иван Иванов"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "ivan@example.com"
 *               phone:
 *                 type: string
 *                 example: "+7 (999) 123-45-67"
 *               message:
 *                 type: string
 *                 example: "Хочу узнать больше о продукте"
 *     responses:
 *       200:
 *         description: Email sent successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/contact',
  rateLimiter, // Rate limiting to prevent spam
  [
    // Validation
    body('name').trim().notEmpty().withMessage('Имя обязательно'),
    body('email').isEmail().normalizeEmail().withMessage('Некорректный email'),
    body('phone').trim().notEmpty().withMessage('Телефон обязателен'),
    body('message').optional().trim()
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { name, email, phone, message } = req.body;

      // Create transporter
      // Using Gmail SMTP - you'll need to configure these environment variables
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.CONTACT_EMAIL_USER || 'your-email@gmail.com',
          pass: process.env.CONTACT_EMAIL_PASSWORD || 'your-app-password'
        }
      });

      // Email content
      const mailOptions = {
        from: process.env.CONTACT_EMAIL_USER || 'your-email@gmail.com',
        to: 'support@adminai.tech',
        replyTo: email,
        subject: `Новая заявка с сайта от ${name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
              Новая заявка с лендинга AI Admin
            </h2>

            <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 10px 0;">
                <strong style="color: #667eea;">Имя:</strong> ${name}
              </p>
              <p style="margin: 10px 0;">
                <strong style="color: #667eea;">Email:</strong>
                <a href="mailto:${email}" style="color: #667eea;">${email}</a>
              </p>
              <p style="margin: 10px 0;">
                <strong style="color: #667eea;">Телефон:</strong>
                <a href="tel:${phone.replace(/[^0-9+]/g, '')}" style="color: #667eea;">${phone}</a>
              </p>
            </div>

            ${message ? `
              <div style="margin: 20px 0;">
                <h3 style="color: #333;">Сообщение:</h3>
                <p style="background-color: #f7fafc; padding: 15px; border-radius: 8px; line-height: 1.6;">
                  ${message}
                </p>
              </div>
            ` : ''}

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

            <p style="color: #718096; font-size: 12px; text-align: center;">
              Заявка отправлена с сайта ai-admin.app
              <br>
              Время отправки: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} (МСК)
            </p>
          </div>
        `
      };

      // Send email
      const info = await transporter.sendMail(mailOptions);

      logger.info('Contact form email sent successfully', {
        messageId: info.messageId,
        from: email,
        name
      });

      res.json({
        success: true,
        message: 'Спасибо! Ваша заявка отправлена. Мы свяжемся с вами в течение 24 часов.'
      });

    } catch (error) {
      logger.error('Error sending contact form email:', error);

      res.status(500).json({
        success: false,
        message: 'Произошла ошибка при отправке сообщения. Пожалуйста, попробуйте позже или свяжитесь с нами напрямую по email: support@adminai.tech'
      });
    }
  }
);

module.exports = router;
