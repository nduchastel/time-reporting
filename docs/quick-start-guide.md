# Quick Start Guide

**Time Reporting System - From Zero to Production in 80 Minutes**

---

## ✅ What's Ready

- ✅ **Backend API** - Express server: voice → Whisper → GPT extraction, JWT auth, manager + reports endpoints
- ✅ **Frontend PWA** - React worker UI (record/review/submit + history) and manager dashboard (`#/manager`)
- ✅ **Auth** - Worker PIN login + manager username/password (Phase 3)
- ✅ **Database Schema** - PostgreSQL migrations (incl. Phase 3 auth columns + indexes)
- ✅ **Automated tests** - unit + integration + smoke + Playwright (`npm run test:all`)
- ✅ **Deployed** - production live on Vercel + Railway + Supabase

---

## 🚀 Deploy in 80 Minutes

### Step 1: Database (15 min) - Supabase

1. **Create Project:**
   - Go to https://supabase.com → Sign in with GitHub
   - New Project → Name: `time-reporting`
   - **Save database password!**

2. **Run Migration:**
   - SQL Editor → New Query
   - Copy/paste from: `backend/src/db/migrations/001_initial_schema.sql`
   - Click "Run" → Verify 3 tables created

3. **Seed Data:**
   ```bash
   cd backend
   echo "SUPABASE_URL=https://your-project.supabase.co" > .env
   echo "SUPABASE_ANON_KEY=your-anon-key" >> .env
   node src/db/seed.js
   ```
   - Verify: 1 worker, 3 worksites

4. **Copy Credentials:**
   - Project Settings → API → Copy URL and anon key
   - Save for Railway setup

---

### Step 2: Backend (20 min) - Railway

1. **Create Service:**
   - Go to https://railway.app → Sign in with GitHub
   - New Project → Deploy from GitHub
   - Select: `nduchastel/time-reporting`
   - Name: `time-reporting-backend`

2. **Configure:**
   - Settings → Root Directory: `backend`
   - Start Command: `npm start` (auto-detected)

3. **Environment Variables** (Critical!):
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-from-supabase
   OPENAI_API_KEY=sk-proj-your-key-here
   PORT=3001
   NODE_ENV=production
   ```

4. **Deploy:**
   - Click "Deploy" → Wait ~3 minutes
   - Copy Railway URL: `https://time-reporting-backend.railway.app`

5. **Test:**
   ```bash
   curl https://time-reporting-backend.railway.app/health
   # Expected: {"status":"ok","timestamp":"..."}
   ```

---

### Step 3: Frontend (15 min) - Vercel

1. **Create Project:**
   - Go to https://vercel.com → Sign in with GitHub
   - New Project → Import: `nduchastel/time-reporting`
   - Name: `time-reporting`

2. **Configure:**
   - Framework: Vite (auto-detected)
   - Root Directory: `frontend`
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `dist` (auto-detected)

3. **Environment Variable:**
   ```
   VITE_API_URL=https://time-reporting-backend.railway.app
   ```

4. **Deploy:**
   - Click "Deploy" → Wait ~2 minutes
   - Get URL: `https://time-reporting.vercel.app`

5. **Test on Mobile:**
   - Open URL on iPhone/Android
   - Should see 4 colored action screens
   - Test record button (uses mock data)

---

### Step 4: Integration Test (30 min)

1. **End-to-End Flow:**
   - [ ] Open Vercel URL on mobile
   - [ ] Click "Check IN" screen
   - [ ] Tap record button (currently mock)
   - [ ] Verify transcription appears
   - [ ] Verify extracted data shown
   - [ ] (Phase 2: Real recording will save to Supabase)

2. **Check Services:**
   - [ ] Railway logs show no errors
   - [ ] Supabase shows tables populated
   - [ ] OpenAI usage dashboard shows activity (Phase 2)

3. **Update README:**
   ```bash
   cd ~/work/time-reporting
   # Add production URLs to README.md
   git add README.md
   git commit -m "docs: add production URLs"
   git push
   ```

---

## 📊 Current Status

**Phase 1 MVP:** ✅ COMPLETE
- Backend API deployed
- Frontend PWA deployed
- Database ready
- All tests passing

**Phase 2 Features:** 🔄 NEXT
- Real audio recording (MediaRecorder API)
- Whisper transcription integration
- Connect frontend to backend API
- Error handling & retry logic
- PWA offline support

---

## 💰 Monthly Costs

| Service | Cost |
|---------|------|
| Vercel | $0.00 |
| Railway | $5.00 |
| Supabase | $0.00 |
| OpenAI | ~$0.15-0.31 |
| **Total** | **$5.15-5.31** |

---

## 🔐 Security Checklist

- [x] OpenAI key ONLY in Railway (never in frontend!)
- [x] `.env` files in `.gitignore`
- [x] HTTPS everywhere (auto by Vercel/Railway/Supabase)
- [x] CORS configured (Railway only accepts Vercel requests)
- [ ] Authentication (Phase 2: Supabase Auth)
- [ ] Rate limiting (Phase 2)
- [ ] Row Level Security (Phase 2)

---

## 🛠️ Maintenance

**Weekly:**
- Check Railway logs for errors
- Monitor OpenAI usage dashboard

**Monthly:**
- Review Railway bill ($5 expected)
- Review OpenAI bill ($0.15-0.31 expected)
- Check Supabase storage (500MB free tier limit)

---

## 📞 Support

**Issues?**
1. Check deployment logs (Railway/Vercel)
2. Verify environment variables set correctly
3. Test database connection from Railway
4. Review `docs/deployment-plan.md` for troubleshooting

**Rollback:**
- Vercel: Dashboard → Deployments → Promote previous
- Railway: Dashboard → Deployments → Redeploy previous
- Supabase: Database → Backups → Restore

---

## 🎯 Next Steps

**Done (Phases 1–4):** real audio recording, Whisper transcription, frontend↔backend wiring, worker PIN + manager auth, manager dashboard, reports + CSV, audio storage, automated test suite — **plus Phase 4:** worker-ownership auth on `GET /time-cards`, auth rate limiting, CORS lockdown, role-based JWT TTL, RLS, error monitoring, PWA install, admin portal + user management with the temporary-credential/forced-first-login lifecycle, per-worker panel visibility, worksite management, and worker/manager onboarding guides. See [`phase4-plan.md`](phase4-plan.md) and [`onboarding/`](onboarding/).

**Next — Pre-Beta-Ship QA gate**, then beta launch. See [`pre-beta-ship-plan.md`](pre-beta-ship-plan.md).

**Later — Phase 5 (post-beta):** anomaly detection, charts/PDF, GPS, photos, crew entries, push, payroll, offline sync. See [`phase5-backlog.md`](phase5-backlog.md).

---

## 📚 Documentation

- **Full Deployment Plan:** `docs/deployment-plan.md`
- **Design Specification:** `Design/2026-05-23-construction-time-tracking-design.md`
- **Implementation Plan:** `docs/implementation-plan.md`
- **Technical Decisions:** `docs/phase1-decisions.md`, `docs/phase2-decisions.md`

---

**Repository:** https://github.com/nduchastel/time-reporting  
**Status:** ✅ Deployed to production (Phases 1–3 shipped; Phase 4 in planning)
