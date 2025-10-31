// src/services/ai-admin-v2/__tests__/command-handler.test.js
const commandHandler = require('../modules/command-handler');
const bookingService = require('../../booking');
const yclientsClient = require('../../../integrations/yclients/client');

// Mock dependencies
jest.mock('../../booking');
jest.mock('../../../integrations/yclients/client');
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('CommandHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractCommands', () => {
    it('should extract SEARCH_SLOTS command with parameters', () => {
      const text = 'Проверю время для вас [SEARCH_SLOTS service_name: стрижка, date: завтра]';
      const commands = commandHandler.extractCommands(text);
      
      expect(commands).toHaveLength(1);
      expect(commands[0]).toEqual({
        command: 'SEARCH_SLOTS',
        params: {
          service_name: 'стрижка',
          date: 'завтра'
        }
      });
    });

    it('should extract multiple commands', () => {
      const text = '[CHECK_STAFF_SCHEDULE staff_name: Сергей] [CREATE_BOOKING service_name: стрижка]';
      const commands = commandHandler.extractCommands(text);
      
      expect(commands).toHaveLength(2);
      expect(commands[0].command).toBe('CHECK_STAFF_SCHEDULE');
      expect(commands[1].command).toBe('CREATE_BOOKING');
    });

    it('should extract commands without parameters', () => {
      const text = 'Покажу цены [SHOW_PRICES]';
      const commands = commandHandler.extractCommands(text);
      
      expect(commands).toHaveLength(1);
      expect(commands[0]).toEqual({
        command: 'SHOW_PRICES',
        params: {}
      });
    });

    it('should handle commands with complex parameter values', () => {
      const text = '[CREATE_BOOKING service_name: Мужская стрижка + борода, date: 2024-07-20, time: 15:00]';
      const commands = commandHandler.extractCommands(text);
      
      expect(commands[0].params.service_name).toBe('Мужская стрижка + борода');
    });

    it('should return empty array for text without commands', () => {
      const text = 'Привет! Как дела?';
      const commands = commandHandler.extractCommands(text);
      
      expect(commands).toHaveLength(0);
    });
  });

  describe('removeCommands', () => {
    it('should remove commands from text', () => {
      const text = 'Проверю время [SEARCH_SLOTS service_name: стрижка] для вас';
      const cleaned = commandHandler.removeCommands(text);
      
      expect(cleaned).toBe('Проверю время  для вас');
    });

    it('should remove multiple commands', () => {
      const text = '[COMMAND1] текст [COMMAND2 param: value] еще текст';
      const cleaned = commandHandler.removeCommands(text);
      
      expect(cleaned).toBe(' текст  еще текст');
    });

    it('should handle text without commands', () => {
      const text = 'Обычный текст без команд';
      const cleaned = commandHandler.removeCommands(text);
      
      expect(cleaned).toBe(text);
    });
  });

  describe('executeCommands', () => {
    const mockContext = {
      company: { 
        company_id: 1,
        type: 'barbershop'
      },
      client: {
        name: 'Иван',
        phone: '79001234567'
      },
      services: [
        { id: 1, title: 'Стрижка', price: 1500 }
      ],
      staff: [
        { id: 1, name: 'Сергей' }
      ]
    };

    it('should execute SEARCH_SLOTS command', async () => {
      const commands = [{
        command: 'SEARCH_SLOTS',
        params: { service_name: 'стрижка', date: 'сегодня' }
      }];
      
      const mockSlots = [
        { time: '10:00', staff_name: 'Сергей' }
      ];
      
      commandHandler.searchSlots = jest.fn().mockResolvedValue({ slots: mockSlots });
      
      const results = await commandHandler.executeCommands(commands, mockContext);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('slots');
      expect(results[0].data).toEqual(mockSlots);
    });

    it('should execute CREATE_BOOKING command', async () => {
      const commands = [{
        command: 'CREATE_BOOKING',
        params: {
          service_name: 'стрижка',
          date: 'завтра',
          time: '15:00'
        }
      }];
      
      bookingService.createBooking = jest.fn().mockResolvedValue({
        success: true,
        data: {
          record_id: '123',
          datetime: '2024-07-21T15:00:00'
        }
      });
      
      const results = await commandHandler.executeCommands(commands, mockContext);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('booking_created');
      expect(bookingService.createBooking).toHaveBeenCalled();
    });

    it('should execute SHOW_PRICES command', async () => {
      const commands = [{
        command: 'SHOW_PRICES',
        params: {}
      }];
      
      const results = await commandHandler.executeCommands(commands, mockContext);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('prices');
      expect(results[0].data).toContain(mockContext.services[0]);
    });

    it('should execute SAVE_CLIENT_NAME command', async () => {
      const commands = [{
        command: 'SAVE_CLIENT_NAME',
        params: { name: 'Петр' }
      }];
      
      const contextService = require('../../context');
      contextService.setContext = jest.fn();
      
      const results = await commandHandler.executeCommands(commands, mockContext);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('name_saved');
      expect(contextService.setContext).toHaveBeenCalled();
    });

    it('should execute CANCEL_BOOKING command', async () => {
      const commands = [{
        command: 'CANCEL_BOOKING',
        params: {}
      }];
      
      bookingService.getActiveBookings = jest.fn().mockResolvedValue([
        { id: 1, date: '2024-07-20', time: '15:00' }
      ]);
      
      const results = await commandHandler.executeCommands(commands, mockContext);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('booking_list');
      expect(bookingService.getActiveBookings).toHaveBeenCalled();
    });

    it('should execute CHECK_STAFF_SCHEDULE command', async () => {
      const commands = [{
        command: 'CHECK_STAFF_SCHEDULE',
        params: { staff_name: 'Сергей', date: 'завтра' }
      }];
      
      yclientsClient.prototype.getStaffSchedule = jest.fn().mockResolvedValue({
        success: true,
        data: [{ staff_id: 1, date: '2024-07-21' }]
      });
      
      const results = await commandHandler.executeCommands(commands, mockContext);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('staff_schedule');
    });

    it('should handle command execution errors', async () => {
      const commands = [{
        command: 'CREATE_BOOKING',
        params: {}
      }];
      
      bookingService.createBooking = jest.fn().mockRejectedValue(new Error('Booking failed'));
      
      const results = await commandHandler.executeCommands(commands, mockContext);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('error');
      expect(results[0].error).toContain('Booking failed');
    });

    it('should execute multiple commands in sequence', async () => {
      const commands = [
        { command: 'SAVE_CLIENT_NAME', params: { name: 'Петр' } },
        { command: 'SHOW_PRICES', params: {} }
      ];
      
      const contextService = require('../../context');
      contextService.setContext = jest.fn();
      
      const results = await commandHandler.executeCommands(commands, mockContext);
      
      expect(results).toHaveLength(2);
      expect(results[0].type).toBe('name_saved');
      expect(results[1].type).toBe('prices');
    });
  });

  describe('searchSlots', () => {
    it('should search slots for specific service', async () => {
      const params = {
        service_name: 'стрижка',
        date: 'сегодня'
      };
      
      const context = {
        company: { company_id: 1 },
        services: [
          { id: 1, title: 'Стрижка', yclients_id: 100 }
        ]
      };
      
      bookingService.searchAvailableSlots = jest.fn().mockResolvedValue({
        success: true,
        slots: [{ time: '10:00' }]
      });
      
      const result = await commandHandler.searchSlots(params, context);
      
      expect(result.slots).toHaveLength(1);
      expect(bookingService.searchAvailableSlots).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          service_ids: [100]
        })
      );
    });

    it('should handle fuzzy service matching', async () => {
      const params = {
        service_name: 'стричься',
        date: 'завтра'
      };
      
      const context = {
        company: { company_id: 1 },
        services: [
          { id: 1, title: 'Мужская стрижка', yclients_id: 100 }
        ]
      };
      
      bookingService.searchAvailableSlots = jest.fn().mockResolvedValue({
        success: true,
        slots: []
      });
      
      await commandHandler.searchSlots(params, context);
      
      expect(bookingService.searchAvailableSlots).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          service_ids: [100]
        })
      );
    });
  });

  describe('parseDate', () => {
    beforeEach(() => {
      // Mock current date for consistent testing
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-07-20T10:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should parse relative dates', () => {
      expect(commandHandler.parseDate('сегодня')).toBe('2024-07-20');
      expect(commandHandler.parseDate('завтра')).toBe('2024-07-21');
      expect(commandHandler.parseDate('послезавтра')).toBe('2024-07-22');
    });

    it('should parse weekday names', () => {
      // 20 July 2024 is Saturday
      expect(commandHandler.parseDate('понедельник')).toBe('2024-07-22');
      expect(commandHandler.parseDate('воскресенье')).toBe('2024-07-21');
    });

    it('should parse specific dates', () => {
      expect(commandHandler.parseDate('25 июля')).toBe('2024-07-25');
      expect(commandHandler.parseDate('1 августа')).toBe('2024-08-01');
      expect(commandHandler.parseDate('2024-12-31')).toBe('2024-12-31');
    });

    it('should handle invalid dates', () => {
      expect(commandHandler.parseDate('неизвестно')).toBe('сегодня');
      expect(commandHandler.parseDate('')).toBe('сегодня');
    });
  });
});