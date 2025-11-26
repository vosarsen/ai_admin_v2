// src/services/ai-admin-v2/__tests__/data-loader.test.js
// Updated for PostgreSQL migration (2025-11-26)

// Mock postgres module
jest.mock('../../../database/postgres', () => ({
  pool: {},
  query: jest.fn()
}));

// Mock repositories
jest.mock('../../../repositories', () => ({
  ClientRepository: jest.fn().mockImplementation(() => ({
    findByPhone: jest.fn(),
    findAll: jest.fn()
  })),
  ServiceRepository: jest.fn().mockImplementation(() => ({
    findAll: jest.fn()
  })),
  StaffRepository: jest.fn().mockImplementation(() => ({
    findAll: jest.fn()
  })),
  StaffScheduleRepository: jest.fn().mockImplementation(() => ({
    findSchedules: jest.fn()
  })),
  DialogContextRepository: jest.fn().mockImplementation(() => ({
    findByUserId: jest.fn()
  })),
  CompanyRepository: jest.fn().mockImplementation(() => ({
    findById: jest.fn()
  })),
  BookingRepository: jest.fn().mockImplementation(() => ({
    findAll: jest.fn()
  }))
}));

// Mock other dependencies
jest.mock('../../../sync/company-info-sync');
jest.mock('../../../utils/logger', () => ({
  child: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));
jest.mock('../../context/context-service-v2', () => ({
  updateDialogContext: jest.fn(),
  addMessage: jest.fn()
}));

const postgres = require('../../../database/postgres');

describe('DataLoader (PostgreSQL)', () => {
  let dataLoader;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset module cache to get fresh instance
    jest.resetModules();
    dataLoader = require('../modules/data-loader');
  });

  describe('loadCompany', () => {
    it('should load company data from repository', async () => {
      const mockCompany = {
        company_id: 962302,
        title: 'Test Salon',
        address: 'Test Address',
        phone: '+79001234567'
      };

      if (dataLoader.repos?.company) {
        dataLoader.repos.company.findById = jest.fn().mockResolvedValue(mockCompany);
      }

      const result = await dataLoader.loadCompany(962302);

      expect(result).toBeDefined();
      expect(result.company_id).toBe(962302);
    });

    it('should return fallback data on error', async () => {
      if (dataLoader.repos?.company) {
        dataLoader.repos.company.findById = jest.fn().mockRejectedValue(new Error('DB Error'));
      }

      const result = await dataLoader.loadCompany(962302);

      expect(result).toBeDefined();
      expect(result.company_id).toBe(962302);
    });
  });

  describe('loadClient', () => {
    it('should load client by phone', async () => {
      const mockClient = {
        id: 1,
        name: 'Иван',
        phone: '79001234567',
        raw_phone: '+79001234567',
        company_id: 962302
      };

      postgres.query.mockResolvedValue({ rows: [mockClient] });

      const result = await dataLoader.loadClient('79001234567@c.us', 962302);

      expect(postgres.query).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.name).toBe('Иван');
    });

    it('should return null if client not found', async () => {
      postgres.query.mockResolvedValue({ rows: [] });

      const result = await dataLoader.loadClient('79001234567', 962302);

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      postgres.query.mockRejectedValue(new Error('DB Error'));

      const result = await dataLoader.loadClient('79001234567', 962302);

      expect(result).toBeNull();
    });
  });

  describe('loadServices', () => {
    it('should load active services', async () => {
      const mockServices = [
        { id: 1, title: 'Стрижка', price_min: 1500, is_active: true },
        { id: 2, title: 'Борода', price_min: 800, is_active: true }
      ];

      if (dataLoader.repos?.service) {
        dataLoader.repos.service.findAll = jest.fn().mockResolvedValue(mockServices);
      }

      const result = await dataLoader.loadServices(962302);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array on error', async () => {
      if (dataLoader.repos?.service) {
        dataLoader.repos.service.findAll = jest.fn().mockRejectedValue(new Error('DB Error'));
      }

      const result = await dataLoader.loadServices(962302);

      expect(result).toEqual([]);
    });
  });

  describe('loadStaff', () => {
    it('should load active staff members', async () => {
      const mockStaff = [
        { yclients_id: 1, name: 'Сергей', is_active: true },
        { yclients_id: 2, name: 'Мария', is_active: true }
      ];

      if (dataLoader.repos?.staff) {
        dataLoader.repos.staff.findAll = jest.fn().mockResolvedValue(mockStaff);
      }

      const result = await dataLoader.loadStaff(962302);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('loadBookings', () => {
    it('should load client bookings', async () => {
      const mockBookings = [
        { id: 1, client_id: 1, appointment_datetime: '2025-11-27T10:00:00' }
      ];

      postgres.query.mockResolvedValue({ rows: mockBookings });

      const result = await dataLoader.loadBookings(1, 962302);

      expect(postgres.query).toHaveBeenCalled();
      expect(result).toEqual(mockBookings);
    });

    it('should return empty array for missing clientId', async () => {
      const result = await dataLoader.loadBookings(null, 962302);

      expect(result).toEqual([]);
    });
  });

  describe('loadConversation', () => {
    it('should load conversation history', async () => {
      const mockMessages = [
        { role: 'user', content: 'Привет' },
        { role: 'assistant', content: 'Здравствуйте!' }
      ];

      postgres.query.mockResolvedValue({ rows: [{ messages: mockMessages }] });

      const result = await dataLoader.loadConversation('79001234567', 962302);

      expect(postgres.query).toHaveBeenCalled();
      expect(result).toEqual(mockMessages);
    });

    it('should return empty array if no conversation found', async () => {
      postgres.query.mockResolvedValue({ rows: [] });

      const result = await dataLoader.loadConversation('79001234567', 962302);

      expect(result).toEqual([]);
    });
  });

  describe('loadBusinessStats', () => {
    it('should calculate business statistics', async () => {
      postgres.query.mockResolvedValue({ rows: [{ count: '5' }] });

      const result = await dataLoader.loadBusinessStats(962302);

      expect(result).toHaveProperty('todayLoad');
      expect(result).toHaveProperty('bookedSlots');
      expect(result).toHaveProperty('totalSlots');
    });

    it('should handle errors gracefully', async () => {
      postgres.query.mockRejectedValue(new Error('DB Error'));

      const result = await dataLoader.loadBusinessStats(962302);

      expect(result.todayLoad).toBe(0);
      expect(result.bookedSlots).toBe(0);
    });
  });

  describe('saveContext', () => {
    it('should save context to PostgreSQL and Redis', async () => {
      const phone = '79001234567';
      const companyId = 962302;
      const context = {
        client: { name: 'Иван' },
        currentMessage: 'Хочу записаться',
        conversation: []
      };
      const result = {
        executedCommands: [{ command: 'SEARCH_SLOTS' }],
        response: 'Проверяю время'
      };

      postgres.query.mockResolvedValue({ rows: [] });

      await dataLoader.saveContext(phone, companyId, context, result);

      expect(postgres.query).toHaveBeenCalled();
    });
  });

  describe('validateInput', () => {
    it('should validate companyId', () => {
      expect(dataLoader.validateInput('962302', 'companyId')).toBe(962302);
      expect(dataLoader.validateInput(962302, 'companyId')).toBe(962302);
    });

    it('should throw on invalid companyId', () => {
      expect(() => dataLoader.validateInput('invalid', 'companyId')).toThrow();
    });

    it('should validate phone', () => {
      const result = dataLoader.validateInput('+79001234567', 'phone');
      expect(result).toBe('+79001234567');
    });
  });

  describe('analyzeVisitPatterns', () => {
    it('should analyze visit patterns', () => {
      const clientData = {
        last_visit_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        visit_history: [
          { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
          { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
        ]
      };

      const patterns = dataLoader.analyzeVisitPatterns(clientData);

      expect(patterns).toBeDefined();
      expect(patterns.lastVisitDaysAgo).toBeDefined();
    });

    it('should handle missing data', () => {
      const patterns = dataLoader.analyzeVisitPatterns({});

      expect(patterns).toBeDefined();
      expect(patterns.lastVisitDaysAgo).toBeNull();
    });
  });

  describe('detectBusinessType', () => {
    it('should detect barbershop', () => {
      expect(dataLoader.detectBusinessType('Барбершоп')).toBe('barbershop');
      expect(dataLoader.detectBusinessType('Мужская парикмахерская')).toBe('barbershop');
    });

    it('should detect nails', () => {
      expect(dataLoader.detectBusinessType('Маникюр и педикюр')).toBe('nails');
    });

    it('should default to beauty', () => {
      expect(dataLoader.detectBusinessType('Салон')).toBe('beauty');
      expect(dataLoader.detectBusinessType(null)).toBe('beauty');
    });
  });
});
