// Mock logger
jest.mock('../../../utils/logger', () => ({
  child: () => ({
    info: jest.fn(),
    debug: jest.fn()
  })
}));

const ServiceMatcher = require('../service-matcher');

describe('ServiceMatcher', () => {
  const testServices = [
    { id: 1, title: 'Стрижка', price: 1000 },
    { id: 2, title: 'Стрижка + борода', price: 1500 },
    { id: 3, title: 'Стрижка машинкой', price: 800 },
    { id: 4, title: 'Детская стрижка', price: 700 },
    { id: 5, title: 'Укладка', price: 500 },
    { id: 6, title: 'Окрашивание', price: 3000 },
    { id: 7, title: 'Маникюр', price: 1200 },
    { id: 8, title: 'Маникюр с покрытием', price: 1800 },
    { id: 9, title: 'ВОСК', price: 500 },
    { id: 10, title: 'ВОСК КОМПЛЕКС', price: 1500 },
    { id: 11, title: 'Массаж классический', price: 2000 },
    { id: 12, title: 'Барбер стрижка LUXINA', price: 2500, booking_count: 150 }
  ];

  describe('findBestMatch', () => {
    test('should find exact match', () => {
      const result = ServiceMatcher.findBestMatch('стрижка', testServices);
      expect(result).toBeDefined();
      expect(result.title).toBe('Стрижка');
    });

    test('should handle case insensitivity', () => {
      const result = ServiceMatcher.findBestMatch('СТРИЖКА', testServices);
      expect(result).toBeDefined();
      expect(result.title).toBe('Стрижка');
    });

    test('should return null for no query', () => {
      const result = ServiceMatcher.findBestMatch('', testServices);
      expect(result).toBeNull();
    });

    test('should return null for empty services', () => {
      const result = ServiceMatcher.findBestMatch('стрижка', []);
      expect(result).toBeNull();
    });

    test('should return null for no match', () => {
      const result = ServiceMatcher.findBestMatch('несуществующая услуга', testServices);
      expect(result).toBeNull();
    });

    test('should prefer exact match over partial', () => {
      const result = ServiceMatcher.findBestMatch('воск', testServices);
      expect(result).toBeDefined();
      expect(result.title).toBe('ВОСК');
    });

    test('should match all words for complex queries', () => {
      const result = ServiceMatcher.findBestMatch('воск комплекс', testServices);
      expect(result).toBeDefined();
      expect(result.title).toBe('ВОСК КОМПЛЕКС');
    });

    test('should handle partial matches', () => {
      const result = ServiceMatcher.findBestMatch('детская', testServices);
      expect(result).toBeDefined();
      expect(result.title).toBe('Детская стрижка');
    });

    test('should prefer simple services over complex ones', () => {
      const result = ServiceMatcher.findBestMatch('стрижка', testServices);
      expect(result).toBeDefined();
      expect(result.title).toBe('Стрижка'); // Not "Стрижка + борода"
    });

    test('should handle special characters', () => {
      const result = ServiceMatcher.findBestMatch('стрижка!!!', testServices);
      expect(result).toBeDefined();
      expect(result.title).toBe('Стрижка');
    });
  });

  describe('normalizeText', () => {
    test('should convert to lowercase', () => {
      const result = ServiceMatcher.normalizeText('ТЕСТ');
      expect(result).toBe('тест');
    });

    test('should remove special characters', () => {
      const result = ServiceMatcher.normalizeText('тест!@#$%');
      expect(result).toBe('тест');
    });

    test('should handle multiple spaces', () => {
      const result = ServiceMatcher.normalizeText('тест   тест');
      expect(result).toBe('тест тест');
    });

    test('should trim spaces', () => {
      const result = ServiceMatcher.normalizeText('  тест  ');
      expect(result).toBe('тест');
    });
  });

  describe('calculateMatchScore', () => {
    test('should give highest score to exact match', () => {
      const service = { title: 'Стрижка' };
      const score = ServiceMatcher.calculateMatchScore('стрижка', service);
      expect(score).toBe(1000);
    });

    test('should score all words match highly', () => {
      const service = { title: 'ВОСК КОМПЛЕКС' };
      const score = ServiceMatcher.calculateMatchScore('воск комплекс', service);
      expect(score).toBeGreaterThan(500);
    });

    test('should penalize complex services', () => {
      const service1 = { title: 'Стрижка' };
      const service2 = { title: 'Стрижка + борода + укладка' };
      
      const score1 = ServiceMatcher.calculateMatchScore('стрижка', service1);
      const score2 = ServiceMatcher.calculateMatchScore('стрижка', service2);
      
      expect(score1).toBeGreaterThan(score2);
    });

    test('should give bonus to popular services', () => {
      const service1 = { title: 'Барбер стрижка', booking_count: 10 };
      const service2 = { title: 'Барбер стрижка', booking_count: 150 };
      
      const score1 = ServiceMatcher.calculateMatchScore('барбер стрижка', service1);
      const score2 = ServiceMatcher.calculateMatchScore('барбер стрижка', service2);
      
      expect(score2).toBeGreaterThan(score1);
    });

    test('should penalize premium services', () => {
      const service1 = { title: 'Барбер стрижка' };
      const service2 = { title: 'Барбер стрижка LUXINA' };
      
      const score1 = ServiceMatcher.calculateMatchScore('барбер стрижка', service1);
      const score2 = ServiceMatcher.calculateMatchScore('барбер стрижка', service2);
      
      expect(score1).toBeGreaterThan(score2);
    });
  });

  describe('checkSynonyms', () => {
    test('should match haircut synonyms', () => {
      const score1 = ServiceMatcher.checkSynonyms('подстричься', 'стрижка');
      const score2 = ServiceMatcher.checkSynonyms('постричь', 'стрижка');
      
      expect(score1).toBeGreaterThan(0);
      expect(score2).toBeGreaterThan(0);
    });

    test('should match nail synonyms', () => {
      const score = ServiceMatcher.checkSynonyms('ногти', 'маникюр');
      expect(score).toBeGreaterThan(0);
    });

    test('should match barbershop synonyms', () => {
      const score = ServiceMatcher.checkSynonyms('борода', 'барбер');
      expect(score).toBeGreaterThan(0);
    });

    test('should return 0 for non-synonyms', () => {
      const score = ServiceMatcher.checkSynonyms('стрижка', 'маникюр');
      expect(score).toBe(0);
    });
  });

  describe('findTopMatches', () => {
    test('should return top N matches', () => {
      const results = ServiceMatcher.findTopMatches('стрижка', testServices, 3);
      expect(results).toHaveLength(3);
      expect(results[0].title).toBe('Стрижка');
    });

    test('should filter out zero-score matches', () => {
      const results = ServiceMatcher.findTopMatches('педикюр', testServices, 5);
      expect(results).toHaveLength(0);
    });

    test('should handle empty query', () => {
      const results = ServiceMatcher.findTopMatches('', testServices, 3);
      expect(results).toHaveLength(0);
    });

    test('should sort by score descending', () => {
      const results = ServiceMatcher.findTopMatches('стрижка', testServices, 5);
      
      // Verify descending order
      for (let i = 1; i < results.length; i++) {
        const prevScore = ServiceMatcher.calculateMatchScore('стрижка', results[i - 1]);
        const currScore = ServiceMatcher.calculateMatchScore('стрижка', results[i]);
        expect(prevScore).toBeGreaterThanOrEqual(currScore);
      }
    });

    test('should respect limit parameter', () => {
      const results = ServiceMatcher.findTopMatches('стрижка', testServices, 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Real-world scenarios', () => {
    test('should handle colloquial requests', () => {
      const queries = [
        { query: 'хочу подстричься', expected: 'Стрижка' },
        { query: 'покрасить волосы', expected: 'Окрашивание' },
        { query: 'сделать ногти', expected: 'Маникюр' },
        { query: 'нужен массаж', expected: 'Массаж классический' }
      ];

      queries.forEach(({ query, expected }) => {
        const result = ServiceMatcher.findBestMatch(query, testServices);
        expect(result).toBeDefined();
        expect(result.title).toBe(expected);
      });
    });

    test('should handle typos gracefully', () => {
      // This might not match perfectly due to typos, but should still work
      const result = ServiceMatcher.findBestMatch('стришка', testServices);
      expect(result).toBeDefined();
      expect(result.title.toLowerCase()).toContain('стриж');
    });

    test('should handle multiple word requests', () => {
      const result = ServiceMatcher.findBestMatch('стрижка и борода', testServices);
      expect(result).toBeDefined();
      expect(result.title).toBe('Стрижка + борода');
    });
  });
});