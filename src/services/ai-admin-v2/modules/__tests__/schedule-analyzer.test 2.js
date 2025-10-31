const scheduleAnalyzer = require('../schedule-analyzer');

describe('ScheduleAnalyzer', () => {
  describe('analyzeStaffWorkingHours', () => {
    it('should correctly determine working hours from slots', () => {
      const slots = [
        { time: '10:00', is_working: true, is_free: false, seance_length: 1800 },
        { time: '11:00', is_working: true, is_free: true, seance_length: 1800 },
        { time: '12:00', is_working: true, is_free: true, seance_length: 1800 },
        { time: '14:00', is_working: true, is_free: false, seance_length: 1800 },
        { time: '15:00', is_working: true, is_free: true, seance_length: 1800 },
        { time: '20:00', is_working: true, is_free: true, seance_length: 1800 },
        { time: '21:00', is_working: true, is_free: true, seance_length: 3600 }
      ];
      
      const result = scheduleAnalyzer.analyzeStaffWorkingHours(slots, 'Сергей');
      
      expect(result.isWorking).toBe(true);
      expect(result.startTime).toBe('10:00');
      expect(result.endTime).toBe('22:00'); // 21:00 + 60 минут
      expect(result.lastAvailableSlot).toBe('21:00');
      expect(result.message).toBe('Сергей работает с 10:00 до 22:00');
    });
    
    it('should handle case when staff is not working', () => {
      const result = scheduleAnalyzer.analyzeStaffWorkingHours([], 'Сергей');
      
      expect(result.isWorking).toBe(false);
      expect(result.startTime).toBeNull();
      expect(result.endTime).toBeNull();
      expect(result.message).toBe('Сергей сегодня не работает');
    });
    
    it('should handle gaps in schedule correctly', () => {
      const slots = [
        { time: '10:00', is_working: true, is_free: true, seance_length: 1800 },
        { time: '11:00', is_working: true, is_free: false, seance_length: 1800 },
        // Gap from 12:00 to 14:00
        { time: '14:00', is_working: true, is_free: true, seance_length: 1800 },
        { time: '20:00', is_working: true, is_free: true, seance_length: 1800 },
        { time: '21:30', is_working: true, is_free: true, seance_length: 1800 }
      ];
      
      const result = scheduleAnalyzer.analyzeStaffWorkingHours(slots, 'Рамзан');
      
      expect(result.isWorking).toBe(true);
      expect(result.startTime).toBe('10:00');
      expect(result.endTime).toBe('22:00'); // 21:30 + 30 минут
      expect(result.message).toBe('Рамзан работает с 10:00 до 22:00');
    });
  });
  
  describe('getAvailableSlots', () => {
    it('should return only free working slots', () => {
      const slots = [
        { time: '10:00', is_working: true, is_free: false, seance_length: 1800 },
        { time: '11:00', is_working: true, is_free: true, seance_length: 1800 },
        { time: '12:00', is_working: false, is_free: true, seance_length: 1800 },
        { time: '14:00', is_working: true, is_free: true, seance_length: 3600 }
      ];
      
      const available = scheduleAnalyzer.getAvailableSlots(slots);
      
      expect(available).toHaveLength(2);
      expect(available[0].time).toBe('11:00');
      expect(available[1].time).toBe('14:00');
      expect(available[1].duration).toBe(3600);
    });
  });
  
  describe('groupSlotsByPeriod', () => {
    it('should correctly group slots by time periods', () => {
      const slots = [
        { time: '10:00' },
        { time: '11:30' },
        { time: '14:00' },
        { time: '15:30' },
        { time: '18:00' },
        { time: '20:00' }
      ];
      
      const groups = scheduleAnalyzer.groupSlotsByPeriod(slots);
      
      expect(groups.morning.slots).toHaveLength(2);
      expect(groups.afternoon.slots).toHaveLength(2);
      expect(groups.evening.slots).toHaveLength(2);
    });
  });
  
  describe('findNearestSlots', () => {
    it('should find slots nearest to preferred time', () => {
      const slots = [
        { time: '10:00', is_working: true, is_free: true },
        { time: '11:00', is_working: true, is_free: true },
        { time: '14:00', is_working: true, is_free: true },
        { time: '15:00', is_working: true, is_free: true },
        { time: '18:00', is_working: true, is_free: true }
      ];
      
      const nearest = scheduleAnalyzer.findNearestSlots(slots, '14:30', 3);
      
      expect(nearest).toHaveLength(3);
      expect(nearest[0].time).toBe('14:00');
      expect(nearest[1].time).toBe('15:00');
      expect(nearest[2].time).toBe('11:00');
    });
  });
  
  describe('analyzeStaffLoad', () => {
    it('should calculate staff load correctly', () => {
      const slots = [
        { is_working: true, is_free: false },
        { is_working: true, is_free: false },
        { is_working: true, is_free: true },
        { is_working: true, is_free: true },
        { is_working: true, is_free: true },
        { is_working: false, is_free: true }
      ];
      
      const load = scheduleAnalyzer.analyzeStaffLoad(slots);
      
      expect(load.totalSlots).toBe(5);
      expect(load.busySlots).toBe(2);
      expect(load.freeSlots).toBe(3);
      expect(load.loadPercent).toBe(40);
      expect(load.status).toBe('есть свободные места');
    });
  });
  
  describe('timeToMinutes and minutesToTime', () => {
    it('should convert time correctly', () => {
      expect(scheduleAnalyzer.timeToMinutes('10:30')).toBe(630);
      expect(scheduleAnalyzer.timeToMinutes('21:55')).toBe(1315);
      
      expect(scheduleAnalyzer.minutesToTime(630)).toBe('10:30');
      expect(scheduleAnalyzer.minutesToTime(1315)).toBe('21:55');
    });
  });
});