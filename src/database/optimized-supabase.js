// Оптимизированный клиент Supabase для AI Admin v2
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');
const config = require("../config");
const logger = require("../utils/logger");

// Redis для быстрого кэширования
const redis = new Redis(config.redis.url, {
  password: config.redis.password,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true
});

// Пул соединений Supabase
const supabasePool = [];
const POOL_SIZE = 5;

// Создаем пул клиентов для параллельных запросов
for (let i = 0; i < POOL_SIZE; i++) {
  supabasePool.push(createClient(
    config.database.supabaseUrl, 
    config.database.supabaseKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'x-connection-id': `pool-${i}`
        }
      }
    }
  ));
}

// Получаем клиент из пула (round-robin)
let currentClient = 0;
function getClient() {
  const client = supabasePool[currentClient];
  currentClient = (currentClient + 1) % POOL_SIZE;
  return client;
}

/**
 * Оптимизированная загрузка данных с многоуровневым кэшированием
 */
class OptimizedSupabaseClient {
  constructor() {
    this.cacheConfig = {
      // Статичные данные - долгий кэш
      services: { ttl: 1800, prefix: 'svc' },      // 30 минут
      staff: { ttl: 1800, prefix: 'stf' },         // 30 минут
      companies: { ttl: 3600, prefix: 'cmp' },     // 1 час
      
      // Динамические данные - короткий кэш
      clients: { ttl: 300, prefix: 'cli' },        // 5 минут
      staff_schedules: { ttl: 120, prefix: 'sch' },      // 2 минуты
      slots: { ttl: 300, prefix: 'slt' },          // 5 минут
      
      // Контекст диалога
      context: { ttl: 300, prefix: 'ctx' }         // 5 минут
    };
  }

  /**
   * Получить данные с кэшированием
   */
  async getCached(table, key, queryBuilder) {
    const config = this.cacheConfig[table] || { ttl: 300, prefix: table };
    const cacheKey = `${config.prefix}:${key}`;
    
    try {
      // 1. Проверяем Redis кэш
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug(`Cache hit: ${cacheKey}`);
        return JSON.parse(cached);
      }
      
      // 2. Запрос к Supabase
      const startTime = Date.now();
      const { data, error } = await queryBuilder(getClient().from(table));
      
      if (error) throw error;
      
      const queryTime = Date.now() - startTime;
      logger.debug(`Supabase query: ${table} (${queryTime}ms)`);
      
      // 3. Кэшируем результат
      if (data) {
        await redis.setex(cacheKey, config.ttl, JSON.stringify(data));
      }
      
      return data;
      
    } catch (error) {
      logger.error(`Error fetching ${table}:`, error);
      throw error;
    }
  }

  /**
   * Загрузка услуг компании с оптимизацией
   */
  async getServices(companyId, { limit = 50, activeOnly = true } = {}) {
    const key = `${companyId}:${activeOnly}:${limit}`;
    
    return this.getCached('services', key, (query) => {
      let q = query
        .select(`
          id, yclients_id, title, category_id, category_title,
          price_min, price_max, duration, weight, 
          description, image_url
        `)
        .eq('company_id', companyId)
        .order('weight', { ascending: false })
        .limit(limit);
      
      if (activeOnly) {
        q = q.eq('is_active', true);
      }
      
      return q;
    });
  }

  /**
   * Загрузка мастеров с оптимизацией
   */
  async getStaff(companyId, { limit = 30, activeOnly = true } = {}) {
    const key = `${companyId}:${activeOnly}:${limit}`;
    
    return this.getCached('staff', key, (query) => {
      let q = query
        .select(`
          id, yclients_id, name, specialization, position,
          rating, votes_count, avatar_url, service_ids
        `)
        .eq('company_id', companyId)
        .order('rating', { ascending: false, nullsFirst: false })
        .limit(limit);
      
      if (activeOnly) {
        q = q.eq('is_active', true);
      }
      
      return q;
    });
  }

  /**
   * Загрузка расписания (оптимизировано для v2)
   */
  async getSchedules(companyId, startDate, endDate) {
    const key = `${companyId}:${startDate}:${endDate}`;
    
    try {
      const result = await this.getCached('staff_schedules', key, (query) =>
        query
          .select(`
            staff_id, staff_name, date, is_working,
            work_start, work_end, has_booking_slots
          `)
          // Временно убираем фильтр по company_id, так как колонки нет
          // .eq('company_id', companyId)
          .gte('date', startDate)
          .lte('date', endDate)
          .eq('is_working', true)
          .order('date')
      );
      
      return result || [];
    } catch (error) {
      logger.error('Error fetching schedules:', error);
      // Возвращаем пустой массив при ошибке
      return [];
    }
  }

  /**
   * Параллельная загрузка всего контекста для AI v2
   */
  async loadFullContext(phone, companyId) {
    const contextKey = `ctx:${phone}:${companyId}`;
    
    // Проверяем кэш контекста
    const cached = await redis.get(contextKey);
    if (cached) {
      logger.debug('Context cache hit');
      return JSON.parse(cached);
    }
    
    logger.debug('Loading full context from database...');
    const startTime = Date.now();
    
    try {
      // Параллельная загрузка всех данных
      const [company, client, services, staff, schedules] = await Promise.all([
        // Компания (из кэша надолго)
        this.getCompany(companyId),
        
        // Клиент
        this.getClient(phone, companyId),
        
        // Услуги (топ-20 популярных)
        this.getServices(companyId, { limit: 20 }),
        
        // Мастера (топ-10 по рейтингу)
        this.getStaff(companyId, { limit: 10 }),
        
        // Расписание на неделю
        this.getSchedules(
          companyId,
          new Date().toISOString().split('T')[0],
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        )
      ]);
      
      const context = {
        company,
        client,
        services,
        staff,
        schedules,
        loadTime: Date.now() - startTime
      };
      
      // Кэшируем весь контекст на 5 минут
      await redis.setex(contextKey, 300, JSON.stringify(context));
      
      logger.info(`Context loaded in ${context.loadTime}ms`);
      return context;
      
    } catch (error) {
      logger.error('Error loading context:', error);
      throw error;
    }
  }

  /**
   * Загрузка информации о компании
   */
  async getCompany(companyId) {
    const key = `company:${companyId}`;
    const cached = await redis.get(key);
    
    if (cached) {
      logger.debug('Company cache hit');
      return JSON.parse(cached);
    }
    
    try {
      const { data, error } = await getClient()
        .from('companies')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();
      
      if (error) {
        logger.error('Error fetching company:', error);
      }
      
      const company = data || {
        company_id: companyId,
        yclients_id: companyId,
        title: config.company?.defaultTitle || 'Салон красоты',
        type: config.company?.defaultType || 'beauty',
        timezone: config.app?.timezone || 'Europe/Moscow',
        address: '',
        phone: '',
        working_hours: {}
      };
      
      // Кэшируем на час
      await redis.setex(key, 3600, JSON.stringify(company));
      
      return company;
    } catch (error) {
      logger.error('Failed to get company:', error);
      // Возвращаем fallback
      return {
        company_id: companyId,
        yclients_id: companyId,
        title: config.company?.defaultTitle || 'Салон красоты',
        type: config.company?.defaultType || 'beauty',
        timezone: config.app?.timezone || 'Europe/Moscow',
        address: '',
        phone: '',
        working_hours: {}
      };
    }
  }

  /**
   * Получить клиента с оптимизацией
   */
  async getClient(phone, companyId) {
    const key = `${phone}:${companyId}`;
    
    try {
      const result = await this.getCached('clients', key, async (query) => {
        const { data, error } = await query
          .select(`
            id, yclients_id, name, phone, discount,
            visit_count, total_spent, last_visit_date,
            favorite_staff_ids, last_service_ids,
            preferences, ai_context
          `)
          .eq('phone', phone)
          .eq('company_id', companyId)
          .maybeSingle();  // Используем maybeSingle вместо single
        
        if (error) throw error;
        
        // Если клиента нет, возвращаем пустой объект
        return data || {
          phone,
          name: 'Новый клиент',
          visit_count: 0,
          total_spent: 0,
          preferences: {}
        };
      });
      
      return result;
    } catch (error) {
      logger.error('Error fetching client:', error);
      // Возвращаем дефолтного клиента при ошибке
      return {
        phone,
        name: 'Новый клиент',
        visit_count: 0,
        total_spent: 0,
        preferences: {}
      };
    }
  }

  /**
   * Инвалидация кэша
   */
  async invalidateCache(table, companyId = null) {
    const config = this.cacheConfig[table];
    if (!config) return;
    
    const pattern = companyId 
      ? `${config.prefix}:${companyId}:*`
      : `${config.prefix}:*`;
    
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`Invalidated ${keys.length} cache keys for ${table}`);
    }
  }

  /**
   * Прогрев кэша для компании
   */
  async warmupCache(companyId) {
    logger.info(`Warming up cache for company ${companyId}...`);
    
    try {
      await Promise.all([
        this.getServices(companyId),
        this.getStaff(companyId),
        this.getSchedules(
          companyId,
          new Date().toISOString().split('T')[0],
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        )
      ]);
      
      logger.info(`Cache warmed up for company ${companyId}`);
    } catch (error) {
      logger.error(`Error warming up cache for company ${companyId}:`, error);
    }
  }

  /**
   * Мониторинг производительности
   */
  async getStats() {
    const info = await redis.info('stats');
    const keyspace = await redis.info('keyspace');
    
    return {
      redis: {
        connected: redis.status === 'ready',
        hitRate: this.parseRedisHitRate(info),
        keys: this.parseRedisKeys(keyspace),
        memory: await redis.info('memory')
      },
      supabase: {
        poolSize: POOL_SIZE,
        activeConnections: supabasePool.length
      }
    };
  }

  parseRedisHitRate(info) {
    const hits = info.match(/keyspace_hits:(\d+)/)?.[1] || 0;
    const misses = info.match(/keyspace_misses:(\d+)/)?.[1] || 0;
    const total = parseInt(hits) + parseInt(misses);
    return total > 0 ? (parseInt(hits) / total * 100).toFixed(2) + '%' : '0%';
  }

  parseRedisKeys(keyspace) {
    const match = keyspace.match(/db0:keys=(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
}

// Экспортируем синглтон
const optimizedClient = new OptimizedSupabaseClient();

module.exports = {
  supabase: getClient(), // Для обратной совместимости
  optimizedClient,
  
  // Быстрые методы для v2
  getServices: (companyId, options) => optimizedClient.getServices(companyId, options),
  getStaff: (companyId, options) => optimizedClient.getStaff(companyId, options),
  getClient: (phone, companyId) => optimizedClient.getClient(phone, companyId),
  loadFullContext: (phone, companyId) => optimizedClient.loadFullContext(phone, companyId),
  invalidateCache: (table, companyId) => optimizedClient.invalidateCache(table, companyId),
  warmupCache: (companyId) => optimizedClient.warmupCache(companyId),
  getStats: () => optimizedClient.getStats()
};