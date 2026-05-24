# Time Reporting System

A voice-based time tracking application for construction workers with AI-powered transcription and manager dashboard.

## Overview

This system allows construction workers to record time entries via voice on their mobile phones, with automatic transcription and data extraction. Managers review entries through a web dashboard with anomaly detection and flexible rule configuration.

## Key Features

- **Voice-Based Entry:** Workers speak naturally ("I worked 8 hours at Simons Property") instead of filling forms
- **Multi-Language Support:** English, French, Spanish (planned)
- **Progressive Web App:** Works on iOS and Android without app store requirements
- **AI Transcription:** OpenAI Whisper with context-aware accuracy (planned)
- **Data Extraction:** GPT-4o-mini extracts structured time card data
- **Comprehensive Test Coverage:** 18/18 tests passing (15 backend, 3 frontend)
- **Mock Transcription Testing:** 17 test scenarios covering good/bad/edge cases

## Project Structure

```
time-reporting/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── supabase.js              # Database client
│   │   │   ├── migrations/              # SQL migrations
│   │   │   └── seed.js                  # Test data
│   │   ├── routes/
│   │   │   └── timeCards.js             # REST API endpoints
│   │   ├── services/
│   │   │   ├── extractionService.js     # GPT-4o-mini extraction
│   │   │   └── timeCardService.js       # CRUD operations
│   │   └── server.js                    # Express server
│   ├── tests/
│   │   ├── fixtures/
│   │   │   ├── transcriptions.js        # 17 mock transcriptions
│   │   │   └── testCases.js             # Test helpers
│   │   ├── unit/                        # 12 unit tests
│   │   └── integration/                 # 3 integration tests
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── WorkerUI.jsx             # Main interface (4 screens)
│   │   │   └── RecordButton.jsx         # Recording controls
│   │   ├── test/                        # Test setup
│   │   └── App.jsx
│   └── package.json
├── docs/
│   ├── implementation-plan.md           # Detailed task breakdown
│   └── decisions.md                     # 30+ technical decisions
└── Design/
    ├── 2026-05-23-construction-time-tracking-design.md
    └── layouts/                         # 8 HTML mockups
```

## Technology Stack

**Implemented:**
- **Frontend:** React 19.2.6, Vite 8.0.14, Tailwind CSS 4.3.0
- **Backend:** Node.js 22.x, Express 5.1.0
- **Database:** Supabase PostgreSQL (schema ready, not deployed)
- **AI:** OpenAI GPT-4o-mini for extraction (mocked in tests)
- **Testing:** Vitest 4.1.7, Supertest, @testing-library/react

**Planned:**
- **Audio Transcription:** OpenAI Whisper API
- **Hosting:** Vercel (frontend), Railway (backend), Supabase (database)
- **Estimated Cost:** $5/month + usage (~$0.15-0.31/month for AI)

## Current Status

**Phase 1 MVP: COMPLETE ✅**

- ✅ Backend API with Express server
- ✅ Database schema and migrations
- ✅ GPT-4o-mini extraction service
- ✅ Time card CRUD operations
- ✅ REST API endpoints (POST/GET /api/time-cards)
- ✅ Worker mobile UI (4 action screens)
- ✅ Recording interface with mock simulation
- ✅ **18/18 tests passing**
- ✅ **30+ technical decisions documented**

**Next Phase: Deployment & Integration**
- [ ] Deploy backend to Railway
- [ ] Deploy frontend to Vercel
- [ ] Set up Supabase database
- [ ] Integrate real audio recording (MediaRecorder API)
- [ ] Connect frontend to backend API
- [ ] Add Whisper API transcription

## Getting Started

### Prerequisites

- Node.js 22.x or higher
- npm 10.x or higher
- Supabase account (for deployment)
- OpenAI API key (for deployment)

### Local Development

**Backend:**

```bash
cd backend
npm install

# Create .env file
cat > .env << EOF
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=sk-your-key
NODE_ENV=development
EOF

# Run tests
npm test                  # All tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only

# Start dev server
npm run dev               # Runs on port 3001
```

**Frontend:**

```bash
cd frontend
npm install

# Run tests
npm test

# Start dev server
npm run dev               # Runs on port 5173
```

### Database Setup

1. Create Supabase project at https://supabase.com
2. Go to SQL Editor
3. Run migration: `backend/src/db/migrations/001_initial_schema.sql`
4. Seed test data: `node backend/src/db/seed.js`

See `backend/src/db/README.md` for details.

## Testing

**Backend Tests (15 tests):**
- Mock transcription fixtures (17 scenarios)
- Extraction service tests (4 tests)
- Time card service tests (2 tests)
- Integration tests (3 tests)
- Complete OpenAI and Supabase mocking

**Frontend Tests (3 tests):**
- WorkerUI component rendering
- 4 action type screens
- Recording button functionality

**Run all tests:**
```bash
# Backend
cd backend && npm test

# Frontend  
cd frontend && npm test

# Both
cd backend && npm test && cd ../frontend && npm test
```

## API Documentation

### POST /api/time-cards

Create a time card from voice transcription.

**Request:**
```json
{
  "workerId": "uuid",
  "transcription": "I worked 8 hours at Simons Property",
  "audioUrl": "https://storage/audio.webm"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "worker_id": "uuid",
  "worksite_id": "uuid",
  "action_type": "HOURS",
  "date": "2026-05-23",
  "hours": 8,
  "transcription": "I worked 8 hours at Simons Property",
  "extracted_data": {
    "action_type": "HOURS",
    "hours": 8,
    "worksite": "Simons Property",
    "confidence": "high"
  },
  "confidence": "high",
  "status": "pending",
  "created_at": "2026-05-23T10:00:00Z"
}
```

### GET /api/time-cards

Retrieve time cards with filters.

**Query Parameters:**
- `workerId` - Filter by worker UUID
- `status` - Filter by status (pending/approved/edited/flagged)
- `startDate` - Filter by date range (YYYY-MM-DD)
- `endDate` - Filter by date range (YYYY-MM-DD)

**Response (200):**
```json
[
  {
    "id": "uuid",
    "worker_id": "uuid",
    "action_type": "HOURS",
    "hours": 8,
    "confidence": "high",
    "workers": { "name": "Bob Martinez" },
    "worksites": { "name": "Simons Property" }
  }
]
```

## Design Documentation

Complete design specification: `Design/2026-05-23-construction-time-tracking-design.md`

Includes:
- System architecture and data models
- AI processing pipeline (Whisper + GPT)
- User workflows and edge cases
- Cost estimates (~$5.15-5.31/month total)
- 6-week implementation roadmap

## Technical Decisions

All architectural decisions documented in `docs/decisions.md`:
- ES Modules vs CommonJS
- Vitest vs Jest
- Express vs Fastify
- GPT-4o-mini for extraction
- Supabase query builder
- Mock transcription strategy
- And 24 more decisions...

## License

TBD

## Contributors

- Nicolas Duchastel de Montrouge (@nduchastel)

## Support

For questions or issues, please open a GitHub issue.
