# Phase 3 Implementation Plan - Worker History & Manager Dashboard

**Status:** PLANNED  
**Goal:** Add worker history view and manager review dashboard

---

## Overview

**Phase 3 adds:**
- Worker: View recent time card submissions (last 5 entries)
- Manager: Authentication and dashboard
- Manager: Review, approve, edit, flag time cards
- Manager: Worker management (add/edit workers)
- Manager: Reports and analytics

**What's already built (Phase 1 & 2):**
- ✅ Database schema with manager approval workflow
- ✅ Worker voice recording → transcription → extraction → database
- ✅ Review-before-submit workflow with success toast
- ✅ Error handling and validation
- ✅ Multilingual support (auto-detection)

---

## Task Breakdown

### Worker Features (3 tasks)

**Task 1: Recent History View**
- Add "History" button/icon at top of worker UI
- Modal/slide-up panel showing last 5 submitted entries
- Each entry displays:
  - Date & time submitted (from `created_at`)
  - Action type badge (IN/OUT/HOURS/OFF with color-coded chips)
  - Work date (from `date` field)
  - Hours (if applicable)
  - Worksite name
  - Status badge (pending/approved/edited/flagged)
  - "View details" button → shows full transcription
- Pull-to-refresh to update list
- Cache in localStorage for offline viewing

**API Endpoint:**
```
GET /api/time-cards?workerId={id}&limit=5&orderBy=created_at:desc
```

**Task 2: Worker Onboarding Flow**
- Manager adds worker (name, phone, language, PIN)
- Worker visits URL first time → PIN entry screen
- Validate PIN with backend
- Store worker auth in localStorage
- "Install as App" prompt (PWA)
- Redirect to main worker UI after authentication

**Task 3: Audio Storage**
- Upload audio files to Supabase Storage during voice endpoint
- Generate signed URL and store in `audio_url` field
- Add "Play audio" button in history view
- Retention policy: keep audio for 90 days, then auto-delete

---

### Manager Features (5 tasks)

**Task 4: Manager Authentication**
- Username/password login screen
- JWT token-based authentication
- Store token in httpOnly cookie or localStorage
- Manager role check in database (`workers` table with `role` field)
- Protected routes: redirect to login if not authenticated

**Schema addition:**
```sql
ALTER TABLE workers ADD COLUMN role TEXT DEFAULT 'worker' CHECK (role IN ('worker', 'manager', 'admin'));
ALTER TABLE workers ADD COLUMN username TEXT UNIQUE;
ALTER TABLE workers ADD COLUMN password_hash TEXT;
```

**Task 5: Manager Dashboard - Time Card Review**
- View all pending time cards (filterable by worker, date range, status)
- Card view with:
  - Worker name + photo (optional)
  - Transcription (expandable)
  - Extracted data (hours, worksite, date, times)
  - Confidence level
  - Play audio button
  - Actions: Approve / Edit / Flag
- Bulk actions: Select multiple → Approve all
- Search/filter: by worker, worksite, date range, status
- Sort: by date, worker, confidence

**Task 6: Manager Dashboard - Edit Time Cards**
- Click "Edit" on any card → opens edit form
- Editable fields: hours, worksite, date, start_time, end_time, notes
- "Save" marks status as `'edited'` and records `approved_by` + `approved_at`
- Keeps original transcription and extracted_data for audit trail
- Log shows: "Edited by [Manager Name] on [Date]"

**Task 7: Manager Dashboard - Worker Management**
- View all workers (list with search/filter)
- Add new worker: name, phone, language, PIN (4-6 digits)
- Edit worker: update name, phone, language, deactivate
- View worker stats: total hours this week/month, recent entries

**Task 8: Manager Dashboard - Reports**
- Weekly/monthly hours summary (by worker)
- Worksite breakdown (hours per site)
- Flagged entries report
- Export to CSV
- Charts: hours over time, worksites distribution

---

## Technical Decisions to Make

### Decision 1: Manager Authentication Strategy
**Options:**
- A) Username/password stored in database (bcrypt hashed)
- B) OAuth with Google/Microsoft SSO
- C) PIN-based like workers (simpler but less secure)

**Recommendation:** A (username/password) for Phase 3, add SSO in Phase 4

---

### Decision 2: Audio Storage Location
**Options:**
- A) Supabase Storage (already using Supabase for DB)
- B) AWS S3 (more flexible, cheaper at scale)
- C) Railway persistent volumes (simplest but not recommended for files)

**Recommendation:** A (Supabase Storage) - integrated with existing Supabase setup

---

### Decision 3: Worker History - How Many Entries?
**Options:**
- A) Last 5 entries (mobile-friendly, quick load)
- B) Last 10 entries (more context)
- C) Infinite scroll / paginated (most flexible but complex)

**Recommendation:** A (last 5) - sufficient for workers to verify recent submissions

---

### Decision 4: Manager Dashboard Framework
**Options:**
- A) Same React app, add manager routes (simpler deployment)
- B) Separate manager web app (better separation, more complex)
- C) Use a pre-built admin framework (e.g., React Admin, Refine)

**Recommendation:** A (same app) - `/manager/*` routes, simpler for Phase 3

---

### Decision 5: Real-time Updates for Manager
**Options:**
- A) Polling every 30 seconds (simple)
- B) WebSocket connection (real-time)
- C) Server-Sent Events (SSE) (simpler than WebSocket)

**Recommendation:** A (polling) for Phase 3, consider B/C in Phase 4 if needed

---

## Implementation Notes

**Worker History:**
- Only show entries from last 30 days to limit data transfer
- Grey out entries that are already approved (workers can't change them)
- Add visual indicator for edited entries (e.g., pencil icon)

**Manager Dashboard:**
- Desktop-first design (managers typically use computers)
- Mobile-responsive but optimized for laptop/tablet
- Keyboard shortcuts for common actions (Approve = A, Flag = F, Edit = E)

**Security:**
- Workers can only see their own time cards
- Managers can see all time cards
- API endpoints check role before returning data
- Rate limiting on authentication endpoints

**Future Phase 4 Ideas:**
- Manager mobile app (approve on-the-go)
- Push notifications for managers when entries need review
- Team/crew support (assign workers to teams)
- Geolocation capture (verify worker is at worksite)
- Payroll integration (export to QuickBooks, ADP, etc.)

---

## Progress Tracking

**Completed:** 0/8 tasks (0%)  
**Current Phase:** Phase 2 (voice recording complete)  
**Next:** Finish Phase 2 testing, then start Phase 3

**Worker Features:** 0/3 complete  
**Manager Features:** 0/5 complete

---

## Dependencies

**Before starting Phase 3:**
- ✅ Phase 2 testing complete (Task 8 & 9)
- ✅ All Phase 2 bugs fixed
- ✅ Database schema supports approval workflow
- ✅ API endpoints for time card CRUD

**External services needed:**
- Supabase Storage (for audio files)
- JWT library (for manager authentication)
- bcrypt (for password hashing)
