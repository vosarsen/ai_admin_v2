const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

/**
 * WhatsApp Management API Routes
 * For controlled connection management during maintenance
 */

// Disconnect WhatsApp for specific company
router.post('/sessions/:companyId/disconnect', async (req, res) => {
    const { companyId } = req.params;

    try {
        const sessionPool = req.app.locals.sessionPool;

        if (!sessionPool) {
            return res.status(500).json({
                success: false,
                error: 'Session pool not initialized'
            });
        }

        // Check if session exists
        const session = sessionPool.sessions.get(companyId);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: `No active session for company ${companyId}`
            });
        }

        // Remove session (will disconnect)
        await sessionPool.removeSession(companyId);

        logger.info(`🔌 WhatsApp disconnected for company ${companyId} via API`);

        res.json({
            success: true,
            message: `WhatsApp disconnected for company ${companyId}`,
            note: 'Session will auto-reconnect in 30-60 seconds unless prevented'
        });

    } catch (error) {
        logger.error(`Failed to disconnect company ${companyId}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Reconnect WhatsApp for specific company
router.post('/sessions/:companyId/reconnect', async (req, res) => {
    const { companyId } = req.params;

    try {
        const sessionPool = req.app.locals.sessionPool;

        if (!sessionPool) {
            return res.status(500).json({
                success: false,
                error: 'Session pool not initialized'
            });
        }

        // Create new session
        await sessionPool.createSession(companyId);

        logger.info(`🔄 WhatsApp reconnection initiated for company ${companyId} via API`);

        res.json({
            success: true,
            message: `WhatsApp reconnection initiated for company ${companyId}`,
            note: 'Check status endpoint to verify connection'
        });

    } catch (error) {
        logger.error(`Failed to reconnect company ${companyId}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get session status
router.get('/sessions/:companyId/status', async (req, res) => {
    const { companyId } = req.params;

    try {
        const sessionPool = req.app.locals.sessionPool;

        if (!sessionPool) {
            return res.status(500).json({
                success: false,
                error: 'Session pool not initialized'
            });
        }

        const session = sessionPool.sessions.get(companyId);
        const authPath = sessionPool.authPaths.get(companyId);

        // Count auth files if path exists
        let fileCount = 0;
        if (authPath) {
            const fs = require('fs-extra');
            try {
                const files = await fs.readdir(authPath);
                fileCount = files.length;
            } catch (err) {
                // Directory might not exist
            }
        }

        res.json({
            success: true,
            companyId,
            connected: !!session,
            status: session ? 'connected' : 'disconnected',
            authFiles: fileCount,
            health: {
                healthy: fileCount < 150,
                warning: fileCount >= 120,
                critical: fileCount >= 180
            }
        });

    } catch (error) {
        logger.error(`Failed to get status for company ${companyId}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Trigger cleanup for specific company
router.post('/sessions/:companyId/cleanup', async (req, res) => {
    const { companyId } = req.params;
    const { force = false } = req.body;

    try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        // Check if connected (unless forced)
        if (!force) {
            const sessionPool = req.app.locals.sessionPool;
            const session = sessionPool.sessions.get(companyId);

            if (session) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot cleanup while connected. Disconnect first or use force=true'
                });
            }
        }

        // Run cleanup
        const authPath = `/opt/ai-admin/baileys_sessions/company_${companyId}`;
        const { stdout } = await execAsync(
            `COMPANY_ID=${companyId} AUTH_PATH=${authPath} node scripts/whatsapp-smart-cleanup.js`,
            { cwd: '/opt/ai-admin' }
        );

        // Parse results
        const removedMatch = stdout.match(/Removed: (\d+)/);
        const finalMatch = stdout.match(/Final count: (\d+)/);

        logger.info(`🧹 Cleanup completed for company ${companyId}`);

        res.json({
            success: true,
            companyId,
            filesRemoved: removedMatch ? parseInt(removedMatch[1]) : 0,
            finalCount: finalMatch ? parseInt(finalMatch[1]) : 0
        });

    } catch (error) {
        logger.error(`Failed to cleanup company ${companyId}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;