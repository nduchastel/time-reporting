# Construction Time Tracking System - Design Specification

**Date:** 2026-05-23  
**Status:** Approved  
**Target Users:** Construction workers (field) and managers (office)

## Executive Summary

A mobile-first Progressive Web App (PWA) that allows construction workers to record time entries via voice, with AI-powered transcription and data extraction. Managers review entries through a dashboard with anomaly detection, flexible rule configuration, and comprehensive audit logging.

**Key Innovation:** Workers speak naturally ("I worked 3 hours at Simons Property") instead of filling forms. The system transcribes, extracts structured data, and flags anomalies for manager review.

## Core Requirements

### Worker Experience
- Voice-based time entry with natural language support
- Support for 4 action types: Check IN, Check OUT, Hours worked, Time OFF
- Multi-language support: English, French, Spanish (USA/Canada)
- Works on iOS and Android via PWA (no app store required)
- Shows live transcription and extracted data before submission
- Handles complex scenarios: backdated entries, multi-worker mentions, partial day corrections

### Manager Experience
- Dashboard with two views: Incoming Timeline (chronological) and Worker Analysis (per-worker)
- Review Cards system for anomaly detection and approval workflow
- Hierarchical threshold configuration: Global → Seasonal → Per-Worksite → Per-Worker
- Worksite reporting for job costing and client billing
- Comprehensive audit logging with flexible entity tagging
- Worker and worksite management with temporal controls (disable for date range)

### Technical Requirements
- Progressive Web App (installable, works offline with sync)
- OpenAI Whisper API for transcription ($0.006/minute)
- GPT-4o-mini for structured data extraction
- Server-side processing (privacy, accuracy, cost control)
- Database: Supabase (PostgreSQL) or SQLite
- Free hosting: Vercel, Railway, Render, or local with ngrok
- Estimated trial cost: ~$0.70 for 30 days with 5 workers

## System Architecture

### High-Level Flow

```
Worker records voice → 
Upload to server → 
Whisper transcription (with context from voice samples) → 
GPT extraction → 
Time Card creation → 
Anomaly detection → 
Review Card generation (if rules violated) → 
Manager review & approval → 
Audit log
```

### Components

1. **Worker Mobile UI (PWA)**
   - 4 swipeable screens with distinct colors: IN (Teal), OUT (Green), HOURS (Blue), OFF (Orange)
   - Large text for field readability (17px transcription, 16px extracted data)
   - Voice recording with live transcription preview
   - Extracted data shown before submission
   - Network status indicator
   - Offline queue with sync

2. **Worker Onboarding**
   - Directive voice sample recording (workers read exact phrases)
   - Sample 1: Auto-filled with worker name ("My name is [Full Name]")
   - Samples 2-5: Manager-configured phrases (site names, common activities)
   - Provides ground truth for Whisper API context
   - Multi-language configuration (EN/FR/ES)

3. **Manager Dashboard - Incoming Timeline**
   - Chronological view of all incoming time entries
   - Split view: Time Cards (green) and Review Cards (red/yellow/blue)
   - Filters: Date range, worker, worksite, status
   - Actions: Approve, Edit, Flag for review, Bulk approve

4. **Manager Dashboard - Worker Analysis**
   - Per-worker tabs showing all entries
   - Weekly/monthly totals
   - Pattern indicators: hours trend, sites visited, time OFF taken
   - Drill-down to individual Time Cards
   - Quick add entry (manager creates on behalf of worker)

5. **Review Cards Queue**
   - Auto-generated when anomaly detection rules trigger
   - Severity levels: Critical (red), Warning (yellow), Informational (blue)
   - Override justification dialog: Required reason field, accountability warning
   - Actions: Approve with reason, Edit Time Card, Dismiss, View details
   - Linked to related Time Cards via references

6. **Configuration UI - Hierarchical Thresholds**
   - Global defaults (required): Max hours/day, max hours/week, max consecutive days, etc.
   - Optional overrides:
     - Seasonal (date range): Winter snow removal rules, summer construction rules
     - Per-Worksite: Emergency sites allow 24hr shifts
     - Per-Worker: Bob's custom 70hr/week limit
   - Rule inheritance: More specific overrides take precedence
   - Extensible: "Check Time-Card against N possible rules"

7. **Worker/Worksite Management**
   - Edit worker profile: Name, language, custom rules
   - Temporal disable: Date range (auto re-enable) or indefinite
   - Worksite editing: Name, address, client info, custom rules
   - All changes generate audit log events

8. **Worksite Report View**
   - Multiple views: By Worksite (default), By Worker, By Date
   - Daily breakdown tables with totals
   - Visual bar charts showing worker distribution
   - Export: CSV (payroll), PDF (billing)
   - Use cases: Client billing, payroll processing, job costing, resource planning

9. **Audit Logging System**
   - Flexible many-to-many entity tagging
   - Each log event can tag unlimited entities: worker, manager, worksite, time-card, review-card, rule, config
   - JSON structure with actor, action, details, tags array
   - Queryable by any tag type or combination
   - All manager actions logged: Create, edit, delete, approve, override, config changes

## Data Models

### Time Card
```javascript
{
  id: "tc-12345",
  worker_id: "bob-martinez",
  worksite_id: "simons-property",
  action_type: "HOURS", // IN, OUT, HOURS, OFF
  date: "2026-05-22",
  hours: 8,
  start_time: "07:30",  // optional (for IN/OUT)
  end_time: "15:30",    // optional (for OUT)
  transcription: "I worked 8 hours at Simons today",
  audio_url: "s3://bucket/audio-12345.webm",
  extracted_data: {
    worker: "Bob Martinez",
    worksite: "Simons Property",
    hours: 8,
    confidence: "high"
  },
  status: "pending", // pending, approved, edited, flagged
  created_at: "2026-05-22T15:45:23Z",
  approved_by: "mgr-sarah-chen",
  approved_at: "2026-05-22T16:30:00Z",
  notes: "Approved - looks good"
}
```

### Review Card
```javascript
{
  id: "rc-67890",
  time_card_ids: ["tc-12345"],
  worker_id: "bob-martinez",
  worksite_id: "simons-property",
  rule_violated: "max_hours_day",
  severity: "critical", // critical, warning, informational
  details: {
    threshold: 16,
    actual: 15,
    rule_source: "global_default", // or seasonal/worksite/worker
    message: "Bob Martinez reported 15 hours on May 22 (exceeds 16hr limit by 1hr)"
  },
  status: "pending", // pending, approved_with_override, dismissed, edited
  created_at: "2026-05-22T15:45:25Z",
  resolved_by: "mgr-sarah-chen",
  resolved_at: "2026-05-22T16:35:00Z",
  justification: "Emergency water main break - pre-approved overtime"
}
```

### Audit Log Event
```javascript
{
  event_id: "log-98765",
  timestamp: "2026-05-22T16:35:00Z",
  actor: {
    type: "manager",
    id: "mgr-sarah-chen"
  },
  action: "override_validation_rule",
  details: {
    rule_violated: "max_hours_day",
    threshold: 16,
    actual_value: 15,
    override_reason: "Emergency water main break - pre-approved overtime"
  },
  tags: [
    { type: "worker", id: "bob-martinez" },
    { type: "worksite", id: "simons-property" },
    { type: "time-card", id: "tc-12345" },
    { type: "review-card", id: "rc-67890" },
    { type: "rule", id: "rule-max-hours-day" }
  ]
}
```

### Worker Profile
```javascript
{
  id: "bob-martinez",
  name: "Bob Martinez",
  email: "bob@construction-co.com",
  phone: "+1-555-0123",
  language: "en", // en, fr, es
  voice_samples: [
    {
      audio_url: "s3://bucket/sample1-bob.webm",
      text: "My name is Bob Martinez",
      recorded_at: "2026-05-01T10:00:00Z"
    },
    {
      audio_url: "s3://bucket/sample2-bob.webm",
      text: "Simons Property on Main Street",
      recorded_at: "2026-05-01T10:01:00Z"
    },
    {
      audio_url: "s3://bucket/sample3-bob.webm",
      text: "I worked on road repair and snow removal",
      recorded_at: "2026-05-01T10:02:00Z"
    }
  ],
  custom_rules: {
    max_hours_week: 70, // overrides global 60
    max_consecutive_days: 14 // overrides global 12
  },
  status: "active", // active, disabled
  disabled_range: null, // { start: "2026-06-01", end: "2026-06-15" }
  created_at: "2026-05-01T09:00:00Z"
}
```

### Worksite
```javascript
{
  id: "simons-property",
  name: "Simons Property",
  address: "123 Main Street, Springfield",
  client: "Simons Corporation",
  custom_rules: {
    max_hours_day: 18 // Emergency site allows longer shifts
  },
  status: "active", // active, disabled
  disabled_range: null,
  created_at: "2026-04-15T12:00:00Z"
}
```

### Threshold Configuration
```javascript
{
  global_defaults: {
    max_hours_day: 16,
    max_hours_week: 60,
    max_consecutive_days: 12,
    min_hours_day: 0.5,
    unusual_pattern_deviation: 0.5 // 50% above recent average
  },
  seasonal_overrides: [
    {
      id: "winter-snow-removal",
      date_range: { start: "12-01", end: "03-31" }, // MM-DD format
      overrides: {
        max_hours_day: 20,
        max_hours_week: 80
      }
    }
  ],
  worksite_overrides: {
    "simons-property": {
      max_hours_day: 18
    }
  },
  worker_overrides: {
    "bob-martinez": {
      max_hours_week: 70,
      max_consecutive_days: 14
    }
  }
}
```

## AI Processing Pipeline

### Voice Transcription with Context
```javascript
// When Bob records: "I worked 8 hours at Simons today"

// 1. Retrieve Bob's voice sample texts from database
const context = [
  "Bob Martinez",
  "Simons Property on Main Street",
  "road repair and snow removal"
].join(", ");

// 2. Send to Whisper API
const transcription = await openai.audio.transcriptions.create({
  file: audioBlob,
  model: "whisper-1",
  language: "en", // from worker profile
  prompt: context // Vocabulary hint for better accuracy
});
// Result: "I worked 8 hours at Simons today"
```

### Data Extraction with GPT
```javascript
// 3. Extract structured data
const extraction = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "system",
      content: `Extract time entry data from transcription. Return JSON:
{
  "action_type": "IN|OUT|HOURS|OFF",
  "worker": "full name or null",
  "worksite": "site name or null",
  "hours": number or null,
  "start_time": "HH:MM or null",
  "end_time": "HH:MM or null",
  "date": "YYYY-MM-DD or null (defaults to today)",
  "confidence": "high|medium|low",
  "additional_workers": ["name1", "name2"] or []
}`
    },
    {
      role: "user",
      content: `Transcription: "${transcription}"
Worker name: "Bob Martinez"
Today's date: "2026-05-22"`
    }
  ],
  response_format: { type: "json_object" }
});

// Result:
{
  action_type: "HOURS",
  worker: "Bob Martinez",
  worksite: "Simons",
  hours: 8,
  start_time: null,
  end_time: null,
  date: "2026-05-22",
  confidence: "high",
  additional_workers: []
}
```

### Anomaly Detection
```javascript
// 4. Check Time Card against rules (after extraction)
const anomalies = [];

// Get applicable thresholds (most specific wins)
const thresholds = getApplicableThresholds(
  workerId: "bob-martinez",
  worksiteId: "simons-property",
  date: "2026-05-22"
);

// Check max hours/day
if (timeCard.hours > thresholds.max_hours_day) {
  anomalies.push({
    rule: "max_hours_day",
    severity: "critical",
    message: `${timeCard.hours} hours exceeds limit of ${thresholds.max_hours_day}`
  });
}

// Check unusual pattern
const recentAverage = getWorkerRecentAverage(workerId, weeks: 4);
const deviation = (timeCard.hours - recentAverage) / recentAverage;
if (deviation > thresholds.unusual_pattern_deviation) {
  anomalies.push({
    rule: "unusual_pattern",
    severity: "informational",
    message: `${Math.round(deviation * 100)}% above recent average`
  });
}

// 5. Create Review Cards for each anomaly
for (const anomaly of anomalies) {
  await createReviewCard({
    time_card_id: timeCard.id,
    worker_id: timeCard.worker_id,
    worksite_id: timeCard.worksite_id,
    rule_violated: anomaly.rule,
    severity: anomaly.severity,
    details: { ...anomaly, threshold: thresholds[anomaly.rule] }
  });
}
```

## User Workflows

### Worker: Record Time Entry
1. Open PWA on phone
2. Swipe to desired action screen (IN/OUT/HOURS/OFF)
3. Tap large record button
4. Speak naturally: "I worked 8 hours at Simons today"
5. See live transcription appear
6. Review extracted data (worker, site, hours, date)
7. Tap "Submit" or "Re-record" if incorrect
8. Confirmation message shown

### Worker: Onboarding
1. Manager creates worker account
2. Worker receives login link via SMS
3. Open PWA, see welcome screen
4. Select language (EN/FR/ES)
5. Record voice samples:
   - Sample 1: Auto-prompt "My name is Bob Martinez"
   - Sample 2: Read "Simons Property on Main Street"
   - Sample 3: Read "I worked on road repair and snow removal"
6. Optional: Record 2 more samples (manager-configured)
7. Complete setup, go to main screen

### Manager: Review Incoming Time
1. Open manager dashboard
2. See Incoming Timeline view (default)
3. Time Cards (green) and Review Cards (red/yellow/blue) in chronological order
4. Filter by date range, worker, worksite, or status
5. For normal Time Card: Click "✓ Approve" → done
6. For Time Card with Review Card: Click Review Card → see rule violation details → click "Approve with Override" → justification dialog → enter reason → submit → logged

### Manager: Configure Rules
1. Go to Configuration → Thresholds
2. See Global Defaults (required, pre-filled)
3. Optionally add:
   - Seasonal Override: "Winter Snow Removal" (Dec 1 - Mar 31) → Max 20 hrs/day
   - Per-Worksite Rule: "Simons Property" → Max 18 hrs/day
   - Per-Worker Rule: "Bob Martinez" → Max 70 hrs/week
4. Save configuration
5. All workers immediately subject to new rules

### Manager: Generate Worksite Report
1. Go to Reports → Worksite Report
2. Select view: "By Worksite" (default)
3. Set date range: "May 1 - May 31, 2026"
4. Optionally filter: Specific worksite or worker
5. See summary: Total hours, active workers, active sites
6. Review breakdown table: Each worksite with daily hours per worker
7. Export: CSV (for payroll) or PDF (for client billing)

## Error Handling & Edge Cases

### Low Confidence Extraction
- If GPT confidence is "low", auto-create Review Card for manager verification
- Show transcription and extracted data side-by-side for comparison
- Manager can edit fields before approval

### Multi-Worker Mentions
- Example: "Bob and I did 4 hours at Hyatt"
- AI extracts: `additional_workers: ["Bob Martinez"]`
- System creates Review Card: "Multiple workers detected - needs splitting"
- Manager creates separate Time Cards for each worker

### Backdated Entries
- Example: "Yesterday I worked 10 hours at Simons"
- AI extracts: `date: "2026-05-21"` (one day before recording date)
- Time Card includes both `date` (work date) and `created_at` (recording date)
- No special handling needed - manager sees both dates in review

### Incomplete Day Detection
- If worker has IN but no OUT by end of day, create Review Card
- "Incomplete day detected - Bob checked IN at 7:30 AM but no OUT recorded"
- Next app launch shows prompt: "You have incomplete entries - complete now?"

### Offline Recording
- Worker records voice while offline
- Audio + metadata queued locally in IndexedDB
- When network restored, auto-sync queued entries
- Network status indicator shows "Syncing..." during upload

### Worksite Name Variations
- Worker says "Simons" but database has "Simons Property"
- AI extraction uses fuzzy matching
- If confidence medium/low, flag for manager to confirm site mapping
- Manager can create alias: "Simons" → "Simons Property"

## Security & Privacy

### Data Access Control
- **Workers:** Can only see their own time entries and profile
- **Managers:** Can see all workers under their supervision
- **Admins:** Can see everything, configure global defaults

### Audio Storage
- Voice recordings stored encrypted in cloud storage (S3/GCS)
- Retention policy: 90 days, then auto-delete (configurable)
- Only manager and worker can access original audio
- Transcriptions stored indefinitely for audit trail

### Authentication
- Worker login: SMS magic link or simple PIN (4-6 digits)
- Manager login: Email + password + optional 2FA
- Sessions expire after 7 days (workers) or 24 hours (managers)

### Audit Trail Immutability
- Log events are append-only (no edits/deletes)
- Soft delete: Mark event as `deleted: true` with reason and timestamp
- Original event still visible in audit trail with deletion marker

## Technology Stack

### Frontend (Worker PWA)
- **Framework:** React or Vue.js
- **PWA:** Service Worker for offline, Web App Manifest for install
- **Audio:** MediaRecorder API (WebM/Opus format)
- **Storage:** IndexedDB for offline queue
- **UI:** Tailwind CSS or similar for mobile-first design

### Frontend (Manager Dashboard)
- **Framework:** React or Vue.js
- **Charts:** Chart.js or Recharts for visualizations
- **Export:** jsPDF for PDF generation, CSV.js for CSV export
- **State:** Zustand or Redux for complex state management

### Backend
- **Runtime:** Node.js with Express or Fastify
- **API:** RESTful JSON endpoints
- **Authentication:** JWT tokens, bcrypt for passwords
- **File Upload:** Multipart form handling, streaming to cloud storage

### Database
- **Option A (Recommended):** Supabase (managed PostgreSQL)
  - Built-in auth, real-time subscriptions, automatic backups
  - Free tier: 500MB storage, 2GB transfer/month
- **Option B:** SQLite with Litestream for backups
  - Simpler, single-file database
  - Good for < 100 workers

### AI Services
- **Transcription:** OpenAI Whisper API
  - Cost: $0.006 per minute of audio
  - Supports 50+ languages
  - Context prompt for improved accuracy
- **Extraction:** OpenAI GPT-4o-mini
  - Cost: $0.15 per 1M input tokens, $0.60 per 1M output tokens
  - JSON mode for structured output

### Hosting
- **Option A (Recommended):** Vercel
  - Free tier: Unlimited bandwidth, 100GB/month
  - Automatic HTTPS, CDN, serverless functions
- **Option B:** Railway or Render
  - Free tier with persistent storage
  - PostgreSQL database included
- **Option C:** Local with ngrok
  - For testing or small teams
  - ngrok provides public HTTPS URL

## Cost Estimate (30-day trial)

**Assumptions:**
- 5 workers
- 2 entries per day per worker
- 20 working days per month
- 30 seconds average audio length per entry

**Calculations:**
- Total entries: 5 workers × 2 entries × 20 days = 200 entries
- Total audio: 200 entries × 30 seconds = 6,000 seconds = 100 minutes
- Whisper cost: 100 minutes × $0.006 = $0.60
- GPT cost: 200 extractions × ~500 tokens avg × $0.0000015 = $0.15
- **Total: ~$0.75 per month**

Hosting, database, and storage are free on all recommended platforms' free tiers.

## Implementation Phases

### Phase 1: Core MVP (Week 1-2)
- Worker PWA with single action type (HOURS)
- Voice recording + upload
- Whisper transcription
- GPT extraction
- Basic Time Card storage
- Manager dashboard: Simple list view with approve/reject

### Phase 2: Full Worker Experience (Week 3)
- All 4 action types (IN/OUT/HOURS/OFF)
- Worker onboarding with voice samples
- Context-aware transcription using voice samples
- Offline queue with sync
- Multi-language UI (EN/FR/ES)

### Phase 3: Manager Features (Week 4)
- Incoming Timeline and Worker Analysis views
- Edit Time Card functionality
- Basic threshold configuration (global only)
- Audit logging (simple version)

### Phase 4: Advanced Rules (Week 5)
- Anomaly detection engine
- Review Cards system
- Hierarchical thresholds (seasonal/worksite/worker)
- Override justification workflow

### Phase 5: Reporting & Management (Week 6)
- Worksite Report View with exports
- Worker/Worksite management screens
- Temporal controls (disable date ranges)
- Full audit log with entity tagging

### Phase 6: Polish & Deploy (Week 7)
- Security hardening
- Performance optimization
- User testing and bug fixes
- Production deployment

## Future Enhancements

### Near-term (3-6 months)
- **GPS verification:** Optional location check to verify worker is at claimed worksite
- **Photo attachments:** Workers can attach site photos to time entries
- **Team entries:** "Our crew of 5 worked 8 hours at Simons" → auto-create entries for all crew members
- **Biometric verification:** Face ID or fingerprint for time entry submission
- **Reminders:** Push notifications for incomplete days or missing check-out

### Long-term (6+ months)
- **AssemblyAI integration:** Persistent speaker profiles for even better accuracy
- **OpenAI fine-tuning:** Custom model trained on company-specific vocabulary
- **Mobile native apps:** iOS/Android native versions if PWA limitations discovered
- **Payroll integration:** Direct export to QuickBooks, ADP, Paychex
- **Client portal:** Clients log in to view hours billed to their sites
- **Advanced analytics:** Predictive models for project completion, resource allocation

## Success Metrics

### Worker Adoption
- **Target:** 90% of workers using app within 2 weeks of launch
- **Metric:** Active users / total workers
- **Tracking:** Daily login count, entries per worker per week

### Data Quality
- **Target:** < 5% of entries requiring manual correction
- **Metric:** Edit rate = (edited entries / total entries)
- **Tracking:** Track before-after changes in Time Card edits

### Manager Efficiency
- **Target:** < 2 minutes average time to review and approve entry
- **Metric:** Time from entry creation to approval
- **Tracking:** `approved_at - created_at` for all Time Cards

### Cost per Worker
- **Target:** < $2 per worker per month (AI costs only)
- **Metric:** (Total Whisper + GPT costs) / active workers
- **Tracking:** Monthly invoice from OpenAI

### Anomaly Detection Accuracy
- **Target:** > 95% of flagged Review Cards are legitimate issues
- **Metric:** False positive rate = dismissed Review Cards / total Review Cards
- **Tracking:** Manager actions on Review Cards (approve vs dismiss)

## Open Questions (Resolved)

All major design questions have been resolved:
- ✅ Voice sample approach: Directive (workers read exact phrases)
- ✅ Text size in worker UI: Large fonts for field readability
- ✅ Action type colors: Distinct colors for each type (Teal, Green, Blue, Orange)
- ✅ Override workflow: Justification dialog with accountability warning
- ✅ Logging system: Flexible many-to-many entity tagging
- ✅ Multi-language: Whisper language hint + UI translation
- ✅ Hosting: Free tier options identified (Vercel/Railway/Render)
- ✅ Hierarchical rules: Inheritance model with optional overrides

## Conclusion

This design provides a complete, implementable specification for a voice-based construction time tracking system. The architecture balances simplicity (PWA, free hosting, minimal dependencies) with power (AI transcription, anomaly detection, comprehensive audit logging).

The system is designed to be:
- **Worker-friendly:** Voice input is faster and easier than forms on a construction site
- **Manager-efficient:** Anomaly detection surfaces only the entries that need attention
- **Audit-compliant:** Every action is logged with full context for accountability
- **Cost-effective:** < $2/worker/month in AI costs, free hosting/database/storage
- **Extensible:** Modular architecture allows adding features (GPS, photos, integrations) without refactoring

Next steps: Create detailed implementation plan and begin Phase 1 development.
