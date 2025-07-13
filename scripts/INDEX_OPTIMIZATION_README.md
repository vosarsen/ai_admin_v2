# AI Admin v2 Database Index Optimization Guide

## Overview

This guide provides a comprehensive indexing strategy for the AI Admin v2 database based on analysis of query patterns in the codebase. The indexes are prioritized by their impact on performance.

## Scripts Provided

### 1. `create-indexes.sql`
Creates all recommended indexes with proper error handling. The script:
- Checks if indexes already exist before creating them
- Uses `CREATE INDEX CONCURRENTLY` to avoid locking tables
- Groups indexes by priority (High, Medium, Low)
- Runs table analysis after index creation

### 2. `analyze-indexes.sql`
Provides detailed analysis of your current index usage:
- Shows all existing indexes and their sizes
- Identifies unused indexes that can be dropped
- Detects missing indexes based on sequential scan patterns
- Finds duplicate indexes
- Estimates index bloat
- Provides maintenance recommendations

## How to Use

### Initial Index Creation
```bash
# Create all recommended indexes
psql -U your_user -d your_database -f create-indexes.sql

# Review the output for any errors or warnings
```

### Regular Analysis (Weekly/Monthly)
```bash
# Run index analysis
psql -U your_user -d your_database -f analyze-indexes.sql > index_report.txt

# Review the report for optimization opportunities
```

## Index Strategy by Table

### HIGH PRIORITY (Critical for Performance)

#### 1. **services** table
- `idx_services_company_active`: Most queries filter by company_id and active status
- `idx_services_yclients_company`: Service lookups by ID
- `idx_services_company_weight_title`: Service ordering for listings

#### 2. **staff** table  
- `idx_staff_company_active`: Staff queries by company and status
- `idx_staff_yclients_company`: Staff lookups by ID
- `idx_staff_company_rating`: Popular staff queries (sorted by rating)

#### 3. **staff_schedules** table
- `idx_staff_schedules_company_date`: Schedule lookups by date range
- `idx_staff_schedules_staff_date`: Individual staff schedules
- `idx_staff_schedules_staff_name`: Text searches for staff

#### 4. **clients** table
- `idx_clients_phone`: Phone number lookups (very frequent)
- `idx_clients_yclients_company`: Client lookups by ID
- `idx_clients_company_name`: Name searches within company
- `idx_clients_company_last_visit`: Client sorting by activity

#### 5. **dialog_contexts** table
- `idx_dialog_contexts_user_id`: Primary lookup pattern (unique)
- `idx_dialog_contexts_company_id`: Company filtering

#### 6. **appointments_cache** table
- `idx_appointments_client_company`: Client appointment history
- `idx_appointments_upcoming`: Upcoming appointments queries

### MEDIUM PRIORITY (Specific Query Improvements)

- Service category filtering
- Staff service associations (GIN index for arrays)
- Working schedule availability checks
- Company lookups

### LOW PRIORITY (Nice to Have)

- AI interaction tracking
- Sync status monitoring
- Reminder scheduling

## Query Pattern Analysis

Based on code analysis, the most frequent query patterns are:

1. **Service lookups**: 
   ```sql
   SELECT * FROM services 
   WHERE company_id = ? AND is_active = true 
   ORDER BY weight DESC, title ASC
   ```

2. **Staff availability**:
   ```sql
   SELECT * FROM staff_schedules 
   WHERE company_id = ? AND date BETWEEN ? AND ? 
   AND staff_id = ?
   ```

3. **Client lookups**:
   ```sql
   SELECT * FROM clients 
   WHERE phone = ? 
   -- or
   WHERE company_id = ? AND name ILIKE ?
   ```

4. **Appointment history**:
   ```sql
   SELECT * FROM appointments_cache 
   WHERE client_id = ? AND company_id = ? 
   ORDER BY appointment_datetime DESC
   ```

## Maintenance Recommendations

### Daily
- Monitor slow query log for queries > 100ms
- Check for unused indexes consuming space

### Weekly
- Run `ANALYZE` on frequently updated tables
- Review index usage statistics

### Monthly
- Run the `analyze-indexes.sql` script
- REINDEX bloated indexes (> 30% bloat)
- DROP unused indexes (0 scans in 30 days)

### Quarterly
- Review and adjust indexing strategy based on query patterns
- Consider partitioning for large tables (appointments_cache)

## Performance Tips

1. **Index-Only Scans**: Include frequently accessed columns in indexes to enable index-only scans
2. **Partial Indexes**: Use WHERE clauses in indexes for frequently filtered conditions
3. **Compound Indexes**: Order columns by selectivity (most selective first)
4. **Array Indexes**: Use GIN indexes for array columns (service_ids, tags)
5. **Text Search**: Use varchar_pattern_ops for LIKE queries with prefixes

## Monitoring Queries

```sql
-- Find slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
WHERE mean_exec_time > 100 
ORDER BY mean_exec_time DESC;

-- Check index hit ratio (should be > 95%)
SELECT 
  sum(idx_blks_hit) / sum(idx_blks_hit + idx_blks_read) * 100 as index_hit_ratio
FROM pg_statio_user_indexes;
```

## Troubleshooting

### High Sequential Scans
- Run `analyze-indexes.sql` to identify tables
- Check for missing WHERE clause columns in indexes
- Consider adding indexes for JOIN conditions

### Index Not Being Used
- Check statistics are up to date: `ANALYZE table_name;`
- Verify data distribution doesn't favor sequential scan
- Check for type mismatches in queries

### Slow Index Creation
- Use `CREATE INDEX CONCURRENTLY` to avoid locks
- Create indexes during low-traffic periods
- Consider increasing `maintenance_work_mem`

## Contact

For questions or improvements to this indexing strategy, please refer to the codebase query patterns in:
- `/src/integrations/yclients/data/supabase-data-layer.js`
- `/src/services/ai/entity-resolver.js`
- `/src/services/context/index.js`