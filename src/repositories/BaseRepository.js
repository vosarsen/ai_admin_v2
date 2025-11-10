/**
 * BaseRepository - Core database abstraction layer
 *
 * Provides common CRUD operations for PostgreSQL with:
 * - Parameterized queries (SQL injection protection)
 * - Flexible filtering (eq, neq, gte, lte, ilike, in, null)
 * - Ordering and pagination
 * - Upsert (INSERT ON CONFLICT)
 * - Bulk operations
 *
 * @class BaseRepository
 */
class BaseRepository {
  /**
   * Create a BaseRepository instance
   * @param {Object} db - PostgreSQL connection pool (from postgres.js)
   */
  constructor(db) {
    if (!db) {
      throw new Error('Database connection pool is required');
    }
    this.db = db;
  }

  /**
   * Find a single record by filters
   * @param {string} table - Table name
   * @param {Object} filters - WHERE conditions { column: value } or { column: { operator: value } }
   * @returns {Promise<Object|null>} Single record or null if not found
   *
   * @example
   * const client = await repo.findOne('clients', { phone: '89686484488' });
   * const client = await repo.findOne('clients', {
   *   company_id: 962302,
   *   created_at: { gte: '2025-11-01' }
   * });
   */
  async findOne(table, filters) {
    const startTime = Date.now();

    try {
      const { where, params } = this._buildWhere(filters);
      const sql = `SELECT * FROM ${this._sanitize(table)} WHERE ${where} LIMIT 1`;

      const result = await this.db.query(sql, params);

      const duration = Date.now() - startTime;
      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] findOne ${table} - ${duration}ms`);
      }

      return result.rows[0] || null;
    } catch (error) {
      console.error(`[DB Error] findOne ${table}:`, error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Find multiple records by filters
   * @param {string} table - Table name
   * @param {Object} filters - WHERE conditions
   * @param {Object} options - Query options { orderBy, order, limit, offset }
   * @returns {Promise<Array>} Array of records (empty if no results)
   *
   * @example
   * const clients = await repo.findMany(
   *   'clients',
   *   { company_id: 962302 },
   *   { orderBy: 'name', order: 'asc', limit: 10 }
   * );
   */
  async findMany(table, filters, options = {}) {
    const startTime = Date.now();

    try {
      const { where, params } = this._buildWhere(filters);
      const { orderBy, limit } = this._buildOptions(options, params.length);

      const sql = `SELECT * FROM ${this._sanitize(table)} WHERE ${where} ${orderBy} ${limit}`;

      const result = await this.db.query(sql, params);

      const duration = Date.now() - startTime;
      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] findMany ${table} - ${result.rows.length} rows - ${duration}ms`);
      }

      return result.rows;
    } catch (error) {
      console.error(`[DB Error] findMany ${table}:`, error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Insert or update a single record
   * @param {string} table - Table name
   * @param {Object} data - Record data
   * @param {Array<string>} conflictColumns - Columns for ON CONFLICT clause
   * @returns {Promise<Object>} Inserted/updated record
   *
   * @example
   * const client = await repo.upsert(
   *   'clients',
   *   { yclients_id: 123, company_id: 962302, name: 'Иван' },
   *   ['yclients_id', 'company_id']
   * );
   */
  async upsert(table, data, conflictColumns) {
    const startTime = Date.now();

    try {
      if (!data || Object.keys(data).length === 0) {
        throw new Error('Data object cannot be empty');
      }

      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = columns.map((_, i) => `$${i + 1}`);

      // Build UPDATE SET clause (exclude conflict columns from update)
      const updateSet = columns
        .filter(col => !conflictColumns.includes(col))
        .map(col => `${col} = EXCLUDED.${col}`)
        .join(', ');

      const sql = `
        INSERT INTO ${this._sanitize(table)} (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        ON CONFLICT (${conflictColumns.join(', ')})
        DO UPDATE SET ${updateSet}
        RETURNING *
      `;

      const result = await this.db.query(sql, values);

      const duration = Date.now() - startTime;
      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] upsert ${table} - ${duration}ms`);
      }

      return result.rows[0];
    } catch (error) {
      console.error(`[DB Error] upsert ${table}:`, error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Bulk insert or update multiple records
   * @param {string} table - Table name
   * @param {Array<Object>} dataArray - Array of records
   * @param {Array<string>} conflictColumns - Columns for ON CONFLICT clause
   * @returns {Promise<Array>} Inserted/updated records
   *
   * @example
   * const services = await repo.bulkUpsert(
   *   'services',
   *   [
   *     { yclients_id: 1, name: 'Стрижка', price: 1000 },
   *     { yclients_id: 2, name: 'Окрашивание', price: 3000 }
   *   ],
   *   ['yclients_id']
   * );
   */
  async bulkUpsert(table, dataArray, conflictColumns) {
    const startTime = Date.now();

    try {
      if (!dataArray || dataArray.length === 0) {
        return [];
      }

      // Limit batch size for safety
      const maxBatchSize = 500;
      if (dataArray.length > maxBatchSize) {
        throw new Error(`Batch size ${dataArray.length} exceeds maximum ${maxBatchSize}`);
      }

      const columns = Object.keys(dataArray[0]);
      const columnCount = columns.length;

      // Build VALUES clause with placeholders
      const valuesList = dataArray.map((_, rowIndex) => {
        const rowPlaceholders = columns.map((_, colIndex) => {
          const paramIndex = rowIndex * columnCount + colIndex + 1;
          return `$${paramIndex}`;
        });
        return `(${rowPlaceholders.join(', ')})`;
      }).join(', ');

      // Flatten all values into single array
      const allValues = dataArray.flatMap(row => columns.map(col => row[col]));

      // Build UPDATE SET clause
      const updateSet = columns
        .filter(col => !conflictColumns.includes(col))
        .map(col => `${col} = EXCLUDED.${col}`)
        .join(', ');

      const sql = `
        INSERT INTO ${this._sanitize(table)} (${columns.join(', ')})
        VALUES ${valuesList}
        ON CONFLICT (${conflictColumns.join(', ')})
        DO UPDATE SET ${updateSet}
        RETURNING *
      `;

      const result = await this.db.query(sql, allValues);

      const duration = Date.now() - startTime;
      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] bulkUpsert ${table} - ${dataArray.length} rows - ${duration}ms`);
      }

      return result.rows;
    } catch (error) {
      console.error(`[DB Error] bulkUpsert ${table}:`, error.message);
      throw this._handleError(error);
    }
  }

  /**
   * Build WHERE clause from filters object
   * @private
   * @param {Object} filters - Filter conditions
   * @returns {Object} { where: string, params: Array }
   *
   * Supported operators:
   * - Simple equality: { id: 5 } → "id = $1"
   * - gte: { age: { gte: 18 } } → "age >= $1"
   * - lte: { age: { lte: 65 } } → "age <= $1"
   * - neq: { status: { neq: 'deleted' } } → "status != $1"
   * - ilike: { name: { ilike: '%search%' } } → "name ILIKE $1"
   * - in: { id: { in: [1,2,3] } } → "id IN ($1, $2, $3)"
   * - null: { deleted_at: null } → "deleted_at IS NULL"
   */
  _buildWhere(filters) {
    if (!filters || Object.keys(filters).length === 0) {
      return { where: '1=1', params: [] };
    }

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    for (const [column, value] of Object.entries(filters)) {
      if (value === null) {
        conditions.push(`${column} IS NULL`);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Handle operators: { gte, lte, neq, ilike, in }
        for (const [operator, operatorValue] of Object.entries(value)) {
          switch (operator) {
            case 'gte':
              conditions.push(`${column} >= $${paramIndex}`);
              params.push(operatorValue);
              paramIndex++;
              break;
            case 'lte':
              conditions.push(`${column} <= $${paramIndex}`);
              params.push(operatorValue);
              paramIndex++;
              break;
            case 'neq':
              conditions.push(`${column} != $${paramIndex}`);
              params.push(operatorValue);
              paramIndex++;
              break;
            case 'ilike':
              conditions.push(`${column} ILIKE $${paramIndex}`);
              params.push(operatorValue);
              paramIndex++;
              break;
            case 'in':
              if (!Array.isArray(operatorValue) || operatorValue.length === 0) {
                throw new Error(`IN operator requires non-empty array for column ${column}`);
              }
              const inPlaceholders = operatorValue.map(() => `$${paramIndex++}`);
              conditions.push(`${column} IN (${inPlaceholders.join(', ')})`);
              params.push(...operatorValue);
              break;
            default:
              throw new Error(`Unknown operator: ${operator}`);
          }
        }
      } else {
        // Simple equality
        conditions.push(`${column} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    return {
      where: conditions.join(' AND '),
      params
    };
  }

  /**
   * Build ORDER BY and LIMIT clauses
   * @private
   * @param {Object} options - Query options
   * @param {number} paramOffset - Current parameter index offset
   * @returns {Object} { orderBy: string, limit: string }
   */
  _buildOptions(options, paramOffset = 0) {
    const { orderBy, order = 'asc', limit, offset } = options;

    let orderByClause = '';
    if (orderBy) {
      const direction = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      // Add NULLS LAST for DESC to match Supabase behavior
      const nullsHandling = direction === 'DESC' ? ' NULLS LAST' : '';
      orderByClause = `ORDER BY ${orderBy} ${direction}${nullsHandling}`;
    }

    let limitClause = '';
    if (limit !== undefined) {
      limitClause = `LIMIT ${parseInt(limit)}`;
      if (offset !== undefined) {
        limitClause += ` OFFSET ${parseInt(offset)}`;
      }
    }

    return {
      orderBy: orderByClause,
      limit: limitClause
    };
  }

  /**
   * Sanitize table/column names to prevent SQL injection
   * @private
   * @param {string} identifier - Table or column name
   * @returns {string} Sanitized identifier
   */
  _sanitize(identifier) {
    // Allow only alphanumeric, underscore, and dot (for schema.table)
    if (!/^[a-zA-Z0-9_\.]+$/.test(identifier)) {
      throw new Error(`Invalid identifier: ${identifier}`);
    }
    return identifier;
  }

  /**
   * Normalize PostgreSQL errors to user-friendly messages
   * @private
   * @param {Error} error - PostgreSQL error
   * @returns {Error} Normalized error
   */
  _handleError(error) {
    const errorMap = {
      '23505': 'Duplicate key - record already exists',
      '23503': 'Foreign key violation - referenced record does not exist',
      '42P01': 'Table does not exist',
      '42703': 'Column does not exist',
      '23502': 'Not null violation - required field is missing'
    };

    if (error.code && errorMap[error.code]) {
      const userError = new Error(errorMap[error.code]);
      userError.code = error.code;
      userError.detail = error.detail;
      userError.originalError = error;
      return userError;
    }

    return error;
  }
}

module.exports = BaseRepository;
