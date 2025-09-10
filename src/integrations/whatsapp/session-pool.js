/**
 * WhatsApp Session Pool Manager
 * Централизованное управление всеми WhatsApp сессиями
 * Гарантирует что для каждой компании существует только одна сессия
 */

const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs-extra');
const EventEmitter = require('events');
const logger = require('../../utils/logger');

class WhatsAppSessionPool extends EventEmitter {
    constructor() {
        super();
        this.sessions = new Map(); // companyId -> session
        this.authPaths = new Map(); // companyId -> authPath
        this.reconnectAttempts = new Map(); // companyId -> attempts
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        
        // Директория для хранения сессий
        this.baseAuthPath = path.join(process.cwd(), 'baileys_sessions');
        this.ensureBaseDirectory();
    }

    /**
     * Создает базовую директорию для сессий
     */
    async ensureBaseDirectory() {
        await fs.ensureDir(this.baseAuthPath);
    }

    /**
     * Получает или создает сессию для компании
     */
    async getOrCreateSession(companyId) {
        // Проверяем существующую сессию
        if (this.sessions.has(companyId)) {
            const session = this.sessions.get(companyId);
            if (session.ws && session.ws.readyState === 1) {
                logger.info(`✅ Using existing session for company ${companyId}`);
                return session;
            }
        }

        // Создаем новую сессию
        logger.info(`🔄 Creating new session for company ${companyId}`);
        return await this.createSession(companyId);
    }

    /**
     * Создает новую сессию для компании
     */
    async createSession(companyId) {
        try {
            // Путь для хранения auth данных компании
            const authPath = path.join(this.baseAuthPath, `company_${companyId}`);
            await fs.ensureDir(authPath);
            this.authPaths.set(companyId, authPath);

            // Загружаем или создаем состояние аутентификации
            const { state, saveCreds } = await useMultiFileAuthState(authPath);

            // Создаем socket
            const sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: 'error' }),
                browser: ['AI Admin', 'Chrome', '1.0.0'],
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: false,
                syncFullHistory: false
            });

            // Сохраняем в пул
            this.sessions.set(companyId, sock);

            // Настраиваем обработчики событий
            this.setupEventHandlers(companyId, sock, saveCreds);

            return sock;
        } catch (error) {
            logger.error(`Failed to create session for company ${companyId}:`, error);
            throw error;
        }
    }

    /**
     * Настраивает обработчики событий для сессии
     */
    setupEventHandlers(companyId, sock, saveCreds) {
        // Обработка обновлений соединения
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                logger.info(`📱 QR Code generated for company ${companyId}`);
                this.emit('qr', { companyId, qr });
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                    ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                    : true;

                if (shouldReconnect) {
                    await this.handleReconnect(companyId);
                } else {
                    logger.warn(`Session logged out for company ${companyId}`);
                    await this.removeSession(companyId);
                }
            }

            if (connection === 'open') {
                logger.info(`✅ WhatsApp connected for company ${companyId}`);
                this.reconnectAttempts.set(companyId, 0);
                this.emit('connected', { companyId });
            }
        });

        // Сохранение credentials
        sock.ev.on('creds.update', saveCreds);

        // Обработка входящих сообщений
        sock.ev.on('messages.upsert', async ({ messages }) => {
            for (const msg of messages) {
                if (!msg.key.fromMe && msg.message) {
                    this.emit('message', { companyId, message: msg });
                }
            }
        });
    }

    /**
     * Обрабатывает переподключение
     */
    async handleReconnect(companyId) {
        const attempts = this.reconnectAttempts.get(companyId) || 0;
        
        if (attempts >= this.maxReconnectAttempts) {
            logger.error(`Max reconnection attempts reached for company ${companyId}`);
            await this.removeSession(companyId);
            return;
        }

        const delay = this.reconnectDelay * Math.pow(2, attempts); // Exponential backoff
        logger.info(`🔄 Reconnecting company ${companyId} in ${delay}ms (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);
        
        this.reconnectAttempts.set(companyId, attempts + 1);
        
        setTimeout(async () => {
            try {
                await this.createSession(companyId);
            } catch (error) {
                logger.error(`Reconnection failed for company ${companyId}:`, error);
            }
        }, delay);
    }

    /**
     * Удаляет сессию компании
     */
    async removeSession(companyId) {
        const sock = this.sessions.get(companyId);
        if (sock) {
            sock.ev.removeAllListeners();
            sock.ws?.close();
        }
        
        this.sessions.delete(companyId);
        this.reconnectAttempts.delete(companyId);
        
        // Опционально: удаляем auth данные
        // const authPath = this.authPaths.get(companyId);
        // if (authPath) {
        //     await fs.remove(authPath);
        // }
        
        logger.info(`🗑️ Session removed for company ${companyId}`);
    }

    /**
     * Отправляет сообщение через сессию компании
     */
    async sendMessage(companyId, phone, message) {
        const sock = await this.getOrCreateSession(companyId);
        
        if (!sock || sock.ws?.readyState !== 1) {
            throw new Error(`No active session for company ${companyId}`);
        }

        const jid = `${phone}@s.whatsapp.net`;
        
        try {
            const result = await sock.sendMessage(jid, { text: message });
            logger.info(`✅ Message sent for company ${companyId} to ${phone}`);
            return result;
        } catch (error) {
            logger.error(`Failed to send message for company ${companyId}:`, error);
            throw error;
        }
    }

    /**
     * Получает статус сессии
     */
    getSessionStatus(companyId) {
        const sock = this.sessions.get(companyId);
        
        if (!sock) {
            return { connected: false, status: 'not_initialized' };
        }

        const connected = sock.ws?.readyState === 1;
        const status = connected ? 'connected' : 'disconnected';
        
        return { 
            connected, 
            status,
            reconnectAttempts: this.reconnectAttempts.get(companyId) || 0
        };
    }

    /**
     * Инициализирует сессию и ожидает QR код
     */
    async initializeSession(companyId) {
        // Удаляем старую сессию если есть
        await this.removeSession(companyId);
        
        // Очищаем auth данные для новой сессии
        const authPath = path.join(this.baseAuthPath, `company_${companyId}`);
        await fs.remove(authPath);
        
        // Создаем новую сессию
        const sock = await this.createSession(companyId);
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.removeListener('qr', qrHandler);
                this.removeListener('connected', connectedHandler);
                reject(new Error('QR code generation timeout'));
            }, 60000); // 1 minute timeout

            const qrHandler = (data) => {
                if (data.companyId === companyId) {
                    clearTimeout(timeout);
                    this.removeListener('connected', connectedHandler);
                    resolve({ qr: data.qr });
                }
            };

            const connectedHandler = (data) => {
                if (data.companyId === companyId) {
                    clearTimeout(timeout);
                    this.removeListener('qr', qrHandler);
                    resolve({ connected: true });
                }
            };

            this.once('qr', qrHandler);
            this.once('connected', connectedHandler);
        });
    }

    /**
     * Получает список всех активных сессий
     */
    getActiveSessions() {
        const sessions = [];
        
        for (const [companyId, sock] of this.sessions) {
            sessions.push({
                companyId,
                ...this.getSessionStatus(companyId)
            });
        }
        
        return sessions;
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        logger.info('Shutting down WhatsApp Session Pool...');
        
        for (const [companyId] of this.sessions) {
            await this.removeSession(companyId);
        }
        
        logger.info('WhatsApp Session Pool shutdown complete');
    }
}

// Singleton instance
let sessionPool = null;

function getSessionPool() {
    if (!sessionPool) {
        sessionPool = new WhatsAppSessionPool();
    }
    return sessionPool;
}

module.exports = {
    WhatsAppSessionPool,
    getSessionPool
};