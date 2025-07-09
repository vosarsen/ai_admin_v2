// src/__tests__/services/nlu/action-resolver.test.js
const ActionResolver = require('../../../services/nlu/action-resolver');
const { ActionResolutionError } = require('../../../services/nlu/errors');

describe('ActionResolver', () => {
  let actionResolver;

  beforeEach(() => {
    actionResolver = new ActionResolver();
  });

  describe('determineAction', () => {
    it('should return search_slots for booking intent without complete data', () => {
      const parsed = {
        intent: 'booking',
        entities: { service: 'маникюр' }
      };
      expect(actionResolver.determineAction(parsed)).toBe('search_slots');
    });

    it('should return create_booking for booking intent with complete data', () => {
      const parsed = {
        intent: 'booking',
        entities: {
          date: '2024-01-01',
          time: '14:00',
          staff: 'Мария'
        }
      };
      expect(actionResolver.determineAction(parsed)).toBe('create_booking');
    });

    it('should return reschedule_booking for reschedule intent', () => {
      const parsed = {
        intent: 'reschedule',
        entities: {}
      };
      expect(actionResolver.determineAction(parsed)).toBe('reschedule_booking');
    });

    it('should return cancel_booking for cancel intent', () => {
      const parsed = {
        intent: 'cancel',
        entities: {}
      };
      expect(actionResolver.determineAction(parsed)).toBe('cancel_booking');
    });

    it('should return get_info for info intent', () => {
      const parsed = {
        intent: 'info',
        entities: {}
      };
      expect(actionResolver.determineAction(parsed)).toBe('get_info');
    });

    it('should return none for unknown intent', () => {
      const parsed = {
        intent: 'unknown',
        entities: {}
      };
      expect(actionResolver.determineAction(parsed)).toBe('none');
    });

    it('should throw error for invalid input', () => {
      expect(() => actionResolver.determineAction(null))
        .toThrow(ActionResolutionError);
      expect(() => actionResolver.determineAction('string'))
        .toThrow(ActionResolutionError);
      expect(() => actionResolver.determineAction(123))
        .toThrow(ActionResolutionError);
    });

    it('should throw error for missing intent', () => {
      expect(() => actionResolver.determineAction({ entities: {} }))
        .toThrow(ActionResolutionError);
    });

    it('should handle missing entities gracefully', () => {
      const parsed = {
        intent: 'booking'
        // missing entities
      };
      expect(actionResolver.determineAction(parsed)).toBe('search_slots');
    });

    it('should require all booking fields for create_booking', () => {
      const testCases = [
        { entities: { date: '2024-01-01', time: '14:00' }, expected: 'search_slots' },
        { entities: { date: '2024-01-01', staff: 'Мария' }, expected: 'search_slots' },
        { entities: { time: '14:00', staff: 'Мария' }, expected: 'search_slots' },
        { entities: { date: '2024-01-01', time: '14:00', staff: 'Мария' }, expected: 'create_booking' }
      ];

      testCases.forEach(({ entities, expected }) => {
        const parsed = { intent: 'booking', entities };
        expect(actionResolver.determineAction(parsed)).toBe(expected);
      });
    });
  });

  describe('ensureAction', () => {
    it('should add action field if missing', () => {
      const parsed = {
        intent: 'booking',
        entities: { service: 'маникюр' }
      };
      
      actionResolver.ensureAction(parsed);
      expect(parsed.action).toBe('search_slots');
    });

    it('should not override existing action', () => {
      const parsed = {
        intent: 'booking',
        entities: { service: 'маникюр' },
        action: 'existing_action'
      };
      
      actionResolver.ensureAction(parsed);
      expect(parsed.action).toBe('existing_action');
    });

    it('should handle errors gracefully', () => {
      const parsed = null;
      
      const result = actionResolver.ensureAction(parsed);
      expect(result).toBe(null);
    });

    it('should set action to none on error', () => {
      const parsed = {
        // missing intent - will cause error
        entities: {}
      };
      
      actionResolver.ensureAction(parsed);
      expect(parsed.action).toBe('none');
    });
  });
});