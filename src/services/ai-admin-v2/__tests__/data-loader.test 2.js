// src/services/ai-admin-v2/__tests__/data-loader.test.js
const dataLoader = require('../modules/data-loader');
const { supabase } = require('../../../database/supabase');
const contextService = require('../../context');

// Mock dependencies
jest.mock('../../../database/supabase', () => ({
  supabase: {
    from: jest.fn()
  }
}));
jest.mock('../../context');
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('DataLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock chain for Supabase
    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const mockOrder = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockReturnThis();
    const mockGte = jest.fn().mockReturnThis();
    
    const mockQuery = {
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      order: mockOrder,
      limit: mockLimit,
      gte: mockGte,
      then: function(onFulfilled) {
        return Promise.resolve({ data: [], error: null }).then(onFulfilled);
      }
    };
    
    supabase.from.mockReturnValue(mockQuery);
  });

  describe('loadCompany', () => {
    it('should load company data', async () => {
      const mockCompany = {
        company_id: 1,
        title: 'Test Salon',
        address: 'Test Address',
        phone: '+79001234567'
      };
      
      supabase.from().maybeSingle.mockResolvedValue({ 
        data: mockCompany, 
        error: null 
      });
      
      const result = await dataLoader.loadCompany(1);
      
      expect(supabase.from).toHaveBeenCalledWith('companies');
      expect(result).toEqual(mockCompany);
    });

    it('should return empty object if company not found', async () => {
      supabase.from().maybeSingle.mockResolvedValue({ 
        data: null, 
        error: null 
      });
      
      const result = await dataLoader.loadCompany(1);
      
      expect(result).toEqual({});
    });

    it('should handle database errors', async () => {
      supabase.from().maybeSingle.mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      });
      
      const result = await dataLoader.loadCompany(1);
      
      expect(result).toEqual({});
    });
  });

  describe('loadClient', () => {
    it('should load client by phone', async () => {
      const mockClient = {
        id: 1,
        name: 'Иван',
        phone: '79001234567',
        company_id: 1
      };
      
      supabase.from().maybeSingle.mockResolvedValue({ 
        data: mockClient, 
        error: null 
      });
      
      const result = await dataLoader.loadClient('79001234567@c.us', 1);
      
      expect(supabase.from).toHaveBeenCalledWith('clients');
      expect(supabase.from().eq).toHaveBeenCalledWith('phone', '79001234567');
      expect(result).toEqual(mockClient);
    });

    it('should handle phone format variations', async () => {
      await dataLoader.loadClient('+7 (900) 123-45-67', 1);
      
      expect(supabase.from().eq).toHaveBeenCalledWith('phone', '79001234567');
    });

    it('should return null if client not found', async () => {
      supabase.from().maybeSingle.mockResolvedValue({ 
        data: null, 
        error: null 
      });
      
      const result = await dataLoader.loadClient('79001234567', 1);
      
      expect(result).toBeNull();
    });
  });

  describe('loadServices', () => {
    it('should load active services', async () => {
      const mockServices = [
        { id: 1, title: 'Стрижка', price_min: 1500, active: true },
        { id: 2, title: 'Борода', price_min: 800, active: true }
      ];
      
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockServices, error: null })
      };
      
      supabase.from.mockReturnValue(mockQuery);
      
      const result = await dataLoader.loadServices(1);
      
      expect(supabase.from).toHaveBeenCalledWith('services');
      expect(mockQuery.eq).toHaveBeenCalledWith('company_id', 1);
      expect(mockQuery.eq).toHaveBeenCalledWith('active', true);
      expect(result).toEqual(mockServices);
    });

    it('should return empty array on error', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: new Error('DB Error') })
      };
      
      supabase.from.mockReturnValue(mockQuery);
      
      const result = await dataLoader.loadServices(1);
      
      expect(result).toEqual([]);
    });
  });

  describe('loadStaff', () => {
    it('should load active staff members', async () => {
      const mockStaff = [
        { id: 1, name: 'Сергей', specialization: 'Барбер', active: true },
        { id: 2, name: 'Мария', specialization: 'Стилист', active: true }
      ];
      
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockStaff, error: null })
      };
      
      supabase.from.mockReturnValue(mockQuery);
      
      const result = await dataLoader.loadStaff(1);
      
      expect(supabase.from).toHaveBeenCalledWith('staff');
      expect(mockQuery.eq).toHaveBeenCalledWith('active', true);
      expect(result).toEqual(mockStaff);
    });
  });

  describe('loadConversation', () => {
    it('should load recent conversation history', async () => {
      const mockMessages = [
        { 
          id: 1, 
          message_text: 'Привет', 
          is_from_client: true,
          created_at: '2024-07-20T10:00:00'
        },
        { 
          id: 2, 
          message_text: 'Здравствуйте!', 
          is_from_client: false,
          created_at: '2024-07-20T10:01:00'
        }
      ];
      
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockMessages, error: null })
      };
      
      supabase.from.mockReturnValue(mockQuery);
      
      const result = await dataLoader.loadConversation('79001234567', 1);
      
      expect(supabase.from).toHaveBeenCalledWith('messages');
      expect(mockQuery.limit).toHaveBeenCalledWith(20);
      expect(result).toEqual(mockMessages);
    });
  });

  describe('loadBusinessStats', () => {
    it('should calculate business statistics', async () => {
      const mockBookings = [
        { status: 'confirmed' },
        { status: 'confirmed' },
        { status: 'cancelled' }
      ];
      
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({ data: mockBookings, error: null })
      };
      
      supabase.from.mockReturnValue(mockQuery);
      
      const result = await dataLoader.loadBusinessStats(1);
      
      expect(result).toHaveProperty('todayLoad');
      expect(result).toHaveProperty('bookedSlots');
      expect(result).toHaveProperty('totalSlots');
      expect(result.bookedSlots).toBe(2); // Only confirmed bookings
    });

    it('should handle empty bookings', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({ data: [], error: null })
      };
      
      supabase.from.mockReturnValue(mockQuery);
      
      const result = await dataLoader.loadBusinessStats(1);
      
      expect(result.todayLoad).toBe(0);
      expect(result.bookedSlots).toBe(0);
    });
  });

  describe('loadStaffSchedules', () => {
    it('should load staff schedules for next 7 days', async () => {
      const mockSchedules = [
        {
          staff_id: 1,
          date: '2024-07-20',
          start_time: '09:00',
          end_time: '18:00'
        }
      ];
      
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockSchedules, error: null })
      };
      
      supabase.from.mockReturnValue(mockQuery);
      
      const result = await dataLoader.loadStaffSchedules(1);
      
      expect(supabase.from).toHaveBeenCalledWith('staff_schedules');
      expect(result).toEqual(mockSchedules);
    });
  });

  describe('saveContext', () => {
    it('should save context to database and Redis', async () => {
      const phone = '79001234567';
      const companyId = 1;
      const context = {
        client: { name: 'Иван' },
        currentMessage: 'Хочу записаться'
      };
      const result = {
        executedCommands: [{ command: 'SEARCH_SLOTS' }],
        response: 'Проверяю время'
      };
      
      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      supabase.from.mockReturnValue({
        insert: mockInsert
      });
      
      contextService.setContext = jest.fn();
      contextService.updateConversationSummary = jest.fn();
      
      await dataLoader.saveContext(phone, companyId, context, result);
      
      expect(mockInsert).toHaveBeenCalled();
      expect(contextService.setContext).toHaveBeenCalled();
      expect(contextService.updateConversationSummary).toHaveBeenCalled();
    });

    it('should update context with command data', async () => {
      const result = {
        executedCommands: [
          { 
            command: 'SEARCH_SLOTS',
            params: { service_name: 'стрижка' }
          }
        ],
        response: 'Найдено время'
      };
      
      contextService.setContext = jest.fn();
      supabase.from.mockReturnValue({ insert: jest.fn().mockResolvedValue({ error: null }) });
      
      await dataLoader.saveContext('79001234567', 1, {}, result);
      
      const contextCall = contextService.setContext.mock.calls[0];
      expect(contextCall[1]).toHaveProperty('lastService', 'стрижка');
      expect(contextCall[1]).toHaveProperty('lastCommand', 'SEARCH_SLOTS');
    });
  });
});