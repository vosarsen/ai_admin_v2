#!/usr/bin/env node

/**
 * Простая синхронизация услуг без генерации склонений
 * Для первичной загрузки услуг в БД
 */

require('dotenv').config();
const { supabase } = require('../src/database/supabase');
const axios = require('axios');
const logger = require('../src/utils/logger').child({ module: 'sync-services-simple' });

const YCLIENTS_CONFIG = {
  BASE_URL: 'https://api.yclients.com/api/v1',
  COMPANY_ID: process.env.YCLIENTS_COMPANY_ID || 962302,
  BEARER_TOKEN: process.env.YCLIENTS_BEARER_TOKEN || process.env.YCLIENTS_API_KEY,
  USER_TOKEN: process.env.YCLIENTS_USER_TOKEN,
  PARTNER_ID: process.env.YCLIENTS_PARTNER_ID
};

function createHeaders() {
  return {
    'Accept': 'application/vnd.api.v2+json',
    'Authorization': `Bearer ${YCLIENTS_CONFIG.BEARER_TOKEN}, User ${YCLIENTS_CONFIG.USER_TOKEN}`,
    'Content-Type': 'application/json'
  };
}

async function fetchServices() {
  try {
    const url = `${YCLIENTS_CONFIG.BASE_URL}/company/${YCLIENTS_CONFIG.COMPANY_ID}/services`;
    const headers = createHeaders();
    
    logger.info('Fetching services from YClients...');
    
    const response = await axios.get(url, { headers });
    
    if (response.data?.success === false) {
      throw new Error(response.data?.meta?.message || 'API returned error');
    }
    
    return response.data?.data || [];
    
  } catch (error) {
    logger.error('Failed to fetch services:', error.message);
    throw error;
  }
}

async function saveServices(services) {
  let processed = 0;
  let errors = 0;

  for (const service of services) {
    try {
      const serviceData = {
        yclients_id: service.id,
        company_id: YCLIENTS_CONFIG.COMPANY_ID,
        title: service.title || 'Unnamed Service',
        category_id: service.category_id || null,
        price_min: service.price_min || 0,
        price_max: service.price_max || service.price_min || 0,
        discount: service.discount || 0,
        duration: service.seance_length || null,
        seance_length: service.seance_length || null,
        is_active: service.active === 1 || service.active === "1",
        is_bookable: service.bookable !== 0 && service.bookable !== "0",
        description: service.comment || null,
        weight: service.weight || 0,
        last_sync_at: new Date().toISOString(),
        raw_data: service
      };
      
      const { error } = await supabase
        .from('services')
        .upsert(serviceData, { 
          onConflict: 'yclients_id,company_id',
          ignoreDuplicates: false 
        });

      if (error) {
        errors++;
        logger.warn(`Failed to save service: ${service.title}`, { error: error.message });
      } else {
        processed++;
        if (processed % 10 === 0) {
          logger.info(`Progress: ${processed}/${services.length} services processed`);
        }
      }

    } catch (error) {
      errors++;
      logger.error('Error processing service', {
        service: service.title,
        error: error.message
      });
    }
  }

  return { processed, errors };
}

async function main() {
  try {
    logger.info('🚀 Starting simple services sync...');
    
    // Получаем услуги
    const services = await fetchServices();
    logger.info(`📋 Found ${services.length} services`);
    
    if (services.length === 0) {
      logger.warn('No services found');
      return;
    }
    
    // Сохраняем без склонений
    const result = await saveServices(services);
    
    logger.info(`✅ Sync completed: ${result.processed} processed, ${result.errors} errors`);
    
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

main();