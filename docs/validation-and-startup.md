# Validation & Startup Guide

**Purpose:** Post-deployment validation, initial setup, and first-time user instructions

---

## 📋 Table of Contents

1. [Post-Deployment Validation](#post-deployment-validation)
2. [Initial System Setup](#initial-system-setup)
3. [Manager Startup Instructions](#manager-startup-instructions)
4. [Worker Installation Instructions](#worker-installation-instructions)
5. [Testing Scenarios](#testing-scenarios)
6. [Troubleshooting](#troubleshooting)

---

## 🔍 Post-Deployment Validation

**Goal:** Verify all services are running correctly after deployment

### Step 1: Verify Backend Health (Railway)

```bash
# Test health endpoint
curl https://time-reporting-backend.railway.app/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-05-23T22:30:00.000Z"
}
```

**✅ Success:** Status 200, JSON response with timestamp  
**❌ Failure:** Connection refused, 500 error, or no response → Check Railway logs

---

### Step 2: Verify Database Connection (Supabase)

```bash
# Test database by getting time cards
curl https://time-reporting-backend.railway.app/api/time-cards

# Expected response:
[]
# (Empty array is OK - no time cards created yet)
```

**✅ Success:** Status 200, returns array (empty or with data)  
**❌ Failure:** 500 error with "Supabase" in message → Check SUPABASE_URL and SUPABASE_ANON_KEY in Railway

---

### Step 3: Verify Frontend Loads (Vercel)

1. **Desktop Test:**
   - Open: https://time-reporting.vercel.app
   - Should see: Header with 4 dots, colored action screen, record button
   - Check browser console: No errors

2. **Mobile Test (iOS):**
   - Open Safari
   - Navigate to: https://time-reporting.vercel.app
   - Should see: Same UI, properly scaled for mobile
   - Tap dots to switch between screens

3. **Mobile Test (Android):**
   - Open Chrome
   - Navigate to: https://time-reporting.vercel.app
   - Should see: Same UI, properly scaled for mobile
   - Tap dots to switch between screens

**✅ Success:** All screens load, no console errors, mobile responsive  
**❌ Failure:** Blank page, console errors → Check Vercel logs and VITE_API_URL

---

### Step 4: Verify Database Schema (Supabase Dashboard)

1. Go to Supabase Dashboard → Table Editor
2. Verify 3 tables exist:

**workers:**
- Columns: id, name, email, phone, language, status, disabled_range, custom_rules, created_at, updated_at
- Test data: 1 row (Bob Martinez)

**worksites:**
- Columns: id, name, address, client, status, disabled_range, custom_rules, created_at, updated_at
- Test data: 3 rows (Simons Property, ACME Construction, Hyatt Hotel)

**time_cards:**
- Columns: id, worker_id, worksite_id, action_type, date, hours, start_time, end_time, transcription, audio_url, extracted_data, confidence, status, notes, approved_by, approved_at, created_at, updated_at
- Test data: 0 rows (empty is OK)

**✅ Success:** All tables exist with correct columns, test data present  
**❌ Failure:** Missing tables → Re-run migration SQL

---

### Step 5: Test API Endpoint (Create Time Card)

**Note:** This test uses the mock transcription approach (no real audio yet - Phase 2)

```bash
# Get Bob Martinez's worker ID from Supabase
# (Go to Table Editor → workers → copy Bob's id)

# Create a test time card
curl -X POST https://time-reporting-backend.railway.app/api/time-cards \
  -H "Content-Type: application/json" \
  -d '{
    "workerId": "YOUR_BOB_ID_HERE",
    "transcription": "I worked 8 hours at Simons Property",
    "audioUrl": "https://test.com/audio.webm"
  }'

# Expected response (200 or 201):
{
  "id": "...",
  "worker_id": "...",
  "worksite_id": "...",
  "action_type": "HOURS",
  "date": "2026-05-23",
  "hours": 8,
  "transcription": "I worked 8 hours at Simons Property",
  "extracted_data": {
    "action_type": "HOURS",
    "hours": 8,
    "worksite": "Simons Property",
    "confidence": "high",
    ...
  },
  "confidence": "high",
  "status": "pending",
  ...
}
```

**✅ Success:** Status 201, returns time card object with extracted data  
**❌ Failure:** 500 error → Check OpenAI API key in Railway environment variables

---

### Step 6: Verify Time Card in Database

1. Go to Supabase Dashboard → Table Editor → time_cards
2. Should see: 1 new row with:
   - action_type: "HOURS"
   - hours: 8
   - transcription: "I worked 8 hours at Simons Property"
   - confidence: "high"
   - status: "pending"

**✅ Success:** Time card appears in database  
**❌ Failure:** No row → Check backend logs in Railway

---

### Validation Checklist

- [ ] Backend health endpoint returns 200
- [ ] Database connection works (GET /api/time-cards returns array)
- [ ] Frontend loads on desktop
- [ ] Frontend loads on iOS Safari
- [ ] Frontend loads on Android Chrome
- [ ] 3 database tables exist with correct schema
- [ ] Test data present (1 worker, 3 worksites)
- [ ] API can create time cards (POST /api/time-cards works)
- [ ] Time cards appear in Supabase database
- [ ] No errors in Railway logs
- [ ] No errors in Vercel logs
- [ ] No console errors in browser

**If all checked: ✅ Deployment validated successfully!**

---

## 🚀 Initial System Setup

**Goal:** Prepare the system for first-time use

### Current State (Phase 1 MVP)

**What's working:**
- ✅ Backend API deployed and tested
- ✅ Frontend PWA deployed and accessible
- ✅ Database created with schema
- ✅ Test data seeded (Bob Martinez + 3 worksites)

**What's NOT yet implemented (Phase 2+):**
- ❌ Real audio recording (currently mock simulation)
- ❌ Whisper transcription integration
- ❌ Manager UI for creating workers
- ❌ Worker authentication/login
- ❌ Manager dashboard for reviewing time cards

### Setup Steps for Initial Use

**Option A: Use Test Data (Quick Start)**
- Use Bob Martinez test account
- Use 3 existing test worksites
- Test the mock recording flow
- **Duration:** 5 minutes

**Option B: Add Real Workers (Manual Setup)**
- Insert real workers into Supabase database
- Add real worksites for your company
- Test with actual worker names
- **Duration:** 15-30 minutes

**We'll cover both options below.**

---

## 👔 Manager Startup Instructions

### Manager Role (Phase 1)

**In Phase 1 MVP, the "manager" is you (the system administrator).**

You'll use:
- **Supabase Dashboard** - To view and manage data
- **Railway Dashboard** - To monitor backend logs
- **Vercel Dashboard** - To monitor frontend access

**Phase 2 will add:** Manager UI, authentication, approval workflows

---

### Option A: Quick Start with Test Data

**Use this to validate the system works before adding real data.**

**Test Worker:**
- Name: Bob Martinez
- Email: bob@test.com
- Phone: +1-555-0123
- Language: en
- Status: active

**Test Worksites:**
- Simons Property (123 Main St, client: Simons Corp)
- ACME Construction (456 Oak Ave, client: ACME Inc)
- Hyatt Hotel (789 5th Ave, client: Hyatt)

**To use test data:**
1. ✅ Already seeded during deployment
2. Give Bob's worker ID to test user
3. Have them access the Vercel URL
4. They can record mock time entries

**Next:** Jump to [Worker Installation Instructions](#worker-installation-instructions)

---

### Option B: Add Real Workers (Manual Database Setup)

**Use this to set up your actual team.**

#### Step 1: Add Workers to Database

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Select your `time-reporting` project
   - Go to Table Editor → `workers`

2. **Click "Insert row"**

3. **Fill in worker details:**
   ```
   name: John Smith
   email: john.smith@example.com
   phone: +1-555-0001
   language: en (or fr, es)
   status: active
   disabled_range: (leave empty)
   custom_rules: {} (leave as empty JSON object)
   ```

4. **Click "Save"**

5. **Copy the worker's UUID:**
   - After saving, you'll see a new row with an auto-generated `id`
   - Copy this UUID (e.g., `550e8400-e29b-41d4-a716-446655440000`)
   - **Give this to the worker** - they'll need it to use the app (temporarily, until Phase 2 auth)

6. **Repeat for each worker on your team**

**Example workers to add:**
```
Worker 1: John Smith, +1-555-0001, en
Worker 2: Marie Dubois, +1-555-0002, fr
Worker 3: Carlos Rodriguez, +1-555-0003, es
Worker 4: Sarah Johnson, +1-555-0004, en
Worker 5: David Chen, +1-555-0005, en
```

---

#### Step 2: Add Worksites to Database

1. **Go to Table Editor → `worksites`**

2. **Click "Insert row"**

3. **Fill in worksite details:**
   ```
   name: Downtown Office Renovation
   address: 100 Business St, Toronto ON
   client: ABC Corporation
   status: active
   disabled_range: (leave empty)
   custom_rules: {} (leave as empty JSON object)
   ```

4. **Click "Save"**

5. **Repeat for each active worksite**

**Example worksites to add:**
```
Worksite 1: Downtown Office Renovation (100 Business St, client: ABC Corp)
Worksite 2: Highway 401 Expansion (KM 245 Highway 401, client: Ontario MTO)
Worksite 3: Waterfront Condo Tower (50 Harbour Square, client: Waterfront Dev Inc)
Worksite 4: Airport Terminal C (Pearson Airport, client: GTAA)
Worksite 5: Mall Food Court Remodel (Yorkdale Mall, client: Oxford Properties)
```

---

#### Step 3: Share Access with Workers

**For each worker, provide:**

1. **PWA URL:**
   ```
   https://time-reporting.vercel.app
   ```

2. **Their Worker ID (UUID):**
   ```
   Example: 550e8400-e29b-41d4-a716-446655440000
   ```

3. **Instructions:**
   - "Open this URL on your phone"
   - "Bookmark or install to home screen"
   - "Your worker ID is: [UUID]"
   - (Phase 2: They'll log in with email/password instead)

**Send via:**
- Text message
- Email
- Slack/Teams message
- Printed card (for workers without company email)

---

### Manager Monitoring Tasks

**Daily:**
1. **Check Supabase → `time_cards` table**
   - View all submitted time entries
   - Look for `status = 'pending'`
   - Review transcriptions and extracted data

2. **Verify data quality:**
   - Check `confidence` field (high/medium/low)
   - Review `extracted_data` JSON
   - Look for missing worksite_id (couldn't match worksite)

**Weekly:**
1. **Railway Dashboard → Logs**
   - Check for errors or warnings
   - Monitor API response times

2. **OpenAI Usage Dashboard**
   - https://platform.openai.com/usage
   - Verify costs are as expected (~$0.15-0.31/month)

**Monthly:**
1. **Review billing:**
   - Railway: $5/month
   - OpenAI: Check actual usage
   - Supabase: Verify under 500MB storage

---

## 📱 Worker Installation Instructions

**Goal:** Get the PWA installed on worker's phone and record first time entry

### For iOS (iPhone/iPad) Users

#### Step 1: Open the App

1. Open **Safari** browser (not Chrome!)
2. Navigate to: **https://time-reporting.vercel.app**
3. You should see:
   - 4 colored dots at the top
   - Large colored header (teal by default)
   - Record button in the middle

#### Step 2: Install to Home Screen

1. Tap the **Share** button (square with arrow up)
2. Scroll down and tap **"Add to Home Screen"**
3. Name it: **"Time Reporting"**
4. Tap **"Add"**
5. The app icon appears on your home screen

#### Step 3: Test the App

1. Tap the **Time Reporting** icon on home screen
2. App opens in full-screen (looks like a native app!)
3. Swipe between screens by tapping the 4 dots
4. Try the record button (currently shows mock data)

**✅ Success:** App installed, looks native, all screens work

---

### For Android Users

#### Step 1: Open the App

1. Open **Chrome** browser
2. Navigate to: **https://time-reporting.vercel.app**
3. You should see:
   - 4 colored dots at the top
   - Large colored header (teal by default)
   - Record button in the middle

#### Step 2: Install to Home Screen

1. Tap the **3-dot menu** (⋮) in top-right
2. Tap **"Add to Home screen"** or **"Install app"**
3. Name it: **"Time Reporting"**
4. Tap **"Add"**
5. The app icon appears on your home screen

#### Step 3: Test the App

1. Tap the **Time Reporting** icon on home screen
2. App opens in full-screen (looks like a native app!)
3. Swipe between screens by tapping the 4 dots
4. Try the record button (currently shows mock data)

**✅ Success:** App installed, looks native, all screens work

---

### Understanding the 4 Action Screens

**Tap the dots to switch between screens:**

1. **📍 Check IN (Teal)** - "I just arrived at [worksite]"
2. **🏠 Check OUT (Green)** - "Leaving [worksite] now"
3. **⏱️ Hours Worked (Blue)** - "I worked 8 hours at [worksite]"
4. **🌴 Time OFF (Orange)** - "I'm taking tomorrow off"

**Each screen has:**
- Large emoji and title
- Example phrase
- Record button
- Space for transcription and extracted data

---

### Recording Your First Time Entry (Mock - Phase 1)

**Note:** Phase 1 uses mock recording. Phase 2 will add real audio recording.

#### Step 1: Choose Action Type

Tap the dots to select the right screen:
- Arriving at site? → **Check IN** (teal)
- Leaving site? → **Check OUT** (green)
- Reporting hours? → **Hours Worked** (blue)
- Taking time off? → **Time OFF** (orange)

#### Step 2: Record (Mock)

1. Tap the large **record button** (blue circle)
2. Button turns red (recording)
3. Speak your entry: *"I worked 8 hours at Simons Property"*
4. Tap button again to stop
5. Wait for "Processing..."

**Phase 1 Mock Behavior:**
- Shows example transcription after 1 second
- Shows mock extracted data
- Does NOT save to database yet (Phase 2)

#### Step 3: Review Extracted Data

You'll see:
```
Transcription:
"I worked 8 hours at Simons Property"

Extracted Data:
Action: HOURS
Hours: 8
Worksite: Simons Property
Confidence: high
```

#### Step 4: Submit (Phase 2)

**Phase 1:** Submit button is there but not connected yet  
**Phase 2:** Will send to backend and save to database

---

## 🧪 Testing Scenarios

**Goal:** Validate different types of time entries work correctly

### Test Scenario 1: Simple Hours Entry

**Action:** Hours Worked screen  
**Say:** "I worked 8 hours at Simons Property"

**Expected Results:**
- Transcription appears
- Extracted data shows:
  - action_type: HOURS
  - hours: 8
  - worksite: "Simons Property"
  - confidence: high

---

### Test Scenario 2: Check In

**Action:** Check IN screen  
**Say:** "I just arrived at ACME Construction"

**Expected Results:**
- Transcription appears
- Extracted data shows:
  - action_type: IN
  - worksite: "ACME Construction"
  - confidence: high

---

### Test Scenario 3: Check Out

**Action:** Check OUT screen  
**Say:** "Leaving Hyatt now"

**Expected Results:**
- Transcription appears
- Extracted data shows:
  - action_type: OUT
  - worksite: "Hyatt"
  - confidence: high

---

### Test Scenario 4: Time Off

**Action:** Time OFF screen  
**Say:** "I'm taking tomorrow off"

**Expected Results:**
- Transcription appears
- Extracted data shows:
  - action_type: OFF
  - confidence: high

---

### Test Scenario 5: Complex Entry with Times

**Action:** Hours Worked screen  
**Say:** "I arrived at 7:30 AM and left at 3:30 PM at Simons"

**Expected Results:**
- Transcription appears
- Extracted data shows:
  - action_type: HOURS
  - start_time: "07:30"
  - end_time: "15:30"
  - hours: 8
  - worksite: "Simons"
  - confidence: high

---

### Test Scenario 6: Backdated Entry

**Action:** Hours Worked screen  
**Say:** "Yesterday I worked 10 hours at Johnston site"

**Expected Results:**
- Transcription appears
- Extracted data shows:
  - action_type: HOURS
  - hours: 10
  - worksite: "Johnston site"
  - date: (yesterday's date)
  - confidence: high

---

### Test Scenario 7: Low Confidence Entry

**Action:** Hours Worked screen  
**Say:** "I worked uh maybe like 8 or 9 hours at Simons"

**Expected Results:**
- Transcription appears
- Extracted data shows:
  - action_type: HOURS
  - hours: null (ambiguous)
  - worksite: "Simons"
  - confidence: **low**

**Manager Action:** Review this entry manually (Phase 2)

---

### Phase 2 Testing (After Real Audio Integration)

Once Whisper API is integrated, test:

1. **Different accents** - Canadian, French-Canadian, Spanish
2. **Background noise** - Construction site noise, wind
3. **Multiple workers** - "Bob and I worked 4 hours"
4. **Incorrect worksites** - System should fuzzy-match or flag
5. **Long descriptions** - Rambling entries
6. **Quiet speech** - Low volume recording

---

## 🔧 Troubleshooting

### Issue: Frontend won't load

**Symptoms:** Blank page, "Cannot connect" error

**Solutions:**
1. Check Vercel deployment status
2. Verify URL is correct: `https://time-reporting.vercel.app`
3. Clear browser cache (Ctrl+Shift+Delete)
4. Try incognito/private mode
5. Check Vercel logs for errors

---

### Issue: Backend returns 500 error

**Symptoms:** API calls fail, time cards not created

**Solutions:**
1. Check Railway logs for errors
2. Verify environment variables:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - OPENAI_API_KEY
3. Test health endpoint: `/health`
4. Restart Railway service

---

### Issue: Database connection fails

**Symptoms:** "Supabase connection error" in logs

**Solutions:**
1. Verify Supabase credentials in Railway
2. Check Supabase project is not paused (free tier)
3. Test connection from Railway logs
4. Verify tables exist in Supabase dashboard

---

### Issue: OpenAI API errors

**Symptoms:** "Failed to extract data" errors

**Solutions:**
1. Verify OpenAI API key is valid
2. Check OpenAI billing account has funds
3. Test API key directly:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_KEY"
   ```
4. Check rate limits (60 requests/minute on free tier)

---

### Issue: PWA won't install

**Symptoms:** "Add to Home Screen" option missing

**Solutions:**

**iOS:**
- Must use Safari (not Chrome)
- iOS 11.3+ required
- Try clearing Safari cache

**Android:**
- Must use Chrome (not Firefox)
- Android 5.0+ required
- Try clearing Chrome cache
- Check for "Install" banner at bottom

---

### Issue: Record button doesn't work

**Symptoms:** Button stays blue, nothing happens

**Solutions:**
1. Check browser console for errors (F12)
2. Verify JavaScript is enabled
3. Try different browser
4. Clear browser cache
5. Check Vercel logs for frontend errors

**Phase 2 (Real Audio):**
- Check microphone permissions
- Verify HTTPS (required for mic access)
- Test on different device

---

### Issue: Data not appearing in Supabase

**Symptoms:** Time cards created but not in database

**Solutions:**
1. Check Railway logs for "insert" errors
2. Verify worker_id is valid UUID
3. Check Supabase RLS policies (Phase 2)
4. Test API endpoint manually:
   ```bash
   curl -X POST https://time-reporting-backend.railway.app/api/time-cards \
     -H "Content-Type: application/json" \
     -d '{"workerId":"...","transcription":"...","audioUrl":"..."}'
   ```

---

## ✅ Success Criteria

### System is Ready When:

**Deployment:**
- [ ] All services deployed and accessible
- [ ] Health checks pass
- [ ] Database schema created
- [ ] Test data seeded

**Manager Setup:**
- [ ] Workers added to database
- [ ] Worksites added to database
- [ ] Worker IDs distributed
- [ ] Monitoring dashboards accessible

**Worker Setup:**
- [ ] PWA accessible on mobile
- [ ] App installable to home screen
- [ ] All 4 screens render correctly
- [ ] Record button functions

**Testing:**
- [ ] At least 3 test scenarios completed
- [ ] Different action types tested
- [ ] Extracted data looks correct
- [ ] No console errors

**Phase 2 Ready:**
- [ ] Real audio recording works
- [ ] Whisper transcription integrated
- [ ] Data saves to database
- [ ] Manager can review entries

---

## 📞 Getting Help

**Issues during setup?**
1. Check this document first
2. Review `docs/deployment-plan.md`
3. Check service dashboards:
   - Railway: https://railway.app/dashboard
   - Vercel: https://vercel.com/dashboard
   - Supabase: https://supabase.com/dashboard
4. Review logs in each service

**Common issues:**
- Environment variables incorrect → Redeploy with correct values
- Database not seeded → Run seed script again
- Frontend can't reach backend → Check VITE_API_URL

---

## 🎯 Next Steps After Validation

**Phase 1 Complete:**
- ✅ System deployed
- ✅ Validation passed
- ✅ Workers can access PWA
- ✅ Mock recording works

**Phase 2 Development (2-3 weeks):**
1. Implement real audio recording (MediaRecorder API)
2. Integrate Whisper API for transcription
3. Connect frontend to backend API
4. Add error handling and retry logic
5. Implement PWA offline support

**Phase 3 Development (4-6 weeks):**
1. Build manager dashboard
2. Add authentication (Supabase Auth)
3. Implement approval workflows
4. Add anomaly detection rules
5. Create job costing reports

---

**Last Updated:** 2026-05-23  
**Status:** Ready for deployment validation and initial setup
