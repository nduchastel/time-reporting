# Time Reporting System

A voice-based time tracking application for construction workers with AI-powered transcription and manager dashboard.

## Overview

This system allows construction workers to record time entries via voice on their mobile phones, with automatic transcription and data extraction. Managers review entries through a web dashboard with anomaly detection and flexible rule configuration.

## Key Features

- **Voice-Based Entry:** Workers speak naturally ("I worked 8 hours at Simons Property") instead of filling forms
- **Multi-Language Support:** English, French, Spanish
- **Progressive Web App:** Works on iOS and Android without app store requirements
- **AI Transcription:** OpenAI Whisper with context-aware accuracy
- **Anomaly Detection:** Automatic flagging of rule violations
- **Hierarchical Rules:** Global, seasonal, per-worksite, and per-worker thresholds
- **Comprehensive Audit Log:** All actions tracked with flexible entity tagging
- **Job Costing Reports:** Hours breakdown by worksite and worker

## Project Structure

```
time-reporting/
├── Design/
│   ├── 2026-05-23-construction-time-tracking-design.md   # Complete design specification
│   └── layouts/                                           # UI mockups (HTML)
│       ├── worker-ui-hybrid-v3.html                      # Worker mobile interface
│       ├── onboarding-multilingual-v3.html               # Worker onboarding flow
│       ├── manager-dashboard-v2.html                     # Manager dashboard views
│       ├── review-cards-queue.html                       # Anomaly review interface
│       ├── config-ui-thresholds.html                     # Threshold configuration
│       ├── worker-worksite-management.html               # Entity management
│       ├── worksite-report-view.html                     # Job costing reports
│       └── logging-system.html                           # Audit log design
├── src/                                                   # (to be created)
├── tests/                                                 # (to be created)
└── README.md                                              # This file
```

## Design Documentation

The complete design specification is in `Design/2026-05-23-construction-time-tracking-design.md` and includes:

- System architecture and data models
- AI processing pipeline (Whisper + GPT)
- User workflows and edge cases
- Technology stack recommendations
- Cost estimates (~$0.75/month for 5 workers)
- 6-week implementation roadmap

## UI Mockups

All HTML mockups in `Design/layouts/` are fully styled and can be opened directly in a browser to see the complete design. They include:

1. **Worker UI** - 4-screen mobile interface with voice recording
2. **Onboarding** - Voice sample collection with directive approach
3. **Manager Dashboard** - Incoming timeline and worker analysis views
4. **Review Cards** - Anomaly detection with override justification
5. **Configuration** - Hierarchical threshold management
6. **Management** - Worker/worksite editing with temporal controls
7. **Reports** - Job costing with export (CSV/PDF)
8. **Logging** - Flexible audit trail with entity tagging

## Technology Stack (Planned)

- **Frontend:** React PWA with Tailwind CSS
- **Backend:** Node.js with Express
- **Database:** Supabase (PostgreSQL)
- **AI:** OpenAI Whisper + GPT-4o-mini
- **Hosting:** Vercel (free tier)
- **Estimated Cost:** < $2/worker/month

## Current Status

**Phase:** Design Complete ✅  
**Next:** Implementation planning and Phase 1 MVP development

## Getting Started

_Implementation not yet started. Check back soon!_

## License

TBD
