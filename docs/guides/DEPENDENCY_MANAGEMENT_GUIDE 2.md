# Dependency Management Guide for AI Admin v2

## Overview
This guide documents all npm dependencies required for the AI Admin v2 system and provides troubleshooting steps for dependency-related issues.

## Complete Dependency List

### Core Dependencies

#### Web Framework & API
- **express** (^5.1.0) - Web application framework
- **express-validator** (^7.2.1) - Middleware for validation

#### WhatsApp Integration
- **@whiskeysockets/baileys** (^6.7.19) - WhatsApp Web API
- **baileys** (^6.7.19) - Alternative WhatsApp client
- **qrcode** (^1.5.4) - QR code generation
- **qrcode-terminal** (^0.12.0) - Terminal QR code display

#### Database & Storage
- **@supabase/supabase-js** (^2.57.0) - Supabase client
- **ioredis** (^5.7.0) - Redis client
- **node-cache** (^5.1.2) - In-memory caching

#### Message Queue
- **bullmq** (^5.58.5) - Message queue system

#### Date & Time
- **date-fns** (^4.1.0) - Date utility library
- **date-fns-tz** (^3.2.0) - Timezone support for date-fns

#### API Documentation
- **swagger-ui-express** (^5.0.1) - Swagger UI for Express
- **swagger-jsdoc** (^6.2.8) - JSDoc to OpenAPI generator
- **yamljs** (^0.3.0) - YAML parser for Swagger config

#### Scheduling & Rate Limiting
- **node-cron** (^3.0.3) - Cron-like scheduler for Node.js
- **bottleneck** (^2.19.5) - Rate limiter

#### Monitoring & Metrics
- **prom-client** (^15.1.3) - Prometheus metrics client

#### Logging
- **winston** (^3.17.0) - Logging library
- **pino** (^9.9.1) - Fast logger
- **pino-pretty** (^13.1.1) - Pino log formatter

#### Utilities
- **axios** (^1.11.0) - HTTP client
- **chalk** (^4.1.2) - Terminal string styling
- **dotenv** (^17.2.2) - Environment variable loader
- **validator** (^13.15.15) - String validation
- **@hapi/boom** (^10.0.1) - HTTP error objects

## Common Dependency Issues and Solutions

### Issue: MODULE_NOT_FOUND Errors

#### Symptoms:
```
Error: Cannot find module 'package-name'
Require stack:
- /path/to/file.js
```

#### Solution:
1. Check if the package is in package.json
2. If missing, add it: `npm install package-name --save`
3. Commit the updated package.json
4. Deploy to server and run `npm install`

### Issue: Version Conflicts

#### Symptoms:
- npm WARN peer dep warnings
- Incompatible version errors

#### Solution:
1. Check package-lock.json for conflicts
2. Run `npm audit fix` to resolve vulnerabilities
3. Update specific packages: `npm update package-name`
4. For major updates: `npm install package-name@latest`

### Issue: Missing Peer Dependencies

#### Symptoms:
- npm WARN requires a peer of...

#### Solution:
1. Install the peer dependency: `npm install peer-package --save`
2. Check if the version matches requirements

## Dependency Verification Checklist

### Before Deployment:
```bash
# 1. Check for missing dependencies
npm ls

# 2. Audit for vulnerabilities
npm audit

# 3. Verify all imports
grep -r "require(" src/ | grep -v "./" | sort -u

# 4. Test in clean environment
rm -rf node_modules
npm install
npm test
```

### After Adding New Dependencies:
```bash
# 1. Add to package.json
npm install new-package --save

# 2. Commit changes
git add package*.json
git commit -m "deps: add new-package for feature-name"

# 3. Push to repository
git push origin branch-name

# 4. Deploy to server
ssh server "cd /path && git pull && npm install && pm2 restart all"
```

## Dependency Purpose Reference

### Synchronization System
- **node-cron**: Schedules automatic sync tasks
  - Services sync: daily at 01:00
  - Staff sync: daily at 02:00
  - Clients sync: daily at 03:00
  - Schedules sync: every 4 hours

### API Rate Limiting
- **bottleneck**: Prevents YClients API rate limit violations
  - Max 10 requests per second
  - Queue overflow handling
  - Automatic retry with backoff

### Timezone Handling
- **date-fns-tz**: Manages timezone conversions
  - Client timezone preferences
  - Appointment scheduling across zones
  - Reminder time calculations

### API Documentation
- **swagger-ui-express**: Interactive API documentation at /api-docs
- **swagger-jsdoc**: Generates OpenAPI spec from JSDoc comments
- **yamljs**: Parses YAML configuration for Swagger

### Metrics Collection
- **prom-client**: Prometheus metrics for monitoring
  - Request duration histograms
  - Error rate counters
  - Active connection gauges
  - Custom business metrics

## Troubleshooting Commands

### Debug Missing Dependencies:
```bash
# Find all require statements
find src -name "*.js" -exec grep -H "require(" {} \; | grep -v "./"

# Check if package exists in node_modules
ls -la node_modules/ | grep package-name

# Verify package.json syntax
npm run lint:json
```

### Fix Common Issues:
```bash
# Clear npm cache
npm cache clean --force

# Reinstall all dependencies
rm -rf node_modules package-lock.json
npm install

# Update all dependencies to latest compatible versions
npm update

# Fix audit issues automatically
npm audit fix
```

## Best Practices

1. **Always commit package-lock.json** - Ensures consistent versions across environments
2. **Use exact versions for critical packages** - Prevents breaking changes
3. **Regular dependency audits** - Run `npm audit` weekly
4. **Document new dependencies** - Update this guide when adding packages
5. **Test after updates** - Run full test suite after dependency changes
6. **Use npm scripts** - Define common tasks in package.json scripts
7. **Monitor deprecation warnings** - Plan migrations for deprecated packages

## Emergency Recovery

If the application fails to start due to dependency issues:

1. **Rollback to last working state:**
```bash
git log --oneline -10
git checkout <last-working-commit>
npm install
pm2 restart all
```

2. **Identify problematic dependency:**
```bash
npm ls --depth=0
npm outdated
```

3. **Isolate and fix:**
```bash
# Remove problematic package
npm uninstall problem-package

# Install specific working version
npm install problem-package@1.2.3

# Test
npm test
```

## Maintenance Schedule

- **Daily**: Check PM2 logs for dependency warnings
- **Weekly**: Run `npm audit` and review results
- **Monthly**: Update patch versions (`npm update`)
- **Quarterly**: Review and update major versions with testing

## Contact

For dependency-related issues:
1. Check this guide first
2. Review recent commits in package.json
3. Check development diary for recent changes
4. Contact DevOps team if critical