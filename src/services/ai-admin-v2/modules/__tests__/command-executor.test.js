// Mock dependencies
jest.mock('../../../utils/logger', () => ({
  child: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('../../booking', () => ({
  getAvailableSlots: jest.fn(),
  createBooking: jest.fn(),
  checkAvailability: jest.fn(),
  cancelBooking: jest.fn(),
  rescheduleBooking: jest.fn(),
  confirmBooking: jest.fn(),
  markNoShow: jest.fn(),
  getClientBookings: jest.fn()
}));

jest.mock('../../context', () => ({
  updateContext: jest.fn()
}));

const CommandExecutor = require('../command-executor');
const bookingService = require('../../booking');
const contextService = require('../../context');

describe('CommandExecutor', () => {
  let executor;
  let mockContext;

  beforeEach(() => {
    executor = new CommandExecutor();
    
    mockContext = {
      phone: '+79001234567',
      companyId: 1,
      company: { 
        id: 1, 
        name: 'Test Company',
        type: 'barbershop'
      },
      services: [
        { id: 1, title: 'Стрижка', price: 1000 },
        { id: 2, title: 'Бритье', price: 500 }
      ],
      staff: [
        { id: 1, name: 'Мастер 1', yclients_id: 101 },
        { id: 2, name: 'Мастер 2', yclients_id: 102 }
      ],
      staffSchedules: [
        {
          staff_id: 101,
          date: '2024-01-01',
          is_working: true,
          has_booking_slots: true,
          working_hours: '10:00-20:00'
        }
      ],
      client: {
        id: 1,
        name: 'Тестовый клиент'
      }
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Command Registration', () => {
    test('should register all commands', () => {
      const expectedCommands = [
        'SEARCH_SLOTS',
        'SEARCH_SERVICES',
        'SEARCH_STAFF',
        'CREATE_BOOKING',
        'CHECK_BOOKING',
        'CANCEL_BOOKING',
        'RESCHEDULE_BOOKING',
        'CONFIRM_BOOKING',
        'MARK_NO_SHOW',
        'SHOW_PRICES',
        'SHOW_PORTFOLIO',
        'SHOW_MY_BOOKINGS',
        'CHECK_STAFF_SCHEDULE',
        'SAVE_CLIENT_NAME',
        'UPDATE_PREFERENCES'
      ];

      expectedCommands.forEach(cmd => {
        expect(executor.commands.has(cmd)).toBe(true);
      });
    });
  });

  describe('execute', () => {
    test('should execute known command', async () => {
      const command = {
        command: 'SHOW_PRICES',
        params: {}
      };

      const result = await executor.execute(command, mockContext);

      expect(result.success).toBe(true);
      expect(result.type).toBe('price_list');
      expect(result.data).toHaveLength(2);
    });

    test('should handle unknown command', async () => {
      const command = {
        command: 'UNKNOWN_COMMAND',
        params: {}
      };

      const result = await executor.execute(command, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Неизвестная команда');
    });

    test('should handle command execution error', async () => {
      const command = {
        command: 'SEARCH_SLOTS',
        params: {}
      };

      bookingService.getAvailableSlots.mockRejectedValue(new Error('API Error'));

      const result = await executor.execute(command, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });
  });

  describe('executeMultiple', () => {
    test('should execute multiple commands', async () => {
      const commands = [
        { command: 'SHOW_PRICES', params: {} },
        { command: 'SEARCH_SERVICES', params: {} }
      ];

      const results = await executor.executeMultiple(commands, mockContext);

      expect(results).toHaveLength(2);
      expect(results[0].command).toBe('SHOW_PRICES');
      expect(results[0].result.success).toBe(true);
      expect(results[1].command).toBe('SEARCH_SERVICES');
      expect(results[1].result.success).toBe(true);
    });

    test('should stop on critical command failure', async () => {
      const commands = [
        { command: 'SHOW_PRICES', params: {} },
        { command: 'CREATE_BOOKING', params: {} }, // Critical, will fail
        { command: 'SEARCH_SERVICES', params: {} } // Should not execute
      ];

      const results = await executor.executeMultiple(commands, mockContext);

      expect(results).toHaveLength(2); // Only first two
      expect(results[1].result.success).toBe(false);
    });
  });

  describe('Search Commands', () => {
    test('searchSlots should call booking service', async () => {
      const params = {
        service_name: 'стрижка',
        date: '2024-01-01',
        staff_name: 'Мастер 1'
      };

      bookingService.getAvailableSlots.mockResolvedValue([
        { time: '10:00', available: true }
      ]);

      const result = await executor.searchSlots(params, mockContext);

      expect(result.success).toBe(true);
      expect(result.type).toBe('slots');
      expect(bookingService.getAvailableSlots).toHaveBeenCalledWith(
        1, // company id
        '2024-01-01',
        [1], // service id
        1 // staff id
      );
    });

    test('searchServices should filter services', async () => {
      const params = {
        keywords: 'стрижка'
      };

      const result = await executor.searchServices(params, mockContext);

      expect(result.success).toBe(true);
      expect(result.type).toBe('services');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Стрижка');
    });

    test('searchStaff should filter staff', async () => {
      const params = {
        name: 'Мастер 1'
      };

      const result = await executor.searchStaff(params, mockContext);

      expect(result.success).toBe(true);
      expect(result.type).toBe('staff');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Мастер 1');
    });
  });

  describe('Booking Commands', () => {
    test('createBooking should validate parameters', async () => {
      const params = {
        service_id: null,
        datetime: '2024-01-01 10:00'
      };

      const result = await executor.createBooking(params, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Не указаны обязательные параметры');
    });

    test('createBooking should call booking service', async () => {
      const params = {
        service_id: '1',
        staff_id: '1',
        datetime: '2024-01-01 10:00',
        comment: 'Test'
      };

      bookingService.createBooking.mockResolvedValue({
        id: 123,
        success: true
      });

      const result = await executor.createBooking(params, mockContext);

      expect(result.success).toBe(true);
      expect(result.type).toBe('booking_created');
      expect(bookingService.createBooking).toHaveBeenCalledWith({
        phone: '+79001234567',
        services: [{ id: 1 }],
        staff_id: 1,
        datetime: '2024-01-01 10:00',
        comment: 'Test',
        company_id: 1,
        fullname: 'Тестовый клиент'
      });
    });

    test('cancelBooking should validate booking_id', async () => {
      const params = {};

      const result = await executor.cancelBooking(params, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Не указан ID записи');
    });

    test('rescheduleBooking should validate parameters', async () => {
      const params = {
        booking_id: '123'
        // missing new_datetime
      };

      const result = await executor.rescheduleBooking(params, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Не указаны обязательные параметры');
    });
  });

  describe('Information Commands', () => {
    test('showPrices should format price list', async () => {
      const params = {
        service_name: 'стрижка'
      };

      const result = await executor.showPrices(params, mockContext);

      expect(result.success).toBe(true);
      expect(result.type).toBe('price_list');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 1,
        title: 'Стрижка',
        price: 1000
      });
    });

    test('showPortfolio should return placeholder', async () => {
      const result = await executor.showPortfolio({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.type).toBe('portfolio');
      expect(result.data.message).toContain('временно недоступно');
    });

    test('showMyBookings should call booking service', async () => {
      bookingService.getClientBookings.mockResolvedValue([
        { id: 1, date: '2024-01-01' }
      ]);

      const result = await executor.showMyBookings({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.type).toBe('client_bookings');
      expect(bookingService.getClientBookings).toHaveBeenCalledWith(
        '+79001234567',
        1
      );
    });
  });

  describe('Staff Schedule Commands', () => {
    test('checkStaffSchedule should check specific staff', async () => {
      const params = {
        staff_name: 'Мастер 1',
        date: '2024-01-01'
      };

      const result = await executor.checkStaffSchedule(params, mockContext);

      expect(result.success).toBe(true);
      expect(result.type).toBe('staff_schedule');
      expect(result.data).toMatchObject({
        staff_name: 'Мастер 1',
        date: '2024-01-01',
        is_working: true,
        has_slots: true,
        working_hours: '10:00-20:00'
      });
    });

    test('checkStaffSchedule should handle unknown staff', async () => {
      const params = {
        staff_name: 'Неизвестный',
        date: '2024-01-01'
      };

      const result = await executor.checkStaffSchedule(params, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('не найден');
    });

    test('checkStaffSchedule should return all working staff', async () => {
      const params = {
        date: '2024-01-01'
      };

      const result = await executor.checkStaffSchedule(params, mockContext);

      expect(result.success).toBe(true);
      expect(result.type).toBe('daily_schedule');
      expect(result.data.working_staff).toHaveLength(1);
      expect(result.data.working_staff[0].name).toBe('Мастер 1');
    });
  });

  describe('Client Commands', () => {
    test('saveClientName should update context', async () => {
      const params = {
        name: 'Новое имя'
      };

      contextService.updateContext.mockResolvedValue(true);

      const result = await executor.saveClientName(params, mockContext);

      expect(result.success).toBe(true);
      expect(result.type).toBe('client_updated');
      expect(result.data.name).toBe('Новое имя');
      expect(contextService.updateContext).toHaveBeenCalledWith(
        '+79001234567',
        1,
        expect.objectContaining({
          clientInfo: {
            name: 'Новое имя',
            company_id: 1
          }
        })
      );
    });

    test('saveClientName should validate name', async () => {
      const params = {};

      const result = await executor.saveClientName(params, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Имя не указано');
    });

    test('updatePreferences should map services and staff', async () => {
      const params = {
        favorite_service: 'стрижка',
        favorite_staff: 'Мастер 1',
        preferred_time: 'утро'
      };

      contextService.updateContext.mockResolvedValue(true);

      const result = await executor.updatePreferences(params, mockContext);

      expect(result.success).toBe(true);
      expect(result.type).toBe('preferences_updated');
      expect(result.data).toMatchObject({
        favorite_service_id: 1,
        favorite_staff_id: 1,
        preferred_time: 'утро'
      });
    });
  });

  describe('isCritical', () => {
    test('should identify critical commands', () => {
      const criticalCommands = [
        'CREATE_BOOKING',
        'CANCEL_BOOKING',
        'RESCHEDULE_BOOKING',
        'CONFIRM_BOOKING',
        'MARK_NO_SHOW'
      ];

      criticalCommands.forEach(cmd => {
        expect(executor.isCritical(cmd)).toBe(true);
      });

      expect(executor.isCritical('SHOW_PRICES')).toBe(false);
      expect(executor.isCritical('SEARCH_SLOTS')).toBe(false);
    });
  });
});