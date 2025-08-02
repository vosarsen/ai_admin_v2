# Environment-Specific Configuration

This directory contains environment-specific configuration for the AI Admin v2 system.

## Available Environments

- **development** - Local development with SSH tunnel to Redis
- **staging** - Pre-production testing environment  
- **production** - Production environment

## Environment Selection

The environment is selected based on the `NODE_ENV` environment variable:

```bash
# Development (default)
NODE_ENV=development npm start

# Production
NODE_ENV=production npm start

# Staging
NODE_ENV=staging npm start
```

## Configuration Structure

Each environment file exports configuration that overrides default values:

```javascript
module.exports = {
  redis: {
    host: 'localhost',
    port: 6380, // Development uses SSH tunnel
    url: 'redis://localhost:6380'
  },
  
  api: {
    baseUrl: 'http://localhost:3000'
  },
  
  logging: {
    level: 'debug',
    pretty: true
  },
  
  cache: {
    ttl: 300,
    enabled: false
  }
};
```

## Key Differences

### Development
- Redis on port 6380 (SSH tunnel)
- Debug logging enabled
- Cache disabled for easier testing
- No webhook validation

### Production  
- Redis on port 6379 (local)
- Info level logging only
- Cache enabled (30 min TTL)
- Full security validation
- Performance optimizations

### Staging
- Similar to production but with debug logging
- Shorter cache TTL (10 min)

## Adding New Environment

1. Create new file: `{environment}.js`
2. Export configuration object
3. Add to `index.js` environments map

## Usage in Code

```javascript
const config = require('./config');

// Environment-specific values are automatically loaded
const redisUrl = config.redis.url; // Uses correct port per environment
const logLevel = config.app.logLevel; // Uses environment default
```