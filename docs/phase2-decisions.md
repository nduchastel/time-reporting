# Phase 2 Technical Decisions

**Purpose:** Document all technical decisions made during Phase 2 implementation  
**Format:** Decision log with context, options, rationale, and implementation notes

---

## Decision 1: Audio Format Strategy

**Date:** 2026-05-24  
**Status:** ✅ DECIDED  

**Context:**  
MediaRecorder API produces different formats on different browsers:
- Chrome/Android: WebM with Opus codec
- Safari/iOS: MP4 with AAC codec  
- Some browsers: WAV (uncompressed)

**Options Considered:**
1. **Force single format** - Convert all audio to MP3 on client
2. **Accept browser default** - Send native format to backend
3. **Detect and convert** - Convert on backend if needed

**Decision:** Accept browser's default format (Option 2)

**Rationale:**
- Whisper API accepts webm, mp4, wav, m4a, mp3 (all formats we'd encounter)
- No need for client-side audio conversion (saves bundle size)
- Better network performance (smaller files in native codec)
- Simpler implementation

**Implementation:**
- Frontend: Accept `audio/webm`, `audio/mp4`, `audio/wav` MIME types
- Backend: Send raw blob to Whisper API
- API endpoint: POST /api/audio/transcribe

**Trade-offs:**
- Pro: Simple, fast, efficient
- Con: Can't normalize audio format for consistency
- Acceptable: Whisper handles all formats equally well

---

## Decision 2: Recording Duration Limits

**Date:** 2026-05-24  
**Status:** ✅ DECIDED

**Context:**  
Need to balance user experience with cost control:
- Most time entries are 10-30 seconds (from design spec examples)
- Whisper API costs $0.006/minute
- Workers might forget to stop recording

**Options Considered:**
1. **No limit** - Let users record indefinitely
2. **30 second limit** - Strict, forces brevity
3. **60 second limit** - Reasonable, with warning
4. **120 second limit** - Very generous

**Decision:** 60-second maximum with 50-second warning (Option 3)

**Rationale:**
- 60s is enough for complex entries: "Yesterday I worked with Bob doing 8 hours of snow removal at three different sites: Hyatt on 5th, Simons Property, and ACME construction"
- Cost control: Max $0.006 per entry
- Warning at 50s gives worker time to wrap up
- Auto-stop prevents runaway recordings

**Implementation:**
- Show countdown timer starting at 50 seconds
- Display "10 seconds remaining" warning
- Auto-stop recording at 60 seconds
- Process recording as normal (not an error state)

**Trade-offs:**
- Pro: Prevents accidental long recordings
- Pro: Controls costs predictably
- Con: Might cut off very detailed entries
- Acceptable: Workers can re-record if cut off

---

## Decision 3: Audio Storage Strategy

**Date:** 2026-05-24  
**Status:** ✅ DECIDED

**Context:**  
Database has `audio_url` field to store original audio:
- Useful for dispute resolution
- Useful for re-processing if extraction fails
- Requires object storage (S3, Supabase Storage, etc.)
- Adds complexity to Phase 2

**Options Considered:**
1. **Don't store audio** - Delete after transcription
2. **Store in Supabase Storage** - Implement now
3. **Store URL placeholder** - Implement storage in Phase 3
4. **Store base64 in database** - Bad practice, too large

**Decision:** Keep database field, implement storage in Phase 3 (Option 3)

**Rationale:**
- Focus Phase 2 on core transcription flow
- Storage is a "nice-to-have", not blocking
- Database schema already has `audio_url` field (nullable)
- Can add storage layer later without schema changes

**Implementation:**
- Phase 2: Set `audio_url` to null when creating time cards
- Phase 3: Add Supabase Storage integration
  - Upload audio to bucket
  - Generate signed URL
  - Store URL in database
  - Add retention policy (90 days?)

**Trade-offs:**
- Pro: Faster Phase 2 delivery
- Pro: Simpler initial implementation
- Con: Can't replay original audio in Phase 2
- Con: Can't re-process if extraction fails
- Acceptable: MVP doesn't need audio playback yet

---

## Decision 4: Error Handling Strategy

**Date:** 2026-05-24  
**Status:** ✅ DECIDED

**Context:**  
Multiple failure points in the flow:
- Microphone permission denied
- Recording fails (hardware issue)
- Network failure during upload
- Whisper API failure
- GPT extraction failure
- Database save failure

**Options Considered:**
1. **Silent failures** - Log errors, show generic message
2. **Detailed errors** - Show technical error to worker
3. **User-friendly errors** - Translate technical errors to plain language
4. **Retry logic** - Auto-retry failed requests

**Decision:** User-friendly errors + manual retry (Option 3)

**Rationale:**
- Workers are non-technical (construction site)
- Technical errors are confusing ("CORS error", "500 Internal Server Error")
- Workers need actionable guidance ("Check your microphone" vs "MediaRecorder not supported")
- Manual retry gives worker control

**Implementation:**

Frontend error types:
- `MICROPHONE_DENIED` → "Microphone access denied. Enable in browser settings."
- `RECORDING_FAILED` → "Recording failed. Check microphone and try again."
- `UPLOAD_FAILED` → "Network error. Check connection and try again."
- `PROCESSING_FAILED` → "Could not process recording. Please try again."

Backend error types:
- `TRANSCRIPTION_FAILED` → "Could not transcribe audio. Please speak clearly and try again."
- `EXTRACTION_FAILED` → "Could not understand entry. Please provide worksite and hours."
- `DATABASE_ERROR` → "Could not save entry. Please try again."

Show "Re-record" button for all errors.

**Trade-offs:**
- Pro: Better user experience
- Pro: Workers know what to do
- Con: More error handling code
- Con: Need to test all error paths
- Acceptable: UX is worth the extra code

---

## Decision 5: API Endpoint Design

**Date:** 2026-05-24  
**Status:** ✅ DECIDED

**Context:**  
Need to design endpoint for audio upload + transcription:
- Could be single endpoint (all-in-one)
- Could be separate endpoints (upload, transcribe, extract)
- Need to handle worker ID and action type

**Options Considered:**
1. **POST /api/audio** - Upload only, separate processing
2. **POST /api/transcribe** - Transcribe only (expects audio URL)
3. **POST /api/time-cards/create-from-audio** - All-in-one endpoint
4. **POST /api/time-cards/voice** - Semantic endpoint name

**Decision:** POST /api/time-cards/voice (Option 4)

**Rationale:**
- Semantic: "create time card from voice"
- RESTful: under /time-cards resource
- Atomic: one request does everything (transcribe → extract → save)
- Simpler frontend: single API call

**Implementation:**

Request:
```javascript
POST /api/time-cards/voice
Content-Type: multipart/form-data

{
  workerId: "uuid",
  actionType: "IN" | "OUT" | "HOURS" | "OFF",
  audio: File (blob),
  timestamp: ISO8601 string
}
```

Response (success):
```json
{
  "timeCard": {
    "id": "uuid",
    "transcription": "I worked 8 hours...",
    "extractedData": {...},
    "confidence": "high",
    "status": "pending"
  }
}
```

Response (error):
```json
{
  "error": "TRANSCRIPTION_FAILED",
  "message": "Could not transcribe audio",
  "details": "Whisper API timeout"
}
```

**Trade-offs:**
- Pro: Simple, atomic operation
- Con: Can't reuse transcription endpoint separately
- Acceptable: YAGNI - no current need for separate transcription

---

## Decision 6: Worker Identification (Temporary Phase 2 Solution)

**Date:** 2026-05-24  
**Status:** ✅ DECIDED

**Context:**  
Phase 2 doesn't have worker authentication (PIN system is Phase 3):
- Need worker ID to create time cards
- Can't prompt for PIN yet
- Need something for testing

**Options Considered:**
1. **Hardcode Bob Martinez ID** - Use seed data worker
2. **Local storage with worker picker** - Let user "log in" as any worker
3. **URL parameter** - ?workerId=uuid
4. **Skip worker entirely** - Create anonymous entries

**Decision:** Use Bob Martinez (seed data) for Phase 2 testing (Option 1)

**Rationale:**
- Phase 2 focus is recording → transcription flow
- Authentication is separate concern (Phase 3)
- Bob Martinez already exists in database (from seed data)
- Simplest path to test end-to-end flow
- We'll replace with real auth in Phase 3

**Implementation:**
- Hardcode Bob Martinez UUID in frontend config
- Add comment: "// TODO Phase 3: Replace with real worker authentication"
- Document in phase2-implementation-plan.md

**Trade-offs:**
- Pro: Unblocks Phase 2 development
- Pro: Simple, no auth complexity yet
- Con: Not production-ready
- Con: Need to refactor in Phase 3
- Acceptable: This is a temporary testing solution

---

## Decision 7: File Upload Library Choice

**Date:** 2026-05-24  
**Status:** ✅ DECIDED

**Context:**  
Need to handle multipart/form-data file uploads in Express:
- Audio files from frontend (webm, mp4, wav)
- Need temporary storage during processing
- Need file validation (size, type)

**Options Considered:**
1. **Multer** - Most popular, well-maintained
2. **Busboy** - Lower-level, more control
3. **Formidable** - Alternative to Multer
4. **Express built-in** - No native multipart support

**Decision:** Use Multer (Option 1)

**Rationale:**
- Industry standard for Express file uploads
- Simple API: `upload.single('audio')`
- Built-in validation (fileSize, fileFilter)
- Automatic cleanup on error
- Well-documented and maintained

**Implementation:**
```javascript
const upload = multer({
  dest: '/tmp/uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/webm', 'audio/mp4', 'audio/wav'];
    cb(null, allowed.includes(file.mimetype));
  }
});

router.post('/voice', upload.single('audio'), handler);
```

**Trade-offs:**
- Pro: Simple, reliable, widely used
- Pro: Good error handling
- Con: Adds dependency (not a concern)
- Acceptable: Standard choice for this use case

---

## Decision 8: Temporary File Cleanup Strategy

**Date:** 2026-05-24  
**Status:** ✅ DECIDED

**Context:**  
Multer saves uploaded files to `/tmp/uploads/`:
- Files persist after request completes
- Could fill disk if not cleaned up
- Need cleanup even on error

**Options Considered:**
1. **Manual cleanup** - `fs.unlink()` in finally block
2. **Middleware cleanup** - Global cleanup middleware
3. **Memory storage** - Store in RAM instead of disk
4. **Cron job** - Periodic cleanup of old files

**Decision:** Manual cleanup in finally block (Option 1)

**Rationale:**
- Guaranteed cleanup (finally runs even on error)
- Simple and explicit
- No orphaned files
- Immediate disk reclaim

**Implementation:**
```javascript
let audioFilePath = null;
try {
  audioFilePath = req.file.path;
  // ... process audio
} finally {
  if (audioFilePath) {
    fs.unlink(audioFilePath, (err) => {
      if (err) console.error('Cleanup failed:', err);
    });
  }
}
```

**Trade-offs:**
- Pro: Reliable, no leaked files
- Pro: Works even if handler crashes
- Con: Slight code repetition per endpoint
- Acceptable: Only one audio endpoint

---

## Decision 9: Error Response Structure

**Date:** 2026-05-24  
**Status:** ✅ DECIDED

**Context:**  
Voice endpoint has multiple failure points:
- Missing fields (workerId, audio, actionType)
- Worker not found
- Whisper API failure
- GPT extraction failure
- Database error

Frontend needs to show user-friendly errors.

**Options Considered:**
1. **HTTP status only** - Use status codes (400, 404, 500)
2. **Error codes** - Structured error objects
3. **Mixed approach** - Status + error code + message

**Decision:** Structured error codes (Option 2 with status)

**Rationale:**
- Frontend can map error codes to user messages
- Consistent error handling across endpoints
- Allows localization (Phase 3)
- Details field for debugging

**Implementation:**
```json
{
  "error": "TRANSCRIPTION_FAILED",
  "message": "Could not transcribe audio",
  "details": "Whisper API timeout"
}
```

Error codes:
- `MISSING_WORKER_ID` (400)
- `MISSING_ACTION_TYPE` (400)
- `MISSING_AUDIO` (400)
- `WORKER_NOT_FOUND` (404)
- `TRANSCRIPTION_FAILED` (500)
- `EXTRACTION_FAILED` (500)
- `DATABASE_ERROR` (500)

**Trade-offs:**
- Pro: Structured, consistent
- Pro: Easy to test
- Pro: Frontend has clear signals
- Con: More verbose than plain strings
- Acceptable: Better UX is worth it

---

## Future Decisions (To Be Made)

### Decision 10: Real-time vs Batch Processing
**Status:** TBD  
**Question:** Process audio immediately or queue for later?

### Decision 11: Offline Support Strategy  
**Status:** TBD (Phase 3)  
**Question:** Cache audio locally if offline, sync when online?

### Decision 12: Audio Quality Validation
**Status:** TBD  
**Question:** Validate audio quality before upload (duration, volume, etc.)?

---

## Revision History

- 2026-05-24: Created decision log, documented Decisions 1-6
- 2026-05-24: Added Decisions 7-9 (file upload, cleanup, error structure)
