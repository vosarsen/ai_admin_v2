# Transaction Support in Repositories

## Overview

BaseRepository now supports database transactions for atomic multi-table operations. This ensures data consistency when operations span multiple tables.

## Why Transactions?

**Without transactions:**
```javascript
// ❌ RISK: If second operation fails, first succeeds = data inconsistency
await clientRepo.upsert({ name: 'Иван', phone: '79001234567' });
// Network error here → orphaned client, no booking
await bookingRepo.create({ client_id: 123, service_id: 1 });
```

**With transactions:**
```javascript
// ✅ SAFE: Both operations succeed or both fail together
await repo.withTransaction(async (client) => {
  await client.query('INSERT INTO clients ...');
  await client.query('INSERT INTO bookings ...');
  // If any fails, both rollback automatically
});
```

## Usage

### Basic Transaction

```javascript
const { clientRepo } = require('./repositories');

const result = await clientRepo.withTransaction(async (client) => {
  // All queries within this callback are part of one transaction
  const clientResult = await client.query(
    `INSERT INTO clients (name, phone, company_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (phone, company_id) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    ['Иван', '79001234567', 962302]
  );

  const clientId = clientResult.rows[0].id;

  const bookingResult = await client.query(
    `INSERT INTO bookings (client_id, service_id, datetime, company_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [clientId, 1, '2025-11-15 10:00', 962302]
  );

  return {
    client: clientResult.rows[0],
    booking: bookingResult.rows[0]
  };
});

console.log('Transaction successful:', result);
```

### Using Helper Methods Inside Transactions

```javascript
await clientRepo.withTransaction(async (client) => {
  // Use BaseRepository helper methods inside transaction
  const client = await clientRepo._findOneInTransaction(client, 'clients', {
    phone: '79001234567',
    company_id: 962302
  });

  if (!client) {
    const newClient = await clientRepo._upsertInTransaction(
      client,
      'clients',
      { name: 'Иван', phone: '79001234567', company_id: 962302 },
      ['phone', 'company_id']
    );
  }

  // Continue with more operations...
});
```

## Real-World Examples

### Example 1: Atomic Client + Booking Creation

**Scenario:** User creates a booking. We need to:
1. Create/update client record
2. Create booking record
3. Both must succeed or both must fail

```javascript
// src/services/booking/create-with-client.js

async function createBookingWithClient(clientData, bookingData) {
  const { clientRepo } = require('../repositories');

  return await clientRepo.withTransaction(async (client) => {
    // Step 1: Upsert client (create or update if exists)
    const clientResult = await client.query(
      `INSERT INTO clients (name, phone, company_id, yclients_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (phone, company_id)
       DO UPDATE SET name = EXCLUDED.name, yclients_id = EXCLUDED.yclients_id
       RETURNING id`,
      [
        clientData.name,
        clientData.phone,
        clientData.company_id,
        clientData.yclients_id
      ]
    );

    const clientId = clientResult.rows[0].id;

    // Step 2: Create booking (atomic with client creation)
    const bookingResult = await client.query(
      `INSERT INTO bookings (
        client_id, service_id, staff_id, datetime,
        duration, company_id, yclients_id
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        clientId,
        bookingData.service_id,
        bookingData.staff_id,
        bookingData.datetime,
        bookingData.duration,
        bookingData.company_id,
        bookingData.yclients_id
      ]
    );

    return {
      client: clientResult.rows[0],
      booking: bookingResult.rows[0]
    };
  });
}
```

### Example 2: Booking Rescheduling (Multiple Tables)

**Scenario:** User reschedules a booking. We need to:
1. Update booking datetime
2. Release old time slot
3. Reserve new time slot
4. All must succeed or all must fail

```javascript
// src/services/booking/reschedule.js

async function rescheduleBooking(bookingId, newDatetime) {
  const { bookingRepo } = require('../repositories');

  return await bookingRepo.withTransaction(async (client) => {
    // Step 1: Get current booking
    const currentBooking = await client.query(
      'SELECT * FROM bookings WHERE id = $1',
      [bookingId]
    );

    if (currentBooking.rows.length === 0) {
      throw new Error('Booking not found');
    }

    const booking = currentBooking.rows[0];

    // Step 2: Update booking datetime
    await client.query(
      'UPDATE bookings SET datetime = $1, updated_at = NOW() WHERE id = $2',
      [newDatetime, bookingId]
    );

    // Step 3: Release old slot (if slot tracking exists)
    await client.query(
      `DELETE FROM time_slots
       WHERE staff_id = $1 AND datetime = $2 AND status = 'reserved'`,
      [booking.staff_id, booking.datetime]
    );

    // Step 4: Reserve new slot
    await client.query(
      `INSERT INTO time_slots (staff_id, datetime, status, booking_id)
       VALUES ($1, $2, 'reserved', $3)`,
      [booking.staff_id, newDatetime, bookingId]
    );

    // Return updated booking
    const updated = await client.query(
      'SELECT * FROM bookings WHERE id = $1',
      [bookingId]
    );

    return updated.rows[0];
  });
}
```

### Example 3: Bulk Operations with Dependencies

**Scenario:** Sync services from YClients API. We need to:
1. Upsert services
2. Update categories
3. Update staff assignments
4. All atomically

```javascript
// src/sync/services-sync.js

async function syncServices(servicesFromAPI) {
  const { serviceRepo } = require('../repositories');

  return await serviceRepo.withTransaction(async (client) => {
    const results = {
      services: [],
      categories: new Set(),
      staffAssignments: 0
    };

    for (const serviceData of servicesFromAPI) {
      // 1. Upsert service
      const serviceResult = await client.query(
        `INSERT INTO services (yclients_id, title, price_min, company_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (yclients_id, company_id)
         DO UPDATE SET title = EXCLUDED.title, price_min = EXCLUDED.price_min
         RETURNING id`,
        [
          serviceData.id,
          serviceData.title,
          serviceData.price_min,
          serviceData.company_id
        ]
      );

      results.services.push(serviceResult.rows[0]);

      // 2. Update categories
      if (serviceData.category_id) {
        results.categories.add(serviceData.category_id);
      }

      // 3. Sync staff assignments
      if (serviceData.staff_ids) {
        for (const staffId of serviceData.staff_ids) {
          await client.query(
            `INSERT INTO service_staff (service_id, staff_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [serviceResult.rows[0].id, staffId]
          );
          results.staffAssignments++;
        }
      }
    }

    return results;
  });
}
```

## Error Handling

Transactions automatically rollback on error:

```javascript
try {
  await repo.withTransaction(async (client) => {
    await client.query('INSERT INTO clients ...');
    await client.query('INSERT INTO bookings ...');
    throw new Error('Something went wrong'); // ← Transaction rolls back here
  });
} catch (error) {
  // Transaction was rolled back
  // All changes undone
  console.error('Transaction failed:', error);
}
```

## Best Practices

### ✅ DO:
- Use transactions for multi-table operations
- Keep transactions short (minimize time)
- Handle errors gracefully
- Return useful data from transaction callback

### ❌ DON'T:
- Make API calls inside transactions (slow)
- Use transactions for single-table operations (overkill)
- Nest transactions (not supported)
- Hold transactions open for long periods

## Performance Considerations

- **Overhead:** Transactions add ~2-5ms overhead
- **Lock Duration:** Keep transaction time under 100ms when possible
- **Connection Pool:** Transactions hold a dedicated connection from pool

## Debugging

Enable transaction logging:

```bash
LOG_DATABASE_CALLS=true node src/index.js
```

Output:
```
[DB] Transaction started
[DB] Transaction committed in 15ms
```

Or on error:
```
[DB Error] Transaction rolled back after 23ms: duplicate key value
```

## Migration from Non-Transactional Code

**Before:**
```javascript
// ❌ No atomicity guarantee
async function createBooking(data) {
  const client = await clientRepo.upsert(data.client);
  const booking = await bookingRepo.create({ ...data, client_id: client.id });
  return { client, booking };
}
```

**After:**
```javascript
// ✅ Atomic operation
async function createBooking(data) {
  return await clientRepo.withTransaction(async (client) => {
    const clientResult = await client.query('INSERT INTO clients ...');
    const bookingResult = await client.query('INSERT INTO bookings ...');
    return {
      client: clientResult.rows[0],
      booking: bookingResult.rows[0]
    };
  });
}
```

## Related

- **CRITICAL-3** implementation from architectural review
- PostgreSQL transaction documentation: https://www.postgresql.org/docs/current/tutorial-transactions.html
- Connection pool: `src/database/postgres.js`
