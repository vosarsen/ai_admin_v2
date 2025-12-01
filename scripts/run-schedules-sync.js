#!/usr/bin/env node
/**
 * PM2 entry point for schedules synchronization
 *
 * Usage:
 *   node scripts/run-schedules-sync.js --mode=full   # 30 days sync (daily at 5am)
 *   node scripts/run-schedules-sync.js --mode=today  # Today+tomorrow only (hourly 8-23)
 */

require('dotenv').config();
const Sentry = require('@sentry/node');
const { SchedulesSync } = require('../src/sync/schedules-sync');
const logger = require('../src/utils/logger').child({ module: 'run-schedules-sync' });

// Initialize Sentry for cron job tracking
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
}

async function main() {
  const mode = process.argv.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'full';
  const startTime = Date.now();

  logger.info(`Starting schedules sync (mode: ${mode})...`);

  try {
    const sync = new SchedulesSync();
    const result = mode === 'today'
      ? await sync.syncTodayOnly()
      : await sync.sync();

    const duration = Date.now() - startTime;

    if (result.success) {
      logger.info(`Schedules sync completed`, {
        mode,
        processed: result.processed,
        errors: result.errors,
        total: result.total,
        duration: `${duration}ms`
      });
      process.exit(0);
    } else {
      logger.error(`Schedules sync failed`, {
        mode,
        error: result.error,
        duration: `${duration}ms`
      });

      // Capture to Sentry
      if (process.env.SENTRY_DSN) {
        Sentry.captureMessage(`Schedules sync failed: ${result.error}`, {
          level: 'error',
          tags: {
            component: 'sync',
            sync_type: 'schedules',
            mode
          },
          extra: result
        });
        await Sentry.flush(2000);
      }

      process.exit(1);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Schedules sync crashed`, {
      mode,
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

    // Capture to Sentry
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: {
          component: 'sync',
          sync_type: 'schedules',
          mode
        }
      });
      await Sentry.flush(2000);
    }

    process.exit(1);
  }
}

main();
