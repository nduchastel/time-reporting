# Time Reporting System

A voice-based time tracking application for construction workers with AI-powered transcription and manager review dashboard.

## Overview

Workers record time entries by speaking naturally into their mobile phone ("I worked 8 hours at Simons Property today"). The system uses OpenAI Whisper for transcription and GPT-4o-mini for structured data extraction. Managers review and approve entries through a web dashboard.

**Key Benefits:**
- No forms, no typing - just speak
- Works in any language (auto-detection)
- Progressive Web App (no app store required)
- Manager oversight with approval workflow
- Low cost (~$5-10/month total)

---

## Architecture

### System Components

```
┌─────────────────┐
│  Worker Mobile  │  Progressive Web App (React + Vite)
│   (iOS/Android) │  Voice recording → Display results
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│  Backend API    │  Node.js + Express
│   (Railway)     │  Audio upload → Transcribe → Extract → Store
└────────┬────────┘
         │
    ┌────┴────┬──────────┬────────────┐
    ▼         ▼          ▼            ▼
┌───────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐
│ Supabase  │ │ Whisper  │ │  GPT-4o  │ │ Supabase  │
│  Storage  │ │   API    │ │   mini   │ │    DB     │
│  (audio)  │ │ (voice → │ │ (text →  │ │(Postgres) │
│           │ │   text)  │ │   data)  │ │           │
└───────────┘ └──────────┘ └──────────┘ └───────────┘
```

### Technology Stack

**Frontend:** React 19, Vite 8, Tailwind CSS 4  
**Backend:** Node.js 22, Express 5  
**Database:** Supabase (PostgreSQL)  
**AI:** OpenAI Whisper (transcription), GPT-4o-mini (extraction)  
**Hosting:** Vercel (frontend), Railway (backend)

### Data Flow

1. **Worker records voice** (MediaRecorder API, 60s max)
2. **Upload to backend** (multipart/form-data, audio file + worker ID)
3. **Transcribe audio** (Whisper API → text)
4. **Extract structured data** (GPT-4o-mini → JSON: worksite, hours, date, confidence)
5. **Validate & review** (Worker reviews transcription and extracted data)
6. **Submit** (Worker confirms → Save to database)
7. **Manager review** (Future: Approve/Edit/Flag entries)

See [Design Document](Design/2026-05-23-construction-time-tracking-design.md) for full architecture details.

---

## Development Phases

The project is organized into three phases. Each phase has detailed documentation with technical decisions and implementation plans:

- **[Phase 1](docs/phase1-decisions.md)** - MVP Architecture & Testing
- **[Phase 2](docs/phase2-implementation-plan.md)** - Voice Recording & AI Integration
  - [Technical Decisions](docs/phase2-decisions.md)
- **[Phase 3](docs/phase3-plan.md)** - Worker History & Manager Dashboard

**Production deployment:**
- Worker App: https://time-reporting-dun.vercel.app
- Backend API: https://time-reporting-production.up.railway.app

---

## Getting Started

### Quick Start

```bash
# Clone and install
git clone https://github.com/nduchastel/time-reporting.git
cd time-reporting
cd backend && npm install
cd ../frontend && npm install
```

**Full setup guide:** See [Development Guide](docs/development/) for complete instructions including:
- [Local Setup](docs/development/local-setup.md) - Step-by-step environment configuration
- [Development Modes](docs/development/development-modes.md) - Real API vs Mock mode (with diagrams)
- Database setup and seed data
- OpenAI API configuration
- Troubleshooting common issues

---

## API Documentation

### POST /api/time-cards/voice

Upload audio, transcribe, extract data (does NOT save - returns for review).

**Request:** `multipart/form-data`
- `audio` - Audio file (webm/mp4/wav, max 10MB)
- `workerId` - UUID
- `actionType` - IN/OUT/HOURS/OFF

**Response (200):**
```json
{
  "transcription": "I worked 8 hours at Simons Property",
  "extractedData": {
    "action_type": "HOURS",
    "hours": 8,
    "worksite": "Simons Property",
    "date": "2026-05-24",
    "confidence": "high"
  },
  "processedData": { /* ... data for submission ... */ }
}
```

### POST /api/time-cards

Save time card (after worker reviews and submits).

**Request:**
```json
{
  "workerId": "uuid",
  "worksiteId": "uuid",
  "actionType": "HOURS",
  "date": "2026-05-24",
  "hours": 8,
  "transcription": "...",
  "extractedData": { /* ... */ }
}
```

**Response (201):** Created time card object.

### GET /api/time-cards

Retrieve time cards with filters.

**Query params:** `workerId`, `status`, `startDate`, `endDate`

**Response (200):** Array of time cards with joined worker/worksite data.

---

## Key Design Decisions

All architectural decisions are documented in phase-specific files:

**Phase 1 ([details](docs/phase1-decisions.md)):**
- ES Modules over CommonJS
- Vitest over Jest
- Express over Fastify
- Supabase PostgreSQL
- Mock transcription strategy for testing

**Phase 2 ([details](docs/phase2-decisions.md)):**
- Browser default audio format (no conversion)
- 60-second recording limit
- Low-confidence rejection
- Auto-capture time for IN/OUT actions
- Review-before-submit workflow

**Phase 3 ([details](docs/phase3-plan.md)):**
- Supabase Storage for audio files
- Last 5 entries for worker history
- Username/password authentication for managers
- Manager dashboard in same React app

---

## Database Schema

**Core tables:**
- `workers` - Employee records (name, phone, language, PIN)
- `worksites` - Job site locations
- `time_cards` - Time entries with approval workflow

**Key fields in time_cards:**
- `transcription` - Original voice-to-text
- `extracted_data` - GPT output (JSON)
- `confidence` - high/medium/low
- `status` - pending/approved/edited/flagged
- `created_at` - When worker submitted
- `date`, `start_time`, `end_time` - When work happened

See [schema SQL](backend/src/db/migrations/001_initial_schema.sql) for full details.

---

## Project Structure

```
time-reporting/
├── backend/               # Node.js + Express API
│   ├── src/
│   │   ├── db/           # Database migrations, seed data
│   │   ├── routes/       # REST API endpoints
│   │   ├── services/     # Business logic (extraction, transcription)
│   │   └── server.js     # Express app entry point
│   └── tests/            # Vitest unit and integration tests
├── frontend/             # React PWA
│   ├── src/
│   │   ├── components/   # UI components (WorkerUI, RecordButton)
│   │   └── App.jsx       # Main app entry point
│   └── tests/            # React Testing Library tests
├── docs/                 # Phase plans and technical decisions
├── Design/               # Original design specs and mockups
└── README.md             # This file
```

---

## Deployment

**Automated deployment on push to `main`:**

- **Frontend:** Vercel (auto-deploy from GitHub)
- **Backend:** Railway (auto-deploy from GitHub)
- **Database:** Supabase (manually provisioned)

**Environment variables:**

Set in Railway (backend):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `PORT` (auto-set by Railway)

Set in Vercel (frontend):
- `VITE_API_URL` (Railway backend URL)

**No package-lock.json committed** - Each platform generates its own to avoid npm proxy conflicts.

---

## Cost Estimate

**Monthly costs (production):**
- Vercel: Free (Hobby plan)
- Railway: $5/month (Hobby plan)
- Supabase: Free (includes 500MB DB + 1GB storage)
- OpenAI API: ~$0.15-0.50/month (depends on usage)
  - Whisper: $0.006/minute
  - GPT-4o-mini: $0.15/$0.60 per 1M tokens (input/output)

**Total: ~$5-10/month** for small team usage.

See [Design Doc](Design/2026-05-23-construction-time-tracking-design.md#cost-analysis) for detailed breakdown.

---

## Future Roadmap

**Phase 3 (Planned):**
- Worker history view (last 5 entries)
- Worker onboarding with PIN authentication
- Manager dashboard (review, approve, edit, flag)
- Reports and analytics
- Audio file storage and playback

**Phase 4 (Ideas):**
- Geolocation verification
- Payroll system integration
- Push notifications for managers
- Team/crew management
- Offline support with sync

See [Phase 3 Plan](docs/phase3-plan.md) for full details.

---

## Contributing

This is currently a personal project. If you'd like to contribute, please open an issue first to discuss proposed changes.

---

## License

TBD

---

## Contact

Nicolas Duchastel de Montrouge ([@nduchastel](https://github.com/nduchastel))

For questions or issues, please open a GitHub issue.
