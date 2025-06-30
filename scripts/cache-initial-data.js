// scripts/cache-initial-data.js
/**
 * Script to cache initial data from YClients to Redis
 * Run this before starting the application
 */

const config = require('../src/config');
const logger = require('../src/utils/logger');
const yclientsClient = require('../src/integrations/yclients/client');
const contextService = require('../src/services/context');

async function cacheInitialData() {
  try {
    logger.info('🚀 Starting initial data caching...');
    
    const companyId = config.yclients.companyId;
    
    // 1. Fetch and cache services
    logger.info('📦 Fetching services...');
    const servicesResult = await yclientsClient.getServices({}, companyId);
    
    if (servicesResult.success && servicesResult.data) {
      await contextService.cacheServices(companyId, servicesResult.data);
      logger.info(`✅ Cached ${servicesResult.data.length} services`);
    } else {
      logger.error('❌ Failed to fetch services');
    }
    
    // 2. Fetch and cache staff
    logger.info('👥 Fetching staff...');
    const staffResult = await yclientsClient.getStaff({}, companyId);
    
    if (staffResult.success && staffResult.data) {
      await contextService.cacheStaff(companyId, staffResult.data);
      logger.info(`✅ Cached ${staffResult.data.length} staff members`);
    } else {
      logger.error('❌ Failed to fetch staff');
    }
    
    // 3. Test YClients connection
    logger.info('🏢 Testing YClients connection...');
    const companyResult = await yclientsClient.getCompanyInfo(companyId);
    
    if (companyResult.success) {
      logger.info(`✅ Connected to company: ${companyResult.data.title}`);
    } else {
      logger.error('❌ Failed to connect to YClients');
    }
    
    logger.info('✅ Initial data caching completed');
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Cache script failed:', error);
    process.exit(1);
  }
}

// Run the script
cacheInitialData();