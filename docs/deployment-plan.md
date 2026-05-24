# Deployment Plan

**Status:** Ready for deployment  
**Date:** 2026-05-23  
**Phase:** Production deployment with free/low-cost hosting

---

## Architecture Overview

```
                  ┌──────────────────────────────┐
                  │   GitHub (Code Repository)   │
                  └──────────────┬───────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
┌─────────────────┐                             ┌─────────────────┐
│     Vercel      │                             │     Railway     │
│ (Frontend PWA)  │                             │ (Backend Node)  │
└────────┬────────┘                             └────────┬────────┘
         │                                               │
         │ (Public Web Traffic)                          │ (Secure API Calls)
         ▼                                               ▼
┌─────────────────┐                             ┌─────────────────┐
│ Worker's Phone  ├────────────────────────────►│   Supabase DB   │
│ (iOS/Android)   │                             └────────┬────────┘
└─────────────────┘                                      │
                                                         ▼
                                                ┌─────────────────┐
                                                │   OpenAI API    │
                                                └─────────────────┘
```

---

## Hosting Services

### 1. GitHub (Code Repository) ✅ COMPLETE

**URL:** https://github.com/nduchastel/time-reporting  
**Cost:** $0 (Free Tier)  
**Status:** Already set up and linked

**What it does:**
- Hosts code repository privately
- Triggers automatic deployments to Vercel and Railway on push
- Version control and collaboration

**Setup:**
- ✅ Repository created and pushed
- ✅ All code committed (42def3f)
- ✅ Linked to your GitHub account

---

### 2. Vercel (Frontend PWA) 🟡 READY TO DEPLOY

**URL:** https://vercel.com  
**Cost:** $0 (Free Tier - Hobby Plan)  
**Recommended URL:** `time-reporting.vercel.app` or custom domain

**What it does:**
- Hosts React PWA frontend
- Instant serverless deployment
- Global CDN for fast loading worldwide
- Automatic HTTPS
- Zero cold-start delay for users

**Why Vercel:**
- ✅ Optimized for React/Vite applications
- ✅ Automatic builds from GitHub
- ✅ Free tier includes unlimited bandwidth
- ✅ Perfect for PWA with service worker support

**Deployment Steps:**

1. **Connect GitHub:**
   - Go to https://vercel.com
   - Sign in with GitHub account (nduchastel)
   - Click "New Project"
   - Import `nduchastel/time-reporting`

2. **Configure Build Settings:**
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

3. **Environment Variables:**
   - `VITE_API_URL` = Railway backend URL (add after Railway is deployed)
   - Example: `https://time-reporting-backend.railway.app`

4. **Deploy:**
   - Click "Deploy"
   - Wait ~2 minutes
   - Get URL: `https://time-reporting.vercel.app`

5. **Post-Deployment:**
   - Test PWA installability on mobile
   - Verify offline service worker (Phase 2)
   - Set up custom domain if desired

**Security Note:** ✅ No sensitive keys in frontend! API key stays in Railway backend.

---

### 3. Railway (Backend Server) 🟡 READY TO DEPLOY

**URL:** https://railway.app  
**Cost:** $5/month (Hobby Tier - includes $5 compute credits)  
**Recommended URL:** `time-reporting-backend.railway.app`

**What it does:**
- Hosts Node.js Express backend
- Keeps server always-on (no cold starts)
- Handles long-running AI operations
- Secure environment variable storage

**Why Railway:**
- ✅ No cold-start delays (instant worker response)
- ✅ Better for long-running processes than serverless
- ✅ Simple deployment from GitHub
- ✅ Built-in PostgreSQL option (we're using Supabase instead)
- ✅ $5/month includes enough compute for this app

**Deployment Steps:**

1. **Create Account & Project:**
   - Go to https://railway.app
   - Sign in with GitHub account (nduchastel)
   - Click "New Project"
   - Choose "Deploy from GitHub repo"
   - Select `nduchastel/time-reporting`

2. **Configure Service:**
   - **Name:** `time-reporting-backend`
   - **Root Directory:** `backend`
   - **Build Command:** (auto-detected)
   - **Start Command:** `npm start`

3. **Environment Variables** (CRITICAL - add in Railway dashboard):

   ```bash
   # Database
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-from-supabase
   
   # AI Services (NEVER PUT IN FRONTEND!)
   OPENAI_API_KEY=sk-proj-your-openai-api-key-here
   
   # Server Config
   PORT=3001
   NODE_ENV=production
   
   # CORS (add after Vercel deployment)
   ALLOWED_ORIGINS=https://time-reporting.vercel.app
   ```

4. **Deploy:**
   - Click "Deploy"
   - Wait ~3 minutes
   - Get URL: `https://time-reporting-backend.railway.app`

5. **Verify Deployment:**
   ```bash
   curl https://time-reporting-backend.railway.app/health
   # Expected: {"status":"ok","timestamp":"..."}
   ```

6. **Update Frontend:**
   - Go back to Vercel dashboard
   - Add environment variable: `VITE_API_URL=https://time-reporting-backend.railway.app`
   - Redeploy frontend

**Security Notes:**
- ✅ OpenAI API key stored securely in Railway (not in code)
- ✅ Backend is only accessible via HTTPS
- ✅ CORS configured to only allow Vercel frontend
- ✅ Environment variables never committed to GitHub

---

### 4. Supabase (PostgreSQL Database) 🟡 READY TO DEPLOY

**URL:** https://supabase.com  
**Cost:** $0 (Free Tier - 500MB storage, 2GB transfer/month)  
**Database:** PostgreSQL 15.x

**What it does:**
- Stores worker profiles, worksites, time cards
- Handles authentication (future phase)
- Provides real-time subscriptions (future phase)
- Automatic backups

**Why Supabase:**
- ✅ Enterprise PostgreSQL for free
- ✅ Built-in auth and real-time features
- ✅ Generous free tier (500MB database)
- ✅ Automatic SSL and security

**Deployment Steps:**

1. **Create Project:**
   - Go to https://supabase.com
   - Sign in with GitHub account (nduchastel)
   - Click "New Project"
   - **Name:** `time-reporting`
   - **Database Password:** (Generate strong password and save it!)
   - **Region:** Choose closest to your workers (e.g., US East for Canada/USA)

2. **Run Migration:**
   - Go to SQL Editor in Supabase dashboard
   - Click "New Query"
   - Copy entire contents of `backend/src/db/migrations/001_initial_schema.sql`
   - Click "Run"
   - Verify tables created in Table Editor:
     - ✅ `workers` (7 columns)
     - ✅ `worksites` (7 columns)
     - ✅ `time_cards` (15 columns)

3. **Seed Test Data:**
   - Create `.env` file in `backend/` with Supabase credentials:
   ```bash
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-from-project-settings
   ```
   - Run seed script:
   ```bash
   cd backend
   node src/db/seed.js
   ```
   - Verify in Supabase Table Editor:
     - ✅ 1 worker (Bob Martinez)
     - ✅ 3 worksites (Simons, ACME, Hyatt)

4. **Copy Credentials to Railway:**
   - Get from Supabase Project Settings → API:
     - **URL:** `https://xxxxx.supabase.co`
     - **anon/public key:** `eyJhbGc...`
   - Add to Railway environment variables (see Railway section above)

5. **Security Configuration:**
   - Go to Authentication → Policies
   - (Phase 1: Use anon key, Phase 2: Add RLS policies)

**Database Schema:**
```sql
workers (id, name, email, phone, language, status, custom_rules, created_at, updated_at)
worksites (id, name, address, client, status, custom_rules, created_at, updated_at)
time_cards (id, worker_id, worksite_id, action_type, date, hours, transcription, 
            extracted_data, confidence, status, audio_url, created_at, updated_at)
```

---

### 5. OpenAI Developer Platform (AI Services) ✅ COMPLETE

**URL:** https://platform.openai.com  
**Cost:** Pay-as-you-go (~$0.15-0.31/month based on usage)  
**Models:** Whisper (transcription), GPT-4o-mini (extraction)

**What it does:**
- Whisper API: Converts audio to text ($0.006/minute)
- GPT-4o-mini: Extracts structured time card data ($0.15 per 1M tokens)

**Why OpenAI:**
- ✅ Best-in-class speech recognition
- ✅ Structured output with JSON mode
- ✅ Pay only for what you use (no monthly subscription)
- ✅ Multi-language support (EN/FR/ES)

**Deployment Steps:**

1. **Verify API Key:** ✅ Already have key (stored securely, not in documentation)

2. **Test API Access:**
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer sk-proj-..." | grep gpt-4o-mini
   ```

3. **Add to Railway:** (See Railway section - already documented)

4. **Monitor Usage:**
   - Dashboard: https://platform.openai.com/usage
   - Set up billing alerts at $2, $5, $10
   - Expected monthly cost: $0.15-0.31 for 200 entries

**Security:** ✅ API key ONLY in Railway backend, never in frontend code!

---

## Cost Summary

| Service | Tier | Monthly Cost | Notes |
|---------|------|--------------|-------|
| GitHub | Free | $0.00 | Private repo, unlimited commits |
| Vercel | Hobby | $0.00 | Unlimited bandwidth, 100 deploys/day |
| Railway | Hobby | $5.00 | Includes $5 compute credits (likely unused) |
| Supabase | Free | $0.00 | 500MB storage, 2GB transfer |
| OpenAI | Pay-as-you-go | ~$0.15-0.31 | Based on actual usage |
| **Total** | | **$5.15-5.31/month** | Flat rate, scales with usage |

**Cost Breakdown by Usage:**
- **5 workers, 20 days/month, 2 entries/day = 200 entries/month**
- Whisper: 200 × 30 seconds × $0.006/min = $0.60
- GPT-4o-mini: 200 × ~500 tokens × $0.0000015 = $0.15
- Railway: $5 flat (includes unused compute credits)
- **Total: $5.75/month**

**Cost savings compared to alternatives:**
- No managed Kubernetes (save $50-100/month)
- No dedicated servers (save $20-50/month)
- No MongoDB Atlas paid tier (save $9/month)
- No Heroku dynos (save $7/month)

---

## Deployment Checklist

### Pre-Deployment

- [x] All tests passing (18/18)
- [x] Code committed to GitHub
- [x] README.md updated
- [x] Documentation complete
- [ ] Supabase project created
- [ ] Railway account created
- [ ] Vercel account created

### Database Deployment

- [ ] Create Supabase project
- [ ] Run migration SQL
- [ ] Seed test data
- [ ] Verify tables created
- [ ] Copy credentials

### Backend Deployment (Railway)

- [ ] Connect GitHub repo
- [ ] Configure root directory (`backend`)
- [ ] Add environment variables:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_ANON_KEY`
  - [ ] `OPENAI_API_KEY`
  - [ ] `PORT=3001`
  - [ ] `NODE_ENV=production`
- [ ] Deploy
- [ ] Test health endpoint
- [ ] Copy Railway URL

### Frontend Deployment (Vercel)

- [ ] Connect GitHub repo
- [ ] Configure root directory (`frontend`)
- [ ] Add environment variable: `VITE_API_URL` (Railway URL)
- [ ] Deploy
- [ ] Test PWA loads
- [ ] Test on mobile (iOS/Android)
- [ ] Verify installability

### Post-Deployment

- [ ] Test end-to-end flow:
  - [ ] Worker opens PWA
  - [ ] Records mock time entry
  - [ ] Backend creates time card
  - [ ] Data saved to Supabase
- [ ] Set up monitoring:
  - [ ] Railway logs
  - [ ] OpenAI usage dashboard
  - [ ] Supabase metrics
- [ ] Document production URLs in README
- [ ] Update `.env.example` files

---

## Phase 2: Additional Features

After initial deployment, implement these features:

### Week 1-2: Real Audio Recording
- [ ] Implement MediaRecorder API in frontend
- [ ] Add audio upload to backend
- [ ] Integrate Whisper API for transcription
- [ ] Test on iOS Safari and Android Chrome

### Week 3: Error Handling & Retry
- [ ] Add error boundaries in React
- [ ] Implement retry logic for failed API calls
- [ ] Show user-friendly error messages
- [ ] Add toast notifications

### Week 4: PWA Features
- [ ] Service worker for offline support
- [ ] Cache API responses
- [ ] Background sync for queued entries
- [ ] Add to home screen prompts

### Week 5-6: Manager Dashboard
- [ ] Incoming timeline view
- [ ] Worker analysis view
- [ ] Review cards for anomalies
- [ ] Approval workflow

---

## Maintenance Tasks

### Daily
- ✅ **Automated** - Railway/Vercel deploy on git push
- ✅ **Automated** - Supabase backups

### Weekly
- [ ] Check OpenAI usage dashboard
- [ ] Review Railway logs for errors
- [ ] Monitor Supabase storage usage

### Monthly
- [ ] Review Railway bill ($5 expected)
- [ ] Review OpenAI bill ($0.15-0.31 expected)
- [ ] Check Supabase free tier limits (500MB storage)
- [ ] Update dependencies if security patches available

### Quarterly
- [ ] Audit test coverage
- [ ] Review and update documentation
- [ ] Plan feature roadmap
- [ ] Backup Supabase database manually (extra safety)

### As Needed
- [ ] Scale Railway if traffic increases
- [ ] Upgrade Supabase if storage exceeds 500MB
- [ ] Add custom domain to Vercel
- [ ] Implement additional features

---

## Rollback Plan

If deployment fails or has critical bugs:

### Frontend (Vercel)
1. Go to Vercel dashboard → Deployments
2. Find last working deployment
3. Click "Promote to Production"
4. Rollback takes ~30 seconds

### Backend (Railway)
1. Go to Railway dashboard → Deployments
2. Find last working deployment
3. Click "Redeploy"
4. Rollback takes ~2 minutes

### Database (Supabase)
1. Supabase keeps automatic backups (daily on free tier)
2. Go to Database → Backups
3. Click "Restore" on desired backup
4. Confirm restoration

### Emergency Procedure
1. Set Railway to maintenance mode (custom response)
2. Roll back to last known good state
3. Fix issue in local dev environment
4. Run full test suite
5. Deploy fix
6. Monitor for 1 hour
7. Resume normal operations

---

## Monitoring & Alerts

### Railway (Backend)
- **Logs:** Built-in log viewer
- **Metrics:** CPU, Memory, Network usage
- **Alerts:** Set up Discord/Slack webhook for errors

### Vercel (Frontend)
- **Analytics:** Page views, performance metrics
- **Errors:** Automatic error tracking
- **Uptime:** Status page available

### Supabase (Database)
- **Metrics:** Database size, active connections, query performance
- **Alerts:** Email notifications for:
  - Storage > 400MB (80% of free tier)
  - Transfer > 1.5GB/month (75% of free tier)

### OpenAI (AI Services)
- **Usage Dashboard:** https://platform.openai.com/usage
- **Billing Alerts:** Set at $2, $5, $10
- **Expected Usage:** $0.15-0.31/month

---

## Security Best Practices

### ✅ Already Implemented

1. **API Key Protection:**
   - ✅ OpenAI key ONLY in Railway backend (never in frontend)
   - ✅ `.env` files in `.gitignore`
   - ✅ Environment variables in Railway dashboard

2. **CORS Configuration:**
   - ✅ Backend only accepts requests from Vercel frontend
   - ✅ No wildcard (`*`) CORS origins

3. **HTTPS Everywhere:**
   - ✅ Vercel provides automatic HTTPS
   - ✅ Railway provides automatic HTTPS
   - ✅ Supabase requires SSL connections

### 🔄 Phase 2 Security

1. **Authentication:**
   - [ ] Add Supabase Auth for manager login
   - [ ] JWT tokens for API authentication
   - [ ] Row Level Security (RLS) policies

2. **Input Validation:**
   - [ ] Rate limiting on API endpoints
   - [ ] Input sanitization for transcriptions
   - [ ] File size limits for audio uploads

3. **Audit Logging:**
   - [ ] Log all time card approvals
   - [ ] Track manager actions
   - [ ] Record override justifications

---

## Troubleshooting

### Frontend won't load
- Check Vercel deployment logs
- Verify `VITE_API_URL` is set correctly
- Clear browser cache

### Backend returns 500 errors
- Check Railway logs
- Verify Supabase connection
- Test OpenAI API key is valid

### Database connection fails
- Verify Supabase credentials
- Check IP allowlist (Railway's IP should be allowed)
- Test connection from Railway logs

### OpenAI API errors
- Check API key is valid
- Verify billing account has funds
- Check rate limits (60 requests/minute on free tier)

---

## Next Steps

1. **Deploy Database** (15 minutes)
   - Create Supabase project
   - Run migration
   - Seed data

2. **Deploy Backend** (20 minutes)
   - Create Railway project
   - Configure environment variables
   - Deploy and test

3. **Deploy Frontend** (15 minutes)
   - Create Vercel project
   - Add API URL
   - Deploy and test on mobile

4. **Integration Testing** (30 minutes)
   - Test full flow end-to-end
   - Verify data persists in Supabase
   - Check OpenAI usage

**Total deployment time: ~80 minutes**

---

## Support & Resources

**Documentation:**
- Vercel Docs: https://vercel.com/docs
- Railway Docs: https://docs.railway.app
- Supabase Docs: https://supabase.com/docs
- OpenAI API: https://platform.openai.com/docs

**Community:**
- Vercel Discord: https://vercel.com/discord
- Railway Discord: https://discord.gg/railway
- Supabase Discord: https://discord.supabase.com

**Monitoring:**
- Railway Dashboard: https://railway.app/dashboard
- Vercel Dashboard: https://vercel.com/dashboard
- Supabase Dashboard: https://supabase.com/dashboard
- OpenAI Usage: https://platform.openai.com/usage
