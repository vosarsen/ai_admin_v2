/**
 * Unit Tests for BaseRepository
 *
 * Tests core CRUD methods with mocked database connection.
 * No real database required - fast and isolated.
 */

const BaseRepository = require('../../../src/repositories/BaseRepository');

describe('BaseRepository Unit Tests', () => {
  let mockDb;
  let repo;

  beforeEach(() => {
    // Mock database pool
    mockDb = {
      query: jest.fn()
    };

    repo = new BaseRepository(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should throw error if db is not provided', () => {
      expect(() => new BaseRepository()).toThrow('Database connection pool is required');
    });

    test('should accept valid db instance', () => {
      expect(() => new BaseRepository(mockDb)).not.toThrow();
      expect(repo.db).toBe(mockDb);
    });
  });

  describe('findOne()', () => {
    test('should return single record', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'Test' }]
      };
      mockDb.query.mockResolvedValue(mockResult);

      const result = await repo.findOne('clients', { id: 1 });

      expect(result).toEqual({ id: 1, name: 'Test' });
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM clients WHERE id = $1 LIMIT 1',
        [1]
      );
    });

    test('should return null if no record found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.findOne('clients', { id: 999 });

      expect(result).toBeNull();
    });

    test('should handle multiple filters', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await repo.findOne('clients', { company_id: 962302, phone: '89001' });

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM clients WHERE company_id = $1 AND phone = $2 LIMIT 1',
        [962302, '89001']
      );
    });

    test('should throw error on database failure', async () => {
      mockDb.query.mockRejectedValue(new Error('Connection failed'));

      await expect(repo.findOne('clients', { id: 1 })).rejects.toThrow('Connection failed');
    });
  });

  describe('findMany()', () => {
    test('should return array of records', async () => {
      const mockResult = {
        rows: [
          { id: 1, name: 'Test 1' },
          { id: 2, name: 'Test 2' }
        ]
      };
      mockDb.query.mockResolvedValue(mockResult);

      const result = await repo.findMany('clients', { company_id: 962302 });

      expect(result).toHaveLength(2);
      expect(result).toEqual(mockResult.rows);
    });

    test('should return empty array if no records', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.findMany('clients', { id: 999 });

      expect(result).toEqual([]);
    });

    test('should apply ORDER BY ascending', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repo.findMany('clients', {}, { orderBy: 'name', order: 'asc' });

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM clients WHERE 1=1 ORDER BY name ASC ',
        []
      );
    });

    test('should apply ORDER BY descending with NULLS LAST', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repo.findMany('clients', {}, { orderBy: 'created_at', order: 'desc' });

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM clients WHERE 1=1 ORDER BY created_at DESC NULLS LAST ',
        []
      );
    });

    test('should apply LIMIT', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repo.findMany('clients', {}, { limit: 10 });

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM clients WHERE 1=1  LIMIT 10',
        []
      );
    });

    test('should apply LIMIT and OFFSET', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repo.findMany('clients', {}, { limit: 10, offset: 20 });

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM clients WHERE 1=1  LIMIT 10 OFFSET 20',
        []
      );
    });
  });

  describe('upsert()', () => {
    test('should insert new record', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'New Client', phone: '89001' }]
      };
      mockDb.query.mockResolvedValue(mockResult);

      const result = await repo.upsert(
        'clients',
        { id: 1, name: 'New Client', phone: '89001' },
        ['id']
      );

      expect(result).toEqual(mockResult.rows[0]);
      expect(mockDb.query.mock.calls[0][0]).toContain('INSERT INTO clients');
      expect(mockDb.query.mock.calls[0][0]).toContain('ON CONFLICT (id)');
      expect(mockDb.query.mock.calls[0][0]).toContain('DO UPDATE SET');
    });

    test('should throw error if data is empty', async () => {
      await expect(repo.upsert('clients', {}, ['id'])).rejects.toThrow(
        'Data object cannot be empty'
      );
    });

    test('should exclude conflict columns from UPDATE SET', async () => {
      mockDb.query.mockResolvedValue({ rows: [{}] });

      await repo.upsert(
        'clients',
        { id: 1, name: 'Client', phone: '89001' },
        ['id']
      );

      const sql = mockDb.query.mock.calls[0][0];
      // Should update name and phone, but not id
      expect(sql).toContain('name = EXCLUDED.name');
      expect(sql).toContain('phone = EXCLUDED.phone');
      expect(sql).not.toContain('id = EXCLUDED.id');
    });
  });

  describe('bulkUpsert()', () => {
    test('should insert multiple records', async () => {
      const mockResult = {
        rows: [
          { id: 1, name: 'Client 1' },
          { id: 2, name: 'Client 2' }
        ]
      };
      mockDb.query.mockResolvedValue(mockResult);

      const result = await repo.bulkUpsert(
        'clients',
        [
          { id: 1, name: 'Client 1' },
          { id: 2, name: 'Client 2' }
        ],
        ['id']
      );

      expect(result).toHaveLength(2);
      expect(mockDb.query.mock.calls[0][0]).toContain('VALUES ($1, $2), ($3, $4)');
    });

    test('should return empty array for empty input', async () => {
      const result = await repo.bulkUpsert('clients', [], ['id']);

      expect(result).toEqual([]);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    test('should throw error if batch size exceeds limit', async () => {
      const largeArray = Array.from({ length: 501 }, (_, i) => ({ id: i }));

      await expect(repo.bulkUpsert('clients', largeArray, ['id'])).rejects.toThrow(
        'Batch size 501 exceeds maximum 500'
      );
    });
  });

  describe('_buildWhere()', () => {
    test('should return "1=1" for empty filters', () => {
      const { where, params } = repo._buildWhere({});

      expect(where).toBe('1=1');
      expect(params).toEqual([]);
    });

    test('should handle simple equality', () => {
      const { where, params } = repo._buildWhere({ id: 5, name: 'Test' });

      expect(where).toBe('id = $1 AND name = $2');
      expect(params).toEqual([5, 'Test']);
    });

    test('should handle NULL values', () => {
      const { where, params } = repo._buildWhere({ deleted_at: null });

      expect(where).toBe('deleted_at IS NULL');
      expect(params).toEqual([]);
    });

    test('should handle gte operator', () => {
      const { where, params } = repo._buildWhere({ age: { gte: 18 } });

      expect(where).toBe('age >= $1');
      expect(params).toEqual([18]);
    });

    test('should handle lte operator', () => {
      const { where, params } = repo._buildWhere({ age: { lte: 65 } });

      expect(where).toBe('age <= $1');
      expect(params).toEqual([65]);
    });

    test('should handle neq operator', () => {
      const { where, params } = repo._buildWhere({ status: { neq: 'deleted' } });

      expect(where).toBe('status != $1');
      expect(params).toEqual(['deleted']);
    });

    test('should handle ilike operator', () => {
      const { where, params } = repo._buildWhere({ name: { ilike: '%test%' } });

      expect(where).toBe('name ILIKE $1');
      expect(params).toEqual(['%test%']);
    });

    test('should handle in operator', () => {
      const { where, params } = repo._buildWhere({ id: { in: [1, 2, 3] } });

      expect(where).toBe('id IN ($1, $2, $3)');
      expect(params).toEqual([1, 2, 3]);
    });

    test('should throw error for empty in array', () => {
      expect(() => repo._buildWhere({ id: { in: [] } })).toThrow(
        'IN operator requires non-empty array'
      );
    });

    test('should handle range query (gte + lte)', () => {
      const { where, params } = repo._buildWhere({
        date: { gte: '2025-11-01', lte: '2025-11-30' }
      });

      expect(where).toBe('date >= $1 AND date <= $2');
      expect(params).toEqual(['2025-11-01', '2025-11-30']);
    });

    test('should handle complex filters', () => {
      const { where, params } = repo._buildWhere({
        company_id: 962302,
        created_at: { gte: '2025-11-01' },
        name: { ilike: '%test%' },
        deleted_at: null
      });

      expect(where).toBe(
        'company_id = $1 AND created_at >= $2 AND name ILIKE $3 AND deleted_at IS NULL'
      );
      expect(params).toEqual([962302, '2025-11-01', '%test%']);
    });
  });

  describe('_buildOptions()', () => {
    test('should return empty strings for no options', () => {
      const { orderBy, limit } = repo._buildOptions({}, 0);

      expect(orderBy).toBe('');
      expect(limit).toBe('');
    });

    test('should build ORDER BY ascending', () => {
      const { orderBy } = repo._buildOptions({ orderBy: 'name', order: 'asc' }, 0);

      expect(orderBy).toBe('ORDER BY name ASC');
    });

    test('should build ORDER BY descending with NULLS LAST', () => {
      const { orderBy } = repo._buildOptions({ orderBy: 'created_at', order: 'desc' }, 0);

      expect(orderBy).toBe('ORDER BY created_at DESC NULLS LAST');
    });

    test('should build LIMIT', () => {
      const { limit } = repo._buildOptions({ limit: 10 }, 0);

      expect(limit).toBe('LIMIT 10');
    });

    test('should build LIMIT with OFFSET', () => {
      const { limit } = repo._buildOptions({ limit: 10, offset: 20 }, 0);

      expect(limit).toBe('LIMIT 10 OFFSET 20');
    });
  });

  describe('_sanitize()', () => {
    test('should allow valid table names', () => {
      expect(repo._sanitize('clients')).toBe('clients');
      expect(repo._sanitize('staff_schedules')).toBe('staff_schedules');
      expect(repo._sanitize('public.clients')).toBe('public.clients');
    });

    test('should throw error for invalid characters', () => {
      expect(() => repo._sanitize('clients; DROP TABLE')).toThrow('Invalid identifier');
      expect(() => repo._sanitize('clients--')).toThrow('Invalid identifier');
      expect(() => repo._sanitize('clients/*')).toThrow('Invalid identifier');
    });
  });

  describe('_handleError()', () => {
    test('should map 23505 error code', () => {
      const pgError = new Error('duplicate key');
      pgError.code = '23505';

      const handledError = repo._handleError(pgError);

      expect(handledError.message).toBe('Duplicate key - record already exists');
      expect(handledError.code).toBe('23505');
    });

    test('should map 23503 error code', () => {
      const pgError = new Error('foreign key violation');
      pgError.code = '23503';

      const handledError = repo._handleError(pgError);

      expect(handledError.message).toBe(
        'Foreign key violation - referenced record does not exist'
      );
    });

    test('should return original error for unknown codes', () => {
      const originalError = new Error('Unknown error');

      const handledError = repo._handleError(originalError);

      expect(handledError).toBe(originalError);
    });
  });
});
