# Infrastructure Documentation

Infrastructure research, decisions, and architecture documents for AI Admin v2.

---

## Documents

### Yandex Cloud Research

**[YANDEX_CLOUD_FUNCTIONS_RESEARCH.md](./YANDEX_CLOUD_FUNCTIONS_RESEARCH.md)** (11 pages)
Comprehensive research on migrating AI Admin v2 from Timeweb VPS to Yandex Cloud Functions.

**Key findings:**
- Architectural incompatibility: Baileys needs persistent WebSocket, serverless is ephemeral
- Cost comparison: VPS (~1,500 ₽/mth) vs Serverless (~12,750 ₽/mth) = 8.5x more expensive
- Technical limitations: Cold starts, concurrent execution limits, session storage challenges
- **Recommendation:** Stay on VPS

**[YANDEX_CLOUD_QUICK_DECISION.md](./YANDEX_CLOUD_QUICK_DECISION.md)** (1 page)
TL;DR version for quick decision-making.

**Decision:** 🔴 Do NOT migrate to Yandex Cloud Functions

---

## Current Infrastructure

**Provider:** Timeweb
**Type:** VPS
**Cost:** ~1,000-1,500 ₽/month
**Database:** Timeweb PostgreSQL (152-ФЗ compliant)
**Status:** ✅ Stable, production-ready

**Services:**
- ai-admin-worker-v2 (PM2)
- booking-monitor-v2 (PM2)
- api-server (PM2)
- WhatsApp Client (Baileys)
- BullMQ (Redis)

---

## Future Considerations

**When to reconsider Yandex Cloud:**
- Traffic > 500 msg/day (need HA Redis/PostgreSQL)
- SLA requirement > 99.95%
- Budget > 10,000 ₽/month

**Alternative paths:**
- Yandex Compute Cloud VPS (~2,000 ₽/mth) - if need Yandex ecosystem
- WhatsApp Business API + Serverless (~17,500 ₽/mth) - if abandon Baileys

---

**Last updated:** 2025-11-18
