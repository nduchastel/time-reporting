# Database Schema

Complete database schema for the time reporting system.

---

## Overview

The database uses **PostgreSQL** (via Supabase) with three core tables:

- **workers** - Employee records and authentication
- **worksites** - Job site locations
- **time_cards** - Time entries with approval workflow

---

## Schema Diagram

![Database Schema](images/database-schema.png)

**Relationships:**
- `time_cards.worker_id` → `workers.id` (many-to-one)
- `time_cards.worksite_id` → `worksites.id` (many-to-one, nullable)
- `time_cards.approved_by` → `workers.id` (many-to-one, nullable)

---

## Tables

### workers

Employee records with authentication and preferences.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique worker identifier |
| `name` | TEXT | NOT NULL | Full name (e.g., "Bob Martinez") |
| `email` | TEXT | UNIQUE | Email address (optional) |
| `phone` | TEXT | | Phone number for SMS (optional) |
| `language` | TEXT | DEFAULT 'en' | Preferred language (en, fr, es, etc.) |
| `status` | TEXT | DEFAULT 'active' | active \| inactive |
| `disabled_range` | JSONB | | Date ranges when worker is disabled |
| `custom_rules` | JSONB | | Worker-specific validation rules |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_workers_status` on `status`
- `idx_workers_email` on `email` (unique)

**Notes:**
- Phase 3 will add: `role` (worker/manager/admin), `username`, `password_hash`, `pin`
- `language` used for Whisper transcription (auto-detection fallback)
- `status = 'inactive'` prevents new time card submissions

---

### worksites

Job site locations where work is performed.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique worksite identifier |
| `name` | TEXT | NOT NULL, UNIQUE | Worksite name (e.g., "Simons Property") |
| `address` | TEXT | | Physical address (optional) |
| `client` | TEXT | | Client/customer name (optional) |
| `status` | TEXT | DEFAULT 'active' | active \| inactive |
| `disabled_range` | JSONB | | Date ranges when site is disabled |
| `custom_rules` | JSONB | | Site-specific validation rules |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_worksites_name` on `name` (unique)
- `idx_worksites_status` on `status`

**Notes:**
- GPT extracts worksite name from transcription
- Fuzzy match: "Simon's property" → matches "Simons Property"
- If no match found, `worksite_id` is null (valid for some action types)

---

### time_cards

Time entries with approval workflow and audit trail.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique time card identifier |
| `worker_id` | UUID | NOT NULL, REFERENCES workers(id) | Worker who submitted entry |
| `worksite_id` | UUID | NULLABLE, REFERENCES worksites(id) | Where work was performed |
| `action_type` | TEXT | NOT NULL, CHECK (IN ...) | IN \| OUT \| HOURS \| OFF |
| `date` | DATE | NOT NULL | Date when work occurred |
| `hours` | NUMERIC(5,2) | | Total hours worked (e.g., 8.50) |
| `start_time` | TIME | | Check-in time (HH:MM) |
| `end_time` | TIME | | Check-out time (HH:MM) |
| `transcription` | TEXT | NOT NULL | Original voice-to-text output |
| `audio_url` | TEXT | | URL to audio file (Phase 3) |
| `extracted_data` | JSONB | NOT NULL | GPT extraction output (full JSON) |
| `confidence` | TEXT | NOT NULL, CHECK (IN ...) | high \| medium \| low |
| `status` | TEXT | NOT NULL, DEFAULT 'pending' | pending \| approved \| edited \| flagged |
| `notes` | TEXT | | Manager notes (optional) |
| `approved_by` | UUID | NULLABLE, REFERENCES workers(id) | Manager who approved/edited |
| `approved_at` | TIMESTAMPTZ | | When approved/edited |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When worker submitted |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_time_cards_worker_id` on `worker_id`
- `idx_time_cards_worksite_id` on `worksite_id`
- `idx_time_cards_date` on `date`
- `idx_time_cards_status` on `status`
- `idx_time_cards_created_at` on `created_at`

**Constraints:**
- `action_type` must be one of: `'IN'`, `'OUT'`, `'HOURS'`, `'OFF'`
- `confidence` must be one of: `'high'`, `'medium'`, `'low'`
- `status` must be one of: `'pending'`, `'approved'`, `'edited'`, `'flagged'`

**Notes:**
- **Submission vs Work timestamps:**
  - `created_at` = when worker submitted (e.g., 2026-05-24 11:23 AM)
  - `date`, `start_time`, `end_time` = when work happened (e.g., 2026-05-23)
- **Low confidence rejection:** Backend rejects entries with `confidence = 'low'` before saving
- **Audit trail:** Original `transcription` and `extracted_data` preserved even if manager edits

---

## Action Types

### IN (Check In)
Worker arrives at worksite.

**Required fields:** `worker_id`, `date`, `start_time`  
**Optional fields:** `worksite_id`  
**Auto-filled:** `start_time` = server timestamp if not mentioned

**Example transcription:**  
"I just arrived at Simons Property"

**Extracted data:**
```json
{
  "action_type": "IN",
  "date": "2026-05-24",
  "start_time": "08:15",
  "worksite": "Simons Property"
}
```

---

### OUT (Check Out)
Worker leaves worksite.

**Required fields:** `worker_id`, `date`, `end_time`  
**Optional fields:** `worksite_id`  
**Auto-filled:** `end_time` = server timestamp if not mentioned

**Example transcription:**  
"Leaving the downtown office now"

**Extracted data:**
```json
{
  "action_type": "OUT",
  "date": "2026-05-24",
  "end_time": "17:30",
  "worksite": "downtown office"
}
```

---

### HOURS (Hours Worked)
Worker reports total hours worked.

**Required fields:** `worker_id`, `date`, `hours`  
**Optional fields:** `worksite_id`, `start_time`, `end_time`  
**Validation:** Backend rejects if `hours` is missing

**Example transcription:**  
"I worked 8 hours at Simons Property today"

**Extracted data:**
```json
{
  "action_type": "HOURS",
  "date": "2026-05-24",
  "hours": 8,
  "worksite": "Simons Property"
}
```

---

### OFF (Time Off)
Worker reports time off (sick, vacation, etc.).

**Required fields:** `worker_id`, `date`, `hours`  
**Optional fields:** `notes`  
**Validation:** Backend rejects if `hours` is missing

**Example transcription:**  
"I was sick yesterday, 8 hours off"

**Extracted data:**
```json
{
  "action_type": "OFF",
  "date": "2026-05-23",
  "hours": 8,
  "notes": "sick"
}
```

---

## Approval Workflow

### Status Flow

```
pending → approved    (Manager approves as-is)
pending → edited      (Manager corrects hours/worksite/date)
pending → flagged     (Suspicious, needs investigation)
```

### Status Meanings

**pending:**
- Just submitted by worker
- Awaiting manager review
- Default status for new entries

**approved:**
- Manager verified and approved
- No changes made
- `approved_by` and `approved_at` populated

**edited:**
- Manager made corrections
- Original `transcription` and `extracted_data` preserved
- `approved_by` and `approved_at` populated
- Changes visible in audit log

**flagged:**
- Suspicious or needs investigation
- Examples: duplicate entry, wrong worksite, unusual hours
- Manager must review before approval

---

## Data Flow

### 1. Worker Submission

```
Worker records voice
     ↓
Frontend uploads audio + worker_id + action_type
     ↓
Backend: Whisper transcription
     ↓
Backend: GPT extraction
     ↓
Frontend: Display transcription + extracted data
     ↓
Worker reviews and clicks Submit
     ↓
Backend: Validate and save to database
     ↓
status = 'pending'
```

### 2. Manager Review (Phase 3)

```
Manager views pending time cards
     ↓
Review transcription, extracted data, audio
     ↓
Manager action:
  - Approve → status = 'approved'
  - Edit → status = 'edited', update fields
  - Flag → status = 'flagged', add notes
     ↓
approved_by = manager_id
approved_at = NOW()
```

---

## JSONB Fields

### extracted_data

Full output from GPT-4o-mini extraction service.

**Schema:**
```json
{
  "action_type": "IN|OUT|HOURS|OFF",
  "worker": "Full name or null",
  "worksite": "Site name or null",
  "hours": 8.5,
  "start_time": "09:00",
  "end_time": "17:30",
  "date": "2026-05-24",
  "confidence": "high|medium|low",
  "additional_workers": ["Alice Johnson"],
  "notes": "Special circumstances"
}
```

**Purpose:**
- Audit trail of raw GPT output
- Debugging extraction quality
- Future: ML training data

---

### custom_rules (workers, worksites)

Worker or site-specific validation rules (Phase 3+).

**Example:**
```json
{
  "max_hours_per_day": 12,
  "allowed_worksites": ["Site A", "Site B"],
  "require_photo": true
}
```

---

### disabled_range (workers, worksites)

Date ranges when worker or site is temporarily disabled.

**Example:**
```json
[
  {
    "start": "2026-06-01",
    "end": "2026-06-15",
    "reason": "vacation"
  }
]
```

---

## Triggers

### update_updated_at_column()

Automatically updates `updated_at` timestamp on any row update.

**Applied to all tables:**
- `workers`
- `worksites`
- `time_cards`

**Implementation:**
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_time_cards_updated_at 
  BEFORE UPDATE ON time_cards
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Queries

### Common Query Patterns

**Get pending time cards for review:**
```sql
SELECT 
  tc.*,
  w.name as worker_name,
  ws.name as worksite_name
FROM time_cards tc
LEFT JOIN workers w ON tc.worker_id = w.id
LEFT JOIN worksites ws ON tc.worksite_id = ws.id
WHERE tc.status = 'pending'
ORDER BY tc.created_at DESC;
```

**Get worker's recent entries:**
```sql
SELECT * FROM time_cards
WHERE worker_id = 'uuid'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 5;
```

**Weekly hours summary by worker:**
```sql
SELECT 
  w.name,
  SUM(tc.hours) as total_hours,
  COUNT(*) as entries
FROM time_cards tc
JOIN workers w ON tc.worker_id = w.id
WHERE tc.date >= date_trunc('week', CURRENT_DATE)
  AND tc.action_type IN ('HOURS', 'IN', 'OUT')
  AND tc.status = 'approved'
GROUP BY w.name
ORDER BY total_hours DESC;
```

**Flagged entries needing review:**
```sql
SELECT 
  tc.*,
  w.name as worker_name,
  ws.name as worksite_name
FROM time_cards tc
LEFT JOIN workers w ON tc.worker_id = w.id
LEFT JOIN worksites ws ON tc.worksite_id = ws.id
WHERE tc.status = 'flagged'
ORDER BY tc.created_at ASC;
```

---

## Migration

**File:** `backend/src/db/migrations/001_initial_schema.sql`

**Run in Supabase SQL Editor:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor**
4. Click **"New query"**
5. Copy entire contents of `001_initial_schema.sql`
6. Click **"Run"**
7. Verify: "Success. No rows returned"

**Verify tables created:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

Should return: `workers`, `worksites`, `time_cards`

---

## Seed Data

**File:** `backend/src/db/seed.js`

**Run from command line:**
```bash
cd backend
node src/db/seed.js
```

**Creates:**
- 5 test workers (Bob Martinez, Alice Johnson, Carlos Rodriguez, Diana Lee, Eva Thompson)
- 4 test worksites (Simons Property, Downtown Office, Highway 101 Expansion, Riverside Plaza)

**Seed data includes:**
- Different languages (en, es, fr)
- Active/inactive status examples
- Various worksite types

See [Database README](../backend/src/db/README.md) for seed data details.

---

## Phase 3 Additions (Applied)

Migration applied: 002_phase3_auth_and_indexes.sql

### New worker fields:
- `role` TEXT - 'worker' | 'manager' | 'admin'
- `username` TEXT UNIQUE - for manager login
- `password_hash` TEXT - bcrypt hashed password
- `pin` TEXT - 4-6 digit PIN for worker auth

### New indexes:
- `idx_workers_username` on `username` (unique)
- `idx_workers_role` on `role`

### New features:
- Audio storage: `audio_url` will point to Supabase Storage
- Manager dashboard queries (join with approved_by)
- Worker history queries (recent 5 entries)

---

## Security (Row Level Security)

**Phase 3 will add RLS policies:**

```sql
-- Workers can only see their own time cards
CREATE POLICY "Workers see own cards"
ON time_cards FOR SELECT
USING (auth.uid() = worker_id);

-- Managers can see all time cards
CREATE POLICY "Managers see all cards"
ON time_cards FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workers
    WHERE id = auth.uid()
    AND role IN ('manager', 'admin')
  )
);

-- Only managers can approve/edit
CREATE POLICY "Managers can update"
ON time_cards FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM workers
    WHERE id = auth.uid()
    AND role IN ('manager', 'admin')
  )
);
```

**Current (Phase 2):** No RLS enabled - development only

---

## Backup and Recovery

**Supabase automatic backups:**
- Daily backups (free tier: 7 days retention)
- Point-in-time recovery (paid plans)

**Manual backup:**
```bash
# Export schema
pg_dump -h db.xxx.supabase.co -U postgres -d postgres --schema-only > schema.sql

# Export data
pg_dump -h db.xxx.supabase.co -U postgres -d postgres --data-only > data.sql
```

**Restore:**
```bash
psql -h db.xxx.supabase.co -U postgres -d postgres < schema.sql
psql -h db.xxx.supabase.co -U postgres -d postgres < data.sql
```

---

## Performance Considerations

**Current scale:** Optimized for small teams (5-50 workers)

**Indexes cover common queries:**
- Worker lookups: `idx_time_cards_worker_id`
- Date range queries: `idx_time_cards_date`, `idx_time_cards_created_at`
- Status filtering: `idx_time_cards_status`

**At scale (500+ workers):**
- Add composite index: `(worker_id, date)` for worker history
- Add composite index: `(status, created_at)` for pending queue
- Partition `time_cards` by month
- Archive old records (6+ months) to separate table

---

## Related Documentation

- [Database README](../backend/src/db/README.md) - Setup guide
- [Migration SQL](../backend/src/db/migrations/001_initial_schema.sql) - Schema DDL
- [Seed Script](../backend/src/db/seed.js) - Test data
- [Phase 3 Plan](phase3-plan.md) - Future enhancements
