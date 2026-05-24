# Development Modes

The system supports two development modes: **Real API Mode** (uses OpenAI services) and **Mock Mode** (uses test fixtures).

---

## Mode Comparison

| Aspect | Real API Mode | Mock Mode |
|--------|---------------|-----------|
| **OpenAI calls** | Yes (costs money) | No (free) |
| **Speed** | Slower (network) | Fast (local) |
| **Accuracy** | Real transcription | Pre-recorded samples |
| **API key needed** | Yes | No |
| **Use case** | Integration testing, realistic dev | Unit tests, rapid iteration |
| **Cost per recording** | ~$0.01 | $0 |

---

## Real API Mode (Default)

Uses actual OpenAI Whisper and GPT-4o-mini services.

### Architecture

```
┌──────────────┐
│   Browser    │  Worker records voice
│ (localhost:  │  via MediaRecorder API
│    5173)     │
└──────┬───────┘
       │ POST /api/time-cards/voice
       │ (multipart/form-data: audio file)
       ▼
┌──────────────┐
│   Backend    │  Node.js Express
│ (localhost:  │  Receives audio file
│    3001)     │
└──────┬───────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│   Whisper   │   │   GPT-4o    │
│     API     │   │    mini     │
│             │   │             │
│ audio → text│   │ text → JSON │
└─────────────┘   └─────────────┘
       │                 │
       └────────┬────────┘
                ▼
         ┌─────────────┐
         │  Supabase   │
         │     DB      │  Store time card
         │ (Postgres)  │  after Submit
         └─────────────┘
```

### Configuration

**Backend `.env`:**
```bash
OPENAI_API_KEY=sk-your-key          # Required
SUPABASE_URL=https://xxx.supabase.co # Required
SUPABASE_ANON_KEY=your-key           # Required
PORT=3001
NODE_ENV=development
```

**Frontend `.env`:**
```bash
VITE_API_URL=http://localhost:3001
```

### How It Works

1. Worker records voice in browser (MediaRecorder)
2. Frontend uploads audio file to backend
3. Backend calls **Whisper API** → gets transcription text
4. Backend calls **GPT-4o-mini** → extracts structured data
5. Frontend displays transcription + extracted data
6. Worker reviews and clicks Submit
7. Backend saves to Supabase database

### Cost Breakdown

**Per recording (~30 seconds):**
- Whisper: $0.006/minute × 0.5 min = **$0.003**
- GPT-4o-mini: ~200 tokens × $0.15/1M = **$0.00003**
- **Total: ~$0.003 per recording**

**Monthly estimate (100 recordings/day):**
- 100 recordings/day × 30 days = 3,000 recordings
- 3,000 × $0.003 = **~$9/month**

### When to Use

✅ **Use Real API Mode when:**
- Testing actual transcription accuracy
- Validating extraction logic
- Integration testing before deployment
- Demo/presentation with real voice

❌ **Don't use Real API Mode for:**
- Unit tests (too slow and expensive)
- Repeated testing of same scenario
- Offline development

---

## Mock Mode (Testing)

Uses pre-recorded transcriptions from test fixtures. No OpenAI API calls.

### Architecture

```
┌──────────────┐
│  Test Suite  │  Vitest unit tests
│  (npm test)  │  Run test scenarios
└──────┬───────┘
       │
       ▼
┌─────────────────────────────┐
│  Mock Transcription Data    │
│  backend/tests/fixtures/    │
│                             │
│  transcriptions.js          │
│  - 17 test scenarios        │
│  - Good/bad/edge cases      │
│  - Multiple languages       │
└──────┬──────────────────────┘
       │
       ▼
┌──────────────┐
│  Extraction  │  Uses mocked GPT response
│   Service    │  (or real GPT if desired)
│              │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Time Card    │  Mocked Supabase client
│  Service     │  In-memory operations
│              │
└──────────────┘
```

### Mock Transcription Fixtures

**Location:** `backend/tests/fixtures/transcriptions.js`

**17 test scenarios covering:**

1. **Good cases (8):**
   - Standard 8-hour entry
   - Half-day entry (4 hours)
   - Overtime (12 hours)
   - Multiple workers mentioned
   - Different action types (IN/OUT/HOURS/OFF)
   - French language
   - Spanish language
   - Yesterday's work

2. **Bad cases (5):**
   - No hours mentioned
   - No worksite mentioned
   - Garbled/unclear speech
   - Wrong date format
   - Conflicting information

3. **Edge cases (4):**
   - Decimal hours (7.5 hours)
   - Break time mentioned
   - Multiple worksites
   - Special circumstances (weather, equipment)

### Example Mock Test

```javascript
// backend/tests/unit/extractionService.test.js
import { describe, it, expect, vi } from 'vitest';
import { extractTimeCardData } from '../../src/services/extractionService.js';
import { TRANSCRIPTIONS } from '../fixtures/transcriptions.js';

// Mock OpenAI API
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                action_type: 'HOURS',
                hours: 8,
                worksite: 'Simons Property',
                confidence: 'high'
              })
            }
          }]
        }))
      }
    }
  }))
}));

describe('Extraction Service', () => {
  it('extracts data from standard entry', async () => {
    const result = await extractTimeCardData({
      transcription: TRANSCRIPTIONS.STANDARD_8_HOURS,
      workerName: 'Bob Martinez',
      date: '2026-05-24'
    });

    expect(result.action_type).toBe('HOURS');
    expect(result.hours).toBe(8);
    expect(result.worksite).toBe('Simons Property');
    expect(result.confidence).toBe('high');
  });
});
```

### Configuration

**No API key needed!** Tests run with mocked OpenAI/Supabase.

**Backend `.env` (minimal):**
```bash
NODE_ENV=test
PORT=3001
# OpenAI/Supabase keys not required for tests
```

### How It Works

1. Test imports pre-written transcription from fixtures
2. Test mocks OpenAI API to return deterministic response
3. Extraction service processes mocked transcription
4. Test asserts expected output
5. **No network calls, no API costs**

### When to Use

✅ **Use Mock Mode when:**
- Writing/running unit tests
- Testing edge cases repeatedly
- Developing offline
- CI/CD pipeline (no API keys in CI)
- Rapid iteration on extraction logic

❌ **Don't use Mock Mode for:**
- Validating actual transcription quality
- Testing new audio formats
- Integration testing with real APIs

---

## Switching Between Modes

### For Development: Real API Mode

```bash
# Backend: Set OpenAI key
cd backend
echo "OPENAI_API_KEY=sk-your-key" >> .env

# Start backend (uses real APIs)
npm run dev

# Start frontend
cd ../frontend
npm run dev

# Open browser: http://localhost:5173
# Record voice → Uses Whisper + GPT
```

### For Testing: Mock Mode

```bash
# Backend: Run tests (uses mocks)
cd backend
npm test

# OpenAI calls are automatically mocked
# No API key needed
# Fast execution (no network calls)
```

### Hybrid Approach

You can also **mock Whisper but use real GPT** for extraction testing:

```javascript
// In test file
vi.mock('../../src/services/whisperService.js', () => ({
  transcribeAudio: vi.fn(async () => TRANSCRIPTIONS.STANDARD_8_HOURS)
}));

// Real GPT extraction runs with mocked transcription
// Good for testing extraction logic without audio files
```

---

## Cost Optimization Tips

### For Real API Mode

1. **Use short test phrases** during development:
   - "I worked 8 hours at test site" (shorter = cheaper)
   - Avoid long recordings when testing UI only

2. **Cache responses locally** (future enhancement):
   - Store transcription results for repeated testing
   - Only call API when audio changes

3. **Use Mock Mode first**:
   - Develop/test logic with mocks
   - Switch to Real API for final validation

4. **Monitor usage**:
   - Check [OpenAI usage dashboard](https://platform.openai.com/usage)
   - Set billing alerts

### For Mock Mode

1. **Add new fixtures** for edge cases:
   - Don't rely on Real API to test every scenario
   - Write fixture once, test forever (free)

2. **Update fixtures** when behavior changes:
   - Keep mock responses realistic
   - Sync with actual API responses periodically

---

## Debugging

### Real API Mode Issues

**Problem:** "OpenAI API key not found"  
**Solution:** Check `OPENAI_API_KEY` in `backend/.env`

**Problem:** "Insufficient quota"  
**Solution:** Add credits to OpenAI account

**Problem:** Slow transcription  
**Solution:** Normal - Whisper takes 2-5 seconds per recording

**Problem:** Bad extraction quality  
**Solution:** Check transcription quality first - if transcription is bad, extraction will be bad

### Mock Mode Issues

**Problem:** Tests fail with "OpenAI is not mocked"  
**Solution:** Ensure `vi.mock('openai')` is at top of test file

**Problem:** Mock returns wrong data  
**Solution:** Check mock response matches expected schema

**Problem:** Can't find fixture  
**Solution:** Verify import path: `../fixtures/transcriptions.js`

---

## Best Practices

### Development Workflow

1. **Start with Mock Mode**: Write tests with fixtures
2. **Validate with Real API**: Test once with actual API
3. **Deploy with confidence**: Both modes tested

### Adding New Features

1. **Add fixture** for new scenario (Mock Mode)
2. **Write test** using fixture
3. **Implement feature**
4. **Test with real API** (Real API Mode)
5. **Update fixture** if API response differs

### Testing Strategy

- **Unit tests**: Always use Mock Mode (fast, free)
- **Integration tests**: Use Real API Mode (realistic)
- **Manual testing**: Use Real API Mode (actual experience)
- **CI/CD**: Use Mock Mode (no API keys needed)

---

## Future Enhancements (Phase 4)

**Ideas for improving development experience:**

1. **Offline mode with cached responses**
   - Store API responses locally
   - Replay without network calls

2. **Visual transcription diff tool**
   - Compare fixture vs real API output
   - Highlight differences

3. **Mock audio generator**
   - Text-to-speech for generating test audio files
   - Test MediaRecorder without speaking

4. **Development dashboard**
   - Toggle Real/Mock mode via UI
   - View API usage and costs
   - Inspect recent transcriptions

5. **Hybrid mode with smart caching**
   - Call real API first time
   - Cache and reuse for identical audio
   - Best of both worlds

---

## Summary

| Mode | Speed | Cost | Realism | Use Case |
|------|-------|------|---------|----------|
| **Real API** | Slow | ~$0.003/rec | High | Integration, Demo |
| **Mock** | Fast | $0 | Medium | Unit tests, Dev |

**Recommendation:**
- **Daily development**: Mock Mode (fast, free)
- **Before deployment**: Real API Mode (validate)
- **Best of both**: Start mock, validate real
