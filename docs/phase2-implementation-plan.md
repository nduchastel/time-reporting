# Phase 2 Implementation Plan - Real Audio Recording & Transcription

**Status:** IN PROGRESS  
**Started:** 2026-05-24  
**Goal:** End-to-end voice recording → Whisper transcription → GPT extraction → Database storage

---

## Overview

**Phase 2-A adds:**
- Real audio recording (MediaRecorder API)
- Whisper API transcription
- Full integration with backend/database
- Error handling and user feedback

**What's already built (Phase 1):**
- ✅ Backend API structure
- ✅ GPT-4o-mini extraction service
- ✅ Database schema and CRUD operations
- ✅ Frontend UI with mock recording

---

## Task Breakdown

### Frontend Tasks (4)
1. [x] Implement MediaRecorder API ✅
2. [x] Request microphone permissions ✅
3. [ ] Send audio to backend API
4. [x] Handle responses and errors ✅

### Backend Tasks (3)
1. [ ] Create audio upload endpoint
2. [ ] Integrate Whisper API
3. [ ] Connect to existing extraction flow

### Integration Testing (2)
1. [ ] Test full end-to-end flow
2. [ ] Error handling scenarios

---

## Technical Decisions Log

### Decision 1: Audio Format
**Date:** 2026-05-24  
**Context:** Need to choose audio codec for recording  
**Options:**
- WebM with Opus codec (Chrome/Android default)
- MP4 with AAC (iOS Safari default)
- WAV (uncompressed, large files)

**Decision:** Use browser's default format, send as-is to backend
- Whisper API accepts multiple formats (webm, mp4, wav, etc.)
- No client-side conversion needed
- Smaller file sizes for network transfer

**Implementation:** Accept `audio/webm`, `audio/mp4`, `audio/wav` MIME types

---

### Decision 2: Recording Duration Limits
**Date:** 2026-05-24  
**Context:** Prevent accidental long recordings and control API costs

**Decision:** 60-second maximum recording time
- Most entries are 10-30 seconds (from design spec)
- Whisper API cost is $0.006/minute
- Prevents runaway costs if worker forgets to stop
- Shows countdown timer at 50 seconds

**Implementation:** Auto-stop at 60s, show warning at 50s

---

### Decision 3: Audio Storage Strategy
**Date:** 2026-05-24  
**Context:** Do we store audio files long-term?

**Decision:** Store audio URL in database, but DON'T implement storage yet (Phase 3)
- Keep `audio_url` field in database (already exists)
- For Phase 2: Set to null or temporary value
- For Phase 3: Add S3/Supabase Storage integration
- Reasoning: Focus on core flow first, storage is nice-to-have

**Implementation:** `audio_url` field remains null in Phase 2

---

## Task 1: Implement MediaRecorder API ✅ COMPLETE

**Status:** ✅ COMPLETE  
**Completed:** 2026-05-24  
**Commit:** 2964c19  
**File:** `frontend/src/components/RecordButton.jsx`

**Changes:**
- ✅ Replace mock setTimeout with real MediaRecorder
- ✅ Request microphone permission (NotAllowedError, NotFoundError)
- ✅ Capture audio as Blob (browser's native format)
- ✅ Add recording timer (displays seconds)
- ✅ Add max duration limit (60s auto-stop)
- ✅ Add warning at 50 seconds ("10s remaining")
- ✅ Add pulse animation during recording
- ✅ Error handling with user-friendly messages
- ✅ Stop all media tracks when done

**Implementation Notes:**
- Uses browser's default audio format (webm/mp4)
- MediaRecorder.mimeType used for Blob
- Refs for MediaRecorder, audioChunks, timer, stream
- Timer interval cleared on unmount
- Audio blob logged to console for debugging

**Next:** Task 4 - Backend API endpoint

---

## Current Task: Task 4 - Backend Audio Endpoint

**Status:** STARTING  
**File:** `backend/src/routes/timeCards.js`

**What's needed:**
- POST /api/time-cards/voice endpoint
- Accept multipart/form-data (audio file)
- Send to Whisper API
- Extract with GPT
- Save to database
- Return time card

---

## Notes

- All audio processing happens on backend (security)
- Frontend only captures and uploads raw audio
- OpenAI API key stays in Railway backend (never exposed)
- Use Web Audio API for future enhancements (Phase 3: audio levels, noise detection)

---

## Progress Tracking

**Completed:** 3/9 tasks (33%)  
**Current:** Task 4 - Backend audio endpoint  
**Next:** Task 5 - Whisper integration

**Frontend:** 3/4 complete (Tasks 1, 2, 4 done; Task 3 waiting for backend)  
**Backend:** 0/3 complete  
**Testing:** 0/2 complete
