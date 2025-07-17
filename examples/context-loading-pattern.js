/**
 * Context Loading Pattern Example
 * 
 * This pattern demonstrates how AI Admin v2 loads comprehensive context
 * in parallel for optimal performance.
 */

const { createClient } = require('@supabase/supabase-js');
const redis = require('../utils/redis-factory');

// Example 1: Parallel Context Loading
const loadFullContext = async (phone, companyId) => {
  const startTime = Date.now();
  
  // Load all data in parallel for performance
  const [
    company,
    client, 
    services,
    staff,
    conversation,
    businessStats,
    staffSchedules,
    activeBookings
  ] = await Promise.all([
    // Company info with business hours
    supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .maybeSingle(),
      
    // Client with history
    supabase
      .from('clients')
      .select(`
        *,
        bookings!bookings_client_id_fkey (
          id,
          datetime,
          services,
          staff_id,
          status
        )
      `)
      .eq('phone', phone)
      .eq('company_id', companyId)
      .maybeSingle(),
      
    // Services with categories
    supabase
      .from('services')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('weight', { ascending: false }),
      
    // Staff with specializations
    supabase
      .from('staff')
      .select(`
        *,
        staff_services!staff_services_staff_id_fkey (
          service_id,
          duration_override
        )
      `)
      .eq('company_id', companyId)
      .eq('is_active', true),
      
    // Recent conversation from Redis
    redis.get(`conversation:${phone}:${companyId}`),
    
    // Business statistics
    loadBusinessStats(companyId),
    
    // Staff schedules for next 7 days
    loadStaffSchedules(companyId, 7),
    
    // Active bookings for conflict checking
    loadActiveBookings(companyId)
  ]);
  
  // Process and structure the context
  const context = {
    company: company.data,
    client: enrichClientData(client.data),
    services: services.data,
    staff: staff.data,
    conversation: JSON.parse(conversation || '[]'),
    businessStats: businessStats,
    staffSchedules: staffSchedules,
    activeBookings: activeBookings,
    loadTime: Date.now() - startTime
  };
  
  return context;
};

// Example 2: Client Enrichment
const enrichClientData = (client) => {
  if (!client) return null;
  
  // Calculate client statistics
  const bookings = client.bookings || [];
  const completedBookings = bookings.filter(b => b.status === 'completed');
  
  return {
    ...client,
    stats: {
      totalBookings: bookings.length,
      completedBookings: completedBookings.length,
      cancelRate: bookings.length > 0 
        ? (bookings.filter(b => b.status === 'cancelled').length / bookings.length)
        : 0,
      favoriteServices: getFavoriteServices(bookings),
      favoriteStaff: getFavoriteStaff(bookings),
      lastVisit: getLastVisit(completedBookings),
      averageSpend: calculateAverageSpend(completedBookings)
    }
  };
};

// Example 3: Business Statistics Loading
const loadBusinessStats = async (companyId) => {
  const stats = await supabase
    .rpc('get_business_stats', { 
      p_company_id: companyId,
      p_days: 30 
    });
    
  return {
    bookingsLast30Days: stats.data?.bookings_count || 0,
    popularServices: stats.data?.popular_services || [],
    peakHours: stats.data?.peak_hours || [],
    averageBookingValue: stats.data?.avg_booking_value || 0
  };
};

// Example 4: Smart Context Caching
class ContextCache {
  constructor(ttl = 5 * 60 * 1000) { // 5 minutes default
    this.cache = new Map();
    this.ttl = ttl;
    
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }
  
  getCacheKey(phone, companyId) {
    return `${phone}:${companyId}`;
  }
  
  get(phone, companyId) {
    const key = this.getCacheKey(phone, companyId);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  set(phone, companyId, data) {
    const key = this.getCacheKey(phone, companyId);
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }
  
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Example 5: Context Usage in AI Prompt
const buildContextPrompt = (context) => {
  return `
КОНТЕКСТ КОМПАНИИ:
- Название: ${context.company.title}
- Тип: ${context.company.type}
- Часы работы: ${formatBusinessHours(context.company.business_hours)}
- Популярные услуги: ${context.businessStats.popularServices.join(', ')}

ИНФОРМАЦИЯ О КЛИЕНТЕ:
${context.client ? `
- Имя: ${context.client.name}
- Визитов: ${context.client.stats.totalBookings}
- Любимые услуги: ${context.client.stats.favoriteServices.join(', ')}
- Любимый мастер: ${context.client.stats.favoriteStaff}
- Последний визит: ${context.client.stats.lastVisit}
` : '- Новый клиент'}

ДОСТУПНЫЕ УСЛУГИ (${context.services.length}):
${context.services.slice(0, 10).map(s => 
  `- ${s.title}: ${s.price_min}-${s.price_max}₽ (${s.duration / 60} мин)`
).join('\n')}

МАСТЕРА (${context.staff.length}):
${context.staff.map(s => 
  `- ${s.name}: ${s.position || 'Мастер'}`
).join('\n')}

ИСТОРИЯ ДИАЛОГА:
${context.conversation.slice(-5).map(msg => 
  `${msg.role}: ${msg.content}`
).join('\n')}
`;
};

module.exports = {
  loadFullContext,
  enrichClientData,
  loadBusinessStats,
  ContextCache,
  buildContextPrompt
};