# System Overview Architecture

Core system components and infrastructure documentation.

## ✅ Version Consolidation Complete

All outdated versions have been archived to `/docs/06-archive/outdated-implementations/`.
Current versions are now named without version suffixes for clarity.

## Core Components

### Context Management
- **[CONTEXT_SYSTEM.md](CONTEXT_SYSTEM.md)** ⭐ - Current conversation context system (V2)
- **[CONTEXT_API.md](CONTEXT_API.md)** - API reference for context operations
- **[CONTEXT_TROUBLESHOOTING.md](CONTEXT_TROUBLESHOOTING.md)** - Common issues and solutions

### Data Synchronization
- **[SYNC_SYSTEM.md](SYNC_SYSTEM.md)** ⭐ - Current YClients sync architecture (V2)
  - Hybrid sync: Full (daily) + Today-only (hourly)
  - Max 1-hour data staleness
  - Automatic retry on failures

### Performance Optimization
- **[REDIS_BATCHING.md](REDIS_BATCHING.md)** ⭐ - Production batching strategy
- **[PERFORMANCE_AND_SCALABILITY_ANALYSIS.md](PERFORMANCE_AND_SCALABILITY_ANALYSIS.md)** - System benchmarks

### Database & Storage
- **[BAILEYS_DATABASE_AUTH_STATE.md](BAILEYS_DATABASE_AUTH_STATE.md)** - WhatsApp auth storage
- **[SUPABASE_OPTIMIZATION.md](SUPABASE_OPTIMIZATION.md)** - Legacy Supabase optimizations
- **[SUPABASE_SECURITY_FIX.md](SUPABASE_SECURITY_FIX.md)** - Security improvements

### System Analysis
- **[COMPREHENSIVE_ANALYSIS.md](COMPREHENSIVE_ANALYSIS.md)** - Full system analysis
- **[MONITORING_SUMMARY.md](MONITORING_SUMMARY.md)** - Monitoring infrastructure
- **[CLEANUP_STRATEGY_AFTER_MIGRATION.md](CLEANUP_STRATEGY_AFTER_MIGRATION.md)** - Post-migration cleanup

## Architecture Highlights

### Context System V2
- **Purpose**: Manage conversation state across multiple messages
- **Storage**: Redis with 24-hour TTL
- **Key Features**:
  - Client history tracking
  - Booking flow state management
  - Service preferences
  - Conversation continuity

### Sync System V2
- **Purpose**: Keep local data synchronized with YClients
- **Strategy**: Hybrid approach
  - Full sync: 05:00 daily (30 days ahead)
  - Today sync: Every hour 08:00-23:00 (today+tomorrow)
- **Performance**: <1 minute for full sync

### Redis Batching
- **Purpose**: Optimize Redis operations
- **Implementation**: Batch multiple operations into pipelines
- **Performance**: 10x reduction in network overhead
- **Use Cases**: Context updates, cache warming

## System Metrics

### Performance
- Context retrieval: <50ms
- Context update: <100ms
- Full sync: <60 seconds
- Today sync: <5 seconds

### Reliability
- Redis availability: 99.99%
- Sync success rate: 99.5%
- Context recovery: Automatic from Redis

### Scalability
- Concurrent contexts: Unlimited
- Sync parallelization: 10 concurrent requests
- Redis memory: 1GB allocated, ~100MB used

## Migration Notes

### Completed Migrations
- ✅ Supabase → Timeweb PostgreSQL (Nov 2025)
- ✅ Context System V1 → V2 (Oct 2025)
- ✅ Sync System V1 → V2 (Oct 2025)

### Deprecated Components
Files marked as deprecated above should be moved to archive after confirming no dependencies.

## Quick Reference

1. **For context issues**: Start with [CONTEXT_TROUBLESHOOTING.md](CONTEXT_TROUBLESHOOTING.md)
2. **For sync problems**: Check [SYNC_SYSTEM.md](SYNC_SYSTEM.md)
3. **For performance**: Review [REDIS_BATCHING.md](REDIS_BATCHING.md)
4. **For monitoring**: See [MONITORING_SUMMARY.md](MONITORING_SUMMARY.md)

---
*Total files: 18 | Current versions clearly marked with ⭐ | Last updated: 2025-11-17*