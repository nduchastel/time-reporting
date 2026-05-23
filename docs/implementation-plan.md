# Time Reporting System - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a voice-based time tracking PWA with AI transcription, focusing on Phase 1 MVP with comprehensive test coverage using mocked transcription.

**Architecture:** React PWA frontend, Node.js/Express backend, Supabase PostgreSQL database. Voice processing via OpenAI Whisper API (mocked in tests). GPT-4o-mini for data extraction (also mocked).

**Tech Stack:** React, Vite, Tailwind CSS, Node.js, Express, Supabase, OpenAI API, Vitest, Supertest

---

## File Structure

```
time-reporting/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── WorkerUI.jsx           # Main worker interface
│   │   │   ├── RecordButton.jsx       # Voice recording component
│   │   │   └── TimeCardPreview.jsx    # Show extracted data
│   │   ├── services/
│   │   │   ├── audioService.js        # Audio recording/upload
│   │   │   └── apiClient.js           # Backend API calls
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   │   └── manifest.json              # PWA manifest
│   ├── tests/
│   │   └── components/
│   │       └── WorkerUI.test.jsx
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   └── timeCards.js           # Time card endpoints
│   │   ├── services/
│   │   │   ├── transcriptionService.js  # Whisper API wrapper
│   │   │   ├── extractionService.js     # GPT extraction wrapper
│   │   │   └── timeCardService.js       # Business logic
│   │   ├── db/
│   │   │   ├── supabase.js            # Database client
│   │   │   └── migrations/
│   │   │       └── 001_initial_schema.sql
│   │   ├── middleware/
│   │   │   └── errorHandler.js
│   │   └── server.js
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── extractionService.test.js
│   │   │   └── timeCardService.test.js
│   │   ├── integration/
│   │   │   └── timeCards.test.js
│   │   └── fixtures/
│   │       ├── transcriptions.js      # Mock transcription data
│   │       └── testCases.js           # Comprehensive test scenarios
│   ├── package.json
│   └── .env.example
├── docs/
│   ├── implementation-plan.md         # This file
│   └── test-scenarios.md              # Detailed test cases
└── README.md
```

---

## Mock Transcription Test Strategy

**Philosophy:** Cut off voice-to-text entirely in tests. Provide pre-transcribed text (both good and bad quality) to test:
- Data extraction accuracy
- Confidence scoring
- Error handling
- Edge cases

**Mock Levels:**
1. **Unit tests:** Mock both Whisper and GPT APIs completely
2. **Integration tests:** Mock Whisper, use real GPT API for extraction validation
3. **E2E tests (future):** Mock both, test full workflow

---

## Test Scenarios Coverage

### Good Quality Transcriptions (High Confidence Expected)
1. Simple hours: "I worked 8 hours at Simons Property"
2. Check in: "I just arrived at ACME Construction on Main Street"
3. Check out: "Leaving Hyatt now"
4. Time off: "I'm taking tomorrow off"
5. Backdated: "Yesterday I worked 10 hours at Johnston site"
6. With times: "I arrived at 7:30 AM and left at 3:30 PM at Simons"

### Bad Quality Transcriptions (Low Confidence Expected)
1. Garbled site name: "I worked 8 hours at Simmons Simmons Property" (duplicate/unclear)
2. Unclear hours: "I worked uh maybe like 8 or 9 hours at Simons"
3. Missing info: "I worked at the site" (no hours, vague location)
4. Conflicting info: "I worked 8 hours no wait 10 hours at Simons"
5. Ambiguous worker: "Bob and I worked 4 hours at Hyatt" (multiple workers)
6. Wrong date format: "I worked last Tuesday" (vague date reference)

### Edge Cases
1. Long rambling: "So yeah I got to Simons around 7 or maybe 7:30 and worked all day with Bob doing road repair and then we had lunch and finished around 4"
2. Background noise artifacts: "I worked [NOISE] hours at [INAUDIBLE] Property"
3. Non-English mixed: "Je worked 8 hours at Simons aujourd'hui"
4. No work done: "I didn't work today because of weather"
5. Emergency/unusual: "Emergency call - worked 20 hours straight at Simons water main break"

---

## Phase 1: Backend Core (Week 1)

### Task 1: Project Setup

**Files:**
- Create: `backend/package.json`
- Create: `backend/.env.example`
- Create: `backend/src/server.js`

- [ ] **Step 1: Initialize backend project**

```bash
cd time-reporting
mkdir -p backend/src backend/tests/unit backend/tests/integration backend/tests/fixtures
cd backend
npm init -y
npm install express dotenv cors @supabase/supabase-js openai
npm install --save-dev vitest supertest
```

- [ ] **Step 2: Create .env.example**

```bash
# .env.example
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=sk-your-key
NODE_ENV=development
```

- [ ] **Step 3: Create basic Express server**

```javascript
// src/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
```

- [ ] **Step 4: Add test script to package.json**

```json
{
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration"
  }
}
```

- [ ] **Step 5: Test server starts**

Run: `npm run dev`
Expected: "Server running on port 3001"
Visit: http://localhost:3001/health
Expected: `{"status":"ok","timestamp":"..."}`

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: initialize backend with Express server"
```

---

### Task 2: Database Schema

**Files:**
- Create: `backend/src/db/supabase.js`
- Create: `backend/src/db/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create Supabase client**

```javascript
// src/db/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
```

- [ ] **Step 2: Write migration SQL**

```sql
-- src/db/migrations/001_initial_schema.sql

-- Workers table
CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'fr', 'es')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  disabled_range JSONB,
  custom_rules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Worksites table
CREATE TABLE worksites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  client TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  disabled_range JSONB,
  custom_rules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Time cards table
CREATE TABLE time_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id),
  worksite_id UUID REFERENCES worksites(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('IN', 'OUT', 'HOURS', 'OFF')),
  date DATE NOT NULL,
  hours NUMERIC(5,2),
  start_time TIME,
  end_time TIME,
  transcription TEXT NOT NULL,
  audio_url TEXT,
  extracted_data JSONB NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'edited', 'flagged')),
  notes TEXT,
  approved_by UUID REFERENCES workers(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_time_cards_worker_id ON time_cards(worker_id);
CREATE INDEX idx_time_cards_worksite_id ON time_cards(worksite_id);
CREATE INDEX idx_time_cards_date ON time_cards(date);
CREATE INDEX idx_time_cards_status ON time_cards(status);
CREATE INDEX idx_time_cards_created_at ON time_cards(created_at);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_worksites_updated_at BEFORE UPDATE ON worksites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_cards_updated_at BEFORE UPDATE ON time_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 3: Create seed data script**

```javascript
// src/db/seed.js
import { supabase } from './supabase.js';

export async function seedDatabase() {
  // Insert test worker
  const { data: worker, error: workerError } = await supabase
    .from('workers')
    .insert({
      name: 'Bob Martinez',
      email: 'bob@test.com',
      phone: '+1-555-0123',
      language: 'en'
    })
    .select()
    .single();

  if (workerError) throw workerError;

  // Insert test worksites
  const { data: worksites, error: worksitesError } = await supabase
    .from('worksites')
    .insert([
      { name: 'Simons Property', address: '123 Main St', client: 'Simons Corp' },
      { name: 'ACME Construction', address: '456 Oak Ave', client: 'ACME Inc' },
      { name: 'Hyatt Hotel', address: '789 5th Ave', client: 'Hyatt' }
    ])
    .select();

  if (worksitesError) throw worksitesError;

  console.log('Database seeded successfully');
  console.log('Worker:', worker);
  console.log('Worksites:', worksites);

  return { worker, worksites };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
```

- [ ] **Step 4: Run migration in Supabase dashboard**

1. Log into Supabase dashboard
2. Go to SQL Editor
3. Copy/paste content from `001_initial_schema.sql`
4. Run migration
5. Verify tables created in Table Editor

- [ ] **Step 5: Run seed script**

```bash
node src/db/seed.js
```

Expected: "Database seeded successfully" with worker and worksites data

- [ ] **Step 6: Commit**

```bash
git add backend/src/db/
git commit -m "feat: add database schema and seed data"
```

---

### Task 3: Mock Transcription Fixtures

**Files:**
- Create: `backend/tests/fixtures/transcriptions.js`
- Create: `backend/tests/fixtures/testCases.js`

- [ ] **Step 1: Create transcription fixtures**

```javascript
// tests/fixtures/transcriptions.js

export const GOOD_TRANSCRIPTIONS = {
  simpleHours: {
    text: "I worked 8 hours at Simons Property",
    expected: {
      action_type: "HOURS",
      hours: 8,
      worksite: "Simons Property",
      confidence: "high"
    }
  },
  
  checkIn: {
    text: "I just arrived at ACME Construction on Main Street",
    expected: {
      action_type: "IN",
      worksite: "ACME Construction",
      confidence: "high"
    }
  },
  
  checkOut: {
    text: "Leaving Hyatt now",
    expected: {
      action_type: "OUT",
      worksite: "Hyatt",
      confidence: "high"
    }
  },
  
  timeOff: {
    text: "I'm taking tomorrow off",
    expected: {
      action_type: "OFF",
      confidence: "high"
    }
  },
  
  backdated: {
    text: "Yesterday I worked 10 hours at Johnston site",
    expected: {
      action_type: "HOURS",
      hours: 10,
      worksite: "Johnston site",
      date_offset: -1, // yesterday
      confidence: "high"
    }
  },
  
  withTimes: {
    text: "I arrived at 7:30 AM and left at 3:30 PM at Simons",
    expected: {
      action_type: "HOURS",
      start_time: "07:30",
      end_time: "15:30",
      hours: 8,
      worksite: "Simons",
      confidence: "high"
    }
  }
};

export const BAD_TRANSCRIPTIONS = {
  garbledSite: {
    text: "I worked 8 hours at Simmons Simmons Property",
    expected: {
      action_type: "HOURS",
      hours: 8,
      worksite: "Simmons Simmons Property",
      confidence: "medium" // unclear site name
    }
  },
  
  unclearHours: {
    text: "I worked uh maybe like 8 or 9 hours at Simons",
    expected: {
      action_type: "HOURS",
      hours: null, // ambiguous
      worksite: "Simons",
      confidence: "low"
    }
  },
  
  missingInfo: {
    text: "I worked at the site",
    expected: {
      action_type: "HOURS",
      hours: null,
      worksite: null, // vague
      confidence: "low"
    }
  },
  
  conflictingInfo: {
    text: "I worked 8 hours no wait 10 hours at Simons",
    expected: {
      action_type: "HOURS",
      hours: 10, // take last mentioned
      worksite: "Simons",
      confidence: "medium" // conflicting statements
    }
  },
  
  ambiguousWorker: {
    text: "Bob and I worked 4 hours at Hyatt",
    expected: {
      action_type: "HOURS",
      hours: 4,
      worksite: "Hyatt",
      additional_workers: ["Bob"],
      confidence: "medium" // needs manager review
    }
  },
  
  vagueDate: {
    text: "I worked last Tuesday",
    expected: {
      action_type: "HOURS",
      hours: null,
      worksite: null,
      confidence: "low" // vague date
    }
  }
};

export const EDGE_CASES = {
  longRambling: {
    text: "So yeah I got to Simons around 7 or maybe 7:30 and worked all day with Bob doing road repair and then we had lunch and finished around 4",
    expected: {
      action_type: "HOURS",
      start_time: "07:30",
      end_time: "16:00",
      hours: 8.5,
      worksite: "Simons",
      additional_workers: ["Bob"],
      confidence: "medium"
    }
  },
  
  backgroundNoise: {
    text: "I worked [NOISE] hours at [INAUDIBLE] Property",
    expected: {
      action_type: "HOURS",
      hours: null,
      worksite: "[INAUDIBLE] Property",
      confidence: "low"
    }
  },
  
  mixedLanguage: {
    text: "Je worked 8 hours at Simons aujourd'hui",
    expected: {
      action_type: "HOURS",
      hours: 8,
      worksite: "Simons",
      confidence: "medium" // mixed language
    }
  },
  
  noWork: {
    text: "I didn't work today because of weather",
    expected: {
      action_type: "OFF",
      confidence: "high"
    }
  },
  
  emergency: {
    text: "Emergency call - worked 20 hours straight at Simons water main break",
    expected: {
      action_type: "HOURS",
      hours: 20,
      worksite: "Simons",
      confidence: "high",
      notes: "Emergency - water main break"
    }
  }
};
```

- [ ] **Step 2: Create comprehensive test case definitions**

```javascript
// tests/fixtures/testCases.js
import { GOOD_TRANSCRIPTIONS, BAD_TRANSCRIPTIONS, EDGE_CASES } from './transcriptions.js';

export const TEST_WORKER = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Bob Martinez',
  language: 'en'
};

export const TEST_WORKSITES = {
  simons: {
    id: '660e8400-e29b-41d4-a716-446655440000',
    name: 'Simons Property'
  },
  acme: {
    id: '770e8400-e29b-41d4-a716-446655440000',
    name: 'ACME Construction'
  },
  hyatt: {
    id: '880e8400-e29b-41d4-a716-446655440000',
    name: 'Hyatt Hotel'
  }
};

export function createTestCase(transcriptionKey, category) {
  const categories = {
    good: GOOD_TRANSCRIPTIONS,
    bad: BAD_TRANSCRIPTIONS,
    edge: EDGE_CASES
  };
  
  const transcription = categories[category][transcriptionKey];
  
  return {
    name: transcriptionKey,
    category,
    worker: TEST_WORKER,
    transcription: transcription.text,
    expected: transcription.expected,
    mockDate: new Date('2026-05-23T10:00:00Z')
  };
}

export const ALL_TEST_CASES = [
  ...Object.keys(GOOD_TRANSCRIPTIONS).map(key => createTestCase(key, 'good')),
  ...Object.keys(BAD_TRANSCRIPTIONS).map(key => createTestCase(key, 'bad')),
  ...Object.keys(EDGE_CASES).map(key => createTestCase(key, 'edge'))
];
```

- [ ] **Step 3: Commit**

```bash
git add backend/tests/fixtures/
git commit -m "test: add mock transcription fixtures and test cases"
```

---

### Task 4: Extraction Service with Mocked GPT

**Files:**
- Create: `backend/src/services/extractionService.js`
- Create: `backend/tests/unit/extractionService.test.js`

- [ ] **Step 1: Write failing test**

```javascript
// tests/unit/extractionService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractTimeCardData } from '../../src/services/extractionService.js';
import { GOOD_TRANSCRIPTIONS } from '../fixtures/transcriptions.js';

describe('extractionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract simple hours entry', async () => {
    const result = await extractTimeCardData({
      transcription: GOOD_TRANSCRIPTIONS.simpleHours.text,
      workerName: 'Bob Martinez',
      date: '2026-05-23'
    });

    expect(result.action_type).toBe('HOURS');
    expect(result.hours).toBe(8);
    expect(result.worksite).toBe('Simons Property');
    expect(result.confidence).toBe('high');
    expect(result.date).toBe('2026-05-23');
  });

  it('should extract check-in entry', async () => {
    const result = await extractTimeCardData({
      transcription: GOOD_TRANSCRIPTIONS.checkIn.text,
      workerName: 'Bob Martinez',
      date: '2026-05-23'
    });

    expect(result.action_type).toBe('IN');
    expect(result.worksite).toBe('ACME Construction');
    expect(result.start_time).toBeTruthy();
    expect(result.confidence).toBe('high');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- extractionService.test.js`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement extraction service**

```javascript
// src/services/extractionService.js
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_PROMPT = `Extract time entry data from transcription. Return JSON:
{
  "action_type": "IN|OUT|HOURS|OFF",
  "worker": "full name or null",
  "worksite": "site name or null",
  "hours": number or null,
  "start_time": "HH:MM or null",
  "end_time": "HH:MM or null",
  "date": "YYYY-MM-DD or null (defaults to provided date)",
  "confidence": "high|medium|low",
  "additional_workers": ["name1", "name2"] or [],
  "notes": "any special circumstances or null"
}

Confidence rules:
- high: Clear, complete information
- medium: Ambiguous or conflicting info, or multiple workers mentioned
- low: Missing critical info, garbled text, or vague references`;

export async function extractTimeCardData({ transcription, workerName, date }) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Transcription: "${transcription}"
Worker name: "${workerName}"
Today's date: "${date}"`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    });

    const extracted = JSON.parse(response.choices[0].message.content);
    
    // Ensure date defaults to provided date if not specified
    if (!extracted.date) {
      extracted.date = date;
    }
    
    return extracted;
  } catch (error) {
    console.error('Extraction failed:', error);
    throw new Error(`Failed to extract data: ${error.message}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- extractionService.test.js`
Expected: PASS (or SKIP if OPENAI_API_KEY not set - we'll add mocking next)

- [ ] **Step 5: Add mocking for tests**

```javascript
// tests/unit/extractionService.test.js (add at top)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractTimeCardData } from '../../src/services/extractionService.js';
import { GOOD_TRANSCRIPTIONS, BAD_TRANSCRIPTIONS } from '../fixtures/transcriptions.js';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      constructor() {
        this.chat = {
          completions: {
            create: vi.fn(async ({ messages }) => {
              const userMessage = messages.find(m => m.role === 'user');
              const transcription = userMessage.content.match(/Transcription: "(.+)"/)[1];
              
              // Find matching fixture
              const allTranscriptions = { ...GOOD_TRANSCRIPTIONS, ...BAD_TRANSCRIPTIONS };
              const fixture = Object.values(allTranscriptions).find(t => t.text === transcription);
              
              if (!fixture) {
                throw new Error(`No mock data for transcription: ${transcription}`);
              }
              
              // Build response from expected data
              const extracted = {
                action_type: fixture.expected.action_type,
                worker: fixture.expected.worker || null,
                worksite: fixture.expected.worksite || null,
                hours: fixture.expected.hours || null,
                start_time: fixture.expected.start_time || null,
                end_time: fixture.expected.end_time || null,
                date: fixture.expected.date || userMessage.content.match(/Today's date: "(.+)"/)[1],
                confidence: fixture.expected.confidence,
                additional_workers: fixture.expected.additional_workers || [],
                notes: fixture.expected.notes || null
              };
              
              return {
                choices: [{
                  message: {
                    content: JSON.stringify(extracted)
                  }
                }]
              };
            })
          }
        };
      }
    }
  };
});

// ... rest of tests
```

- [ ] **Step 6: Add more test cases**

```javascript
// Continue in tests/unit/extractionService.test.js

it('should handle bad transcription with low confidence', async () => {
  const result = await extractTimeCardData({
    transcription: BAD_TRANSCRIPTIONS.unclearHours.text,
    workerName: 'Bob Martinez',
    date: '2026-05-23'
  });

  expect(result.confidence).toBe('low');
  expect(result.hours).toBeNull();
});

it('should detect multiple workers', async () => {
  const result = await extractTimeCardData({
    transcription: BAD_TRANSCRIPTIONS.ambiguousWorker.text,
    workerName: 'Bob Martinez',
    date: '2026-05-23'
  });

  expect(result.additional_workers).toContain('Bob');
  expect(result.confidence).toBe('medium');
});
```

- [ ] **Step 7: Run all tests**

Run: `npm test -- extractionService.test.js`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/extractionService.js backend/tests/unit/extractionService.test.js
git commit -m "feat: add extraction service with mocked GPT tests"
```

---

### Task 5: Time Card Service

**Files:**
- Create: `backend/src/services/timeCardService.js`
- Create: `backend/tests/unit/timeCardService.test.js`

- [ ] **Step 1: Write failing test**

```javascript
// tests/unit/timeCardService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTimeCard, getTimeCards } from '../../src/services/timeCardService.js';

vi.mock('../db/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: { id: 'test-id', status: 'pending' },
            error: null
          }))
        }))
      })),
      select: vi.fn(() => Promise.resolve({
        data: [],
        error: null
      }))
    }))
  }
}));

describe('timeCardService', () => {
  it('should create a time card', async () => {
    const timeCard = await createTimeCard({
      workerId: 'worker-123',
      worksiteId: 'site-456',
      actionType: 'HOURS',
      date: '2026-05-23',
      hours: 8,
      transcription: 'I worked 8 hours',
      extractedData: { confidence: 'high' },
      audioUrl: 'https://storage/audio.webm'
    });

    expect(timeCard).toBeDefined();
    expect(timeCard.status).toBe('pending');
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- timeCardService.test.js`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement service**

```javascript
// src/services/timeCardService.js
import { supabase } from '../db/supabase.js';

export async function createTimeCard({
  workerId,
  worksiteId,
  actionType,
  date,
  hours,
  startTime,
  endTime,
  transcription,
  extractedData,
  audioUrl
}) {
  const { data, error } = await supabase
    .from('time_cards')
    .insert({
      worker_id: workerId,
      worksite_id: worksiteId,
      action_type: actionType,
      date,
      hours,
      start_time: startTime,
      end_time: endTime,
      transcription,
      extracted_data: extractedData,
      confidence: extractedData.confidence,
      audio_url: audioUrl,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getTimeCards({ workerId, status, startDate, endDate }) {
  let query = supabase
    .from('time_cards')
    .select('*, workers(name), worksites(name)')
    .order('created_at', { ascending: false });

  if (workerId) query = query.eq('worker_id', workerId);
  if (status) query = query.eq('status', status);
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- timeCardService.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/timeCardService.js backend/tests/unit/timeCardService.test.js
git commit -m "feat: add time card service with database operations"
```

---

### Task 6: API Routes

**Files:**
- Create: `backend/src/routes/timeCards.js`
- Create: `backend/tests/integration/timeCards.test.js`
- Modify: `backend/src/server.js`

- [ ] **Step 1: Write integration test**

```javascript
// tests/integration/timeCards.test.js
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import { ALL_TEST_CASES } from '../fixtures/testCases.js';

describe('POST /api/time-cards', () => {
  it('should create time card from voice transcription', async () => {
    const testCase = ALL_TEST_CASES.find(tc => tc.name === 'simpleHours');
    
    const response = await request(app)
      .post('/api/time-cards')
      .send({
        workerId: testCase.worker.id,
        transcription: testCase.transcription,
        audioUrl: 'https://test.com/audio.webm'
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.action_type).toBe('HOURS');
    expect(response.body.hours).toBe(8);
    expect(response.body.confidence).toBe('high');
  });

  it('should handle low confidence transcriptions', async () => {
    const testCase = ALL_TEST_CASES.find(tc => tc.name === 'unclearHours');
    
    const response = await request(app)
      .post('/api/time-cards')
      .send({
        workerId: testCase.worker.id,
        transcription: testCase.transcription,
        audioUrl: 'https://test.com/audio.webm'
      })
      .expect(201);

    expect(response.body.confidence).toBe('low');
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- timeCards.test.js`
Expected: FAIL with 404

- [ ] **Step 3: Create route handler**

```javascript
// src/routes/timeCards.js
import express from 'express';
import { extractTimeCardData } from '../services/extractionService.js';
import { createTimeCard, getTimeCards } from '../services/timeCardService.js';
import { supabase } from '../db/supabase.js';

const router = express.Router();

router.post('/time-cards', async (req, res, next) => {
  try {
    const { workerId, transcription, audioUrl } = req.body;

    // Get worker info
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('name')
      .eq('id', workerId)
      .single();

    if (workerError) throw workerError;

    // Extract data from transcription
    const extracted = await extractTimeCardData({
      transcription,
      workerName: worker.name,
      date: new Date().toISOString().split('T')[0]
    });

    // Find or create worksite
    let worksiteId = null;
    if (extracted.worksite) {
      const { data: existingWorksite } = await supabase
        .from('worksites')
        .select('id')
        .ilike('name', `%${extracted.worksite}%`)
        .single();

      if (existingWorksite) {
        worksiteId = existingWorksite.id;
      }
    }

    // Create time card
    const timeCard = await createTimeCard({
      workerId,
      worksiteId,
      actionType: extracted.action_type,
      date: extracted.date,
      hours: extracted.hours,
      startTime: extracted.start_time,
      endTime: extracted.end_time,
      transcription,
      extractedData: extracted,
      audioUrl
    });

    res.status(201).json(timeCard);
  } catch (error) {
    next(error);
  }
});

router.get('/time-cards', async (req, res, next) => {
  try {
    const { workerId, status, startDate, endDate } = req.query;
    
    const timeCards = await getTimeCards({
      workerId,
      status,
      startDate,
      endDate
    });

    res.json(timeCards);
  } catch (error) {
    next(error);
  }
});

export default router;
```

- [ ] **Step 4: Add routes to server**

```javascript
// src/server.js (modify)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import timeCardsRouter from './routes/timeCards.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', timeCardsRouter);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error'
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
```

- [ ] **Step 5: Run integration tests**

Run: `npm run test:integration`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/ backend/tests/integration/ backend/src/server.js
git commit -m "feat: add time cards API endpoints with integration tests"
```

---

## Phase 2: Frontend Core (Week 2)

### Task 7: Frontend Project Setup

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`

- [ ] **Step 1: Initialize frontend**

```bash
cd time-reporting
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Configure Tailwind**

```javascript
// tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'action-in': '#00897b',
        'action-out': '#28a745',
        'action-hours': '#0288d1',
        'action-off': '#f57c00',
      }
    },
  },
  plugins: [],
}
```

- [ ] **Step 3: Configure Vitest**

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
});
```

- [ ] **Step 4: Create test setup**

```javascript
// src/test/setup.js
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 5: Update package.json scripts**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: initialize frontend with React, Vite, and Tailwind"
```

---

### Task 8: Worker UI Component

**Files:**
- Create: `frontend/src/components/WorkerUI.jsx`
- Create: `frontend/src/components/RecordButton.jsx`
- Create: `frontend/tests/WorkerUI.test.jsx`

- [ ] **Step 1: Write component test**

```javascript
// tests/WorkerUI.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkerUI from '../src/components/WorkerUI';

describe('WorkerUI', () => {
  it('should render 4 action type screens', () => {
    render(<WorkerUI />);
    
    expect(screen.getByText(/check in/i)).toBeInTheDocument();
    expect(screen.getByText(/check out/i)).toBeInTheDocument();
    expect(screen.getByText(/hours worked/i)).toBeInTheDocument();
    expect(screen.getByText(/time off/i)).toBeInTheDocument();
  });

  it('should show record button', () => {
    render(<WorkerUI />);
    
    const recordButton = screen.getByRole('button', { name: /record/i });
    expect(recordButton).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test`
Expected: FAIL

- [ ] **Step 3: Create WorkerUI component**

```jsx
// src/components/WorkerUI.jsx
import { useState } from 'react';
import RecordButton from './RecordButton';

const ACTION_TYPES = [
  { type: 'IN', label: 'Check IN', emoji: '📍', color: 'bg-action-in' },
  { type: 'OUT', label: 'Check OUT', emoji: '🏠', color: 'bg-action-out' },
  { type: 'HOURS', label: 'Hours Worked', emoji: '⏱️', color: 'bg-action-hours' },
  { type: 'OFF', label: 'Time OFF', emoji: '🌴', color: 'bg-action-off' },
];

export default function WorkerUI() {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [transcription, setTranscription] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const currentAction = ACTION_TYPES[currentScreen];

  const handleSwipe = (direction) => {
    if (direction === 'left' && currentScreen < ACTION_TYPES.length - 1) {
      setCurrentScreen(currentScreen + 1);
    } else if (direction === 'right' && currentScreen > 0) {
      setCurrentScreen(currentScreen - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with swipe dots */}
      <div className="bg-white shadow p-4">
        <div className="flex justify-center gap-2">
          {ACTION_TYPES.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentScreen(index)}
              className={`w-3 h-3 rounded-full ${
                index === currentScreen ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Action screen */}
      <div className={`${currentAction.color} py-8 px-4 text-center text-white`}>
        <div className="text-6xl mb-4">{currentAction.emoji}</div>
        <h1 className="text-3xl font-bold">{currentAction.label}</h1>
      </div>

      {/* Instructions */}
      <div className="p-6 bg-white">
        <p className="text-gray-700 mb-4 text-base">
          Tap the record button and describe your time:
        </p>
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-gray-600 italic">
            Example: "I worked 8 hours at Simons Property today"
          </p>
        </div>

        {/* Record button */}
        <RecordButton
          onTranscription={setTranscription}
          onExtractedData={setExtractedData}
          isRecording={isRecording}
          setIsRecording={setIsRecording}
        />

        {/* Transcription preview */}
        {transcription && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2 text-base">Transcription:</h3>
            <p className="text-gray-700 text-lg">{transcription}</p>
          </div>
        )}

        {/* Extracted data preview */}
        {extractedData && (
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <h3 className="font-semibold mb-2 text-base">Extracted Data:</h3>
            <div className="space-y-2 text-base">
              <p><strong>Action:</strong> {extractedData.action_type}</p>
              {extractedData.hours && <p><strong>Hours:</strong> {extractedData.hours}</p>}
              {extractedData.worksite && <p><strong>Worksite:</strong> {extractedData.worksite}</p>}
              <p><strong>Confidence:</strong> {extractedData.confidence}</p>
            </div>
            
            <div className="mt-4 flex gap-2">
              <button className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold">
                Submit
              </button>
              <button className="px-6 bg-gray-400 text-white py-3 rounded-lg">
                Re-record
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create RecordButton component**

```jsx
// src/components/RecordButton.jsx
import { useState } from 'react';

export default function RecordButton({ onTranscription, onExtractedData, isRecording, setIsRecording }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRecord = async () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      setIsProcessing(true);
      
      // TODO: Send audio to backend
      // For now, simulate with mock data
      setTimeout(() => {
        onTranscription("I worked 8 hours at Simons Property");
        onExtractedData({
          action_type: "HOURS",
          hours: 8,
          worksite: "Simons Property",
          confidence: "high"
        });
        setIsProcessing(false);
      }, 1000);
    } else {
      // Start recording
      setIsRecording(true);
    }
  };

  return (
    <div className="text-center">
      <button
        onClick={handleRecord}
        disabled={isProcessing}
        className={`w-20 h-20 rounded-full shadow-lg ${
          isRecording ? 'bg-red-500' : 'bg-blue-600'
        } ${isProcessing ? 'opacity-50' : ''}`}
      >
        <span className="text-white text-3xl">
          {isProcessing ? '⏳' : isRecording ? '⏹' : '⏺'}
        </span>
      </button>
      <p className="mt-2 text-gray-600">
        {isProcessing ? 'Processing...' : isRecording ? 'Tap to stop' : 'Tap to record'}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ frontend/tests/
git commit -m "feat: add worker UI with recording interface"
```

---

## Next Steps Summary

This plan covers **Phase 1 MVP**:
- ✅ Backend with mocked transcription tests
- ✅ Complete test fixtures (good/bad/edge cases)
- ✅ Database schema and seed data
- ✅ Extraction service with GPT
- ✅ Time card CRUD operations
- ✅ API endpoints
- ✅ Frontend worker UI

**Remaining for full MVP:**
- Audio recording and upload (frontend)
- Whisper API integration (backend)
- Manager dashboard (basic list view)
- PWA configuration (manifest, service worker)

**Implementation approach recommendation:**
Use **Subagent-Driven Development** for task-by-task execution with review gates between tasks.

---

## Test Execution Guide

### Run all tests
```bash
# Backend
cd backend
npm test

# Frontend  
cd frontend
npm test
```

### Run specific test suites
```bash
# Backend unit tests
npm run test:unit

# Backend integration tests
npm run test:integration

# Run specific test file
npm test -- extractionService.test.js
```

### Mock data inspection
```javascript
// See all test cases
import { ALL_TEST_CASES } from './tests/fixtures/testCases.js';
console.log(ALL_TEST_CASES);

// See specific category
import { GOOD_TRANSCRIPTIONS, BAD_TRANSCRIPTIONS, EDGE_CASES } from './tests/fixtures/transcriptions.js';
```

---

**Plan complete and ready for implementation!**
