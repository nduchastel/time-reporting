# Phase 5 Backlog — Post-Beta

**Status:** BACKLOG (not started)  
**Created:** 2026-06-06  
**Goal:** Everything intentionally deferred until **after** the beta ships. These are prioritized loosely; we'll re-triage once real beta feedback is in — beta usage may promote, demote, or drop items here.

Phase 5 starts after [`phase4-plan.md`](phase4-plan.md) is built and the [`pre-beta-ship-plan.md`](pre-beta-ship-plan.md) gate passes and the beta is live.

---

## Backlog

Item numbers map to the master backlog from 2026-06-06 (kept for traceability).

### Ops & production hardening
- **#7 Audio retention policy** — auto-delete stored audio after a TTL (e.g. 90 days) for cost + privacy.
- **#8 Uptime monitoring + alerting** — external health checks and alerts on the Railway backend / Vercel frontend.
- **#9 Backup verification** — confirm Supabase backups and run a restore drill.

### Manager / worker experience
- **#10 Bulk approve** — select multiple time cards and approve in one action.
- **#12 Reports charts** — visual hours-over-time and worksite-distribution on top of the existing CSV export.
- **#13 PDF export** — client-billing-ready PDF reports (design called for CSV **and** PDF; only CSV shipped).
- **#14 Pull-to-refresh + offline cache** for worker history.

### Core design features not yet built
- **#15 Anomaly-detection engine + Review Cards** — rule-based auto-flagging of suspicious entries (a headline design-doc feature; flagging is manual today). Large build.
- **#16 Configurable rule engine / thresholds** — overtime, missing check-out, etc. Depends on #15.

### Original "Phase 4 ideas" backlog (README + design doc)
- **#17 GPS / geolocation verification** — optional check that a worker is at the claimed worksite.
- **#18 Photo attachments** — workers attach site photos to entries.
- **#19 Team/crew entries** — "our crew of 5 worked 8 hours at Simons" → auto-create entries for the crew.
- **#20 Push notifications / reminders** — notify managers of entries needing review; remind workers of incomplete days / missing check-out.
- **#21 Payroll integration** — direct export to QuickBooks / ADP / Paychex.
- **#22 Offline support with sync** — capture entries offline and sync when back online (beyond the Phase 4 PWA app-shell caching).
- **#23 Manager SSO / dedicated native mobile app.**

---

## Deferred QA (from the pre-beta gate)
Not blocking the beta, but should happen before a wider/GA launch:
- **Security review / pen-test** of auth, ownership, and role boundaries.
- **Load / performance testing** of the voice pipeline and dashboards.

---

## Changelog

### 2026-06-06 — Backlog created
Captured all items deferred from the Phase 4 triage so nothing is lost. To be re-prioritized after beta feedback.
