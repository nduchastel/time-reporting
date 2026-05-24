# Local Development Setup

Step-by-step guide to setting up the time reporting system on your local machine.

---

## Prerequisites

Before you begin, install these tools:

### 1. Node.js 22.x or higher

**Check if installed:**
```bash
node --version  # Should show v22.x.x or higher
npm --version   # Should show v10.x.x or higher
```

**Install if needed:**
- Download from [nodejs.org](https://nodejs.org/)
- Or use [nvm](https://github.com/nvm-sh/nvm):
  ```bash
  nvm install 22
  nvm use 22
  ```

### 2. Git

**Check if installed:**
```bash
git --version
```

**Install if needed:**
- Download from [git-scm.com](https://git-scm.com/)

### 3. Code Editor

Recommended: **VS Code** with extensions:
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Vitest

---

## Step 1: Clone Repository

```bash
# Clone the repository
git clone https://github.com/nduchastel/time-reporting.git
cd time-reporting

# Verify you're in the right place
ls
# Should see: backend/ frontend/ docs/ Design/ README.md
```

---

## Step 2: Install Dependencies

### Backend

```bash
cd backend
npm install
```

**This installs:**
- Express (web server)
- Supabase client (database)
- OpenAI SDK (Whisper + GPT)
- Vitest (testing)
- Multer (file uploads)

### Frontend

```bash
cd ../frontend
npm install
```

**This installs:**
- React 19 (UI framework)
- Vite (build tool)
- Tailwind CSS 4 (styling)
- Vitest (testing)
- React Testing Library

---

## Step 3: Set Up Database

### Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click **"New project"**
3. Fill in:
   - Name: `time-reporting` (or your choice)
   - Database password: (save this!)
   - Region: (closest to you)
4. Click **"Create new project"**
5. Wait ~2 minutes for provisioning

### Get Database Credentials

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like: `https://xxx.supabase.co`)
   - **anon public key** (starts with `eyJ...`)

### Run Database Migration

1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Copy contents of `backend/src/db/migrations/001_initial_schema.sql`
4. Paste into SQL Editor
5. Click **"Run"**
6. Should see: "Success. No rows returned"

**This creates 3 tables:**
- `workers` - Employee records
- `worksites` - Job site locations
- `time_cards` - Time entries

### Seed Test Data (Optional)

```bash
cd backend

# Create .env file with database credentials
cat > .env << EOF
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
EOF

# Run seed script
node src/db/seed.js
```

**This creates:**
- 5 test workers (Bob Martinez, Alice Johnson, etc.)
- 4 test worksites (Simons Property, Downtown Office, etc.)

See [Database README](../../backend/src/db/README.md) for schema details.

---

## Step 4: Get OpenAI API Key

### Option 1: Use Real API (Recommended for Integration Testing)

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click **"Create new secret key"**
3. Name it: `time-reporting-dev`
4. Copy the key (starts with `sk-`)
5. **Save it** - you can't see it again!

**Add billing:**
- Go to [Settings → Billing](https://platform.openai.com/account/billing)
- Add $5-10 for development testing

### Option 2: Skip for Mock Mode (Testing Only)

If you're only running tests with mocked data, you can skip this step.

---

## Step 5: Configure Environment

### Backend Configuration

Create `backend/.env`:

```bash
cd backend

cat > .env << 'EOF'
# Database (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# OpenAI API (Required for Real API Mode)
OPENAI_API_KEY=sk-your-key

# Server (Optional)
PORT=3001
NODE_ENV=development
EOF
```

**Replace these values:**
- `SUPABASE_URL` - from Supabase Settings → API
- `SUPABASE_ANON_KEY` - from Supabase Settings → API  
- `OPENAI_API_KEY` - from OpenAI platform (or omit for Mock Mode)

### Frontend Configuration

Create `frontend/.env`:

```bash
cd frontend

cat > .env << 'EOF'
# Backend API URL
VITE_API_URL=http://localhost:3001
EOF
```

**Note:** `VITE_API_URL` points to your local backend server.

---

## Step 6: Verify Setup

### Test Backend

```bash
cd backend

# Run tests (uses Mock Mode - no API calls)
npm test

# Should see:
# ✓ 15 tests passing
# Test Files  5 passed (5)
# Tests  15 passed (15)
```

### Test Frontend

```bash
cd frontend

# Run tests
npm test

# Should see:
# ✓ 3 tests passing
```

### Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev

# Should see:
# Server running on http://localhost:3001
# Environment: development
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev

# Should see:
# ➜  Local:   http://localhost:5173/
# ➜  Network: use --host to expose
```

### Test in Browser

1. Open http://localhost:5173
2. Should see 4 colored action cards (IN, OUT, HOURS, OFF)
3. Tap record button
4. Speak into microphone: "I worked 8 hours at Simons Property"
5. Stop recording
6. Should see transcription and extracted data

**If it works:** ✅ Setup complete!

**If it fails:** See [Troubleshooting](#troubleshooting) below.

---

## Troubleshooting

### Backend Won't Start

**Error:** `Error: listen EADDRINUSE :::3001`  
**Cause:** Port 3001 already in use  
**Fix:**
```bash
# Find process using port 3001
lsof -i :3001

# Kill it
kill -9 <PID>

# Or use different port in backend/.env:
PORT=3002
```

---

**Error:** `Error: Invalid Supabase URL`  
**Cause:** Wrong `SUPABASE_URL` in `.env`  
**Fix:**
1. Check Supabase dashboard → Settings → API
2. Copy **Project URL** exactly (with https://)
3. Update `backend/.env`

---

**Error:** `Error: OpenAI API key not found`  
**Cause:** Missing `OPENAI_API_KEY` in `.env`  
**Fix:**
- Add key to `backend/.env`
- Or run in Mock Mode (tests only)

---

### Frontend Won't Start

**Error:** `Failed to fetch` when recording  
**Cause:** Backend not running or wrong URL  
**Fix:**
1. Start backend: `cd backend && npm run dev`
2. Verify `VITE_API_URL=http://localhost:3001` in `frontend/.env`
3. Restart frontend: `npm run dev`

---

**Error:** `Cannot find module 'react'`  
**Cause:** Dependencies not installed  
**Fix:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

### Database Errors

**Error:** `relation "workers" does not exist`  
**Cause:** Migration not run  
**Fix:**
1. Go to Supabase → SQL Editor
2. Run `backend/src/db/migrations/001_initial_schema.sql`

---

**Error:** `Invalid API key`  
**Cause:** Wrong `SUPABASE_ANON_KEY`  
**Fix:**
1. Get key from Supabase → Settings → API → **anon public**
2. Update `backend/.env`

---

### Recording Errors

**Error:** "Microphone access denied"  
**Cause:** Browser permissions  
**Fix:**
1. Chrome: Click 🔒 in address bar → Allow microphone
2. Safari: Preferences → Websites → Microphone → Allow

---

**Error:** "Heard nothing! Record again."  
**Cause:** Silent recording or low confidence  
**Fix:**
1. Speak louder and clearer
2. Mention worksite and hours explicitly
3. Check microphone is working (test in another app)

---

**Error:** "Network issue. Check connection."  
**Cause:** Backend not reachable  
**Fix:**
1. Verify backend is running on port 3001
2. Check `VITE_API_URL` in `frontend/.env`

---

## Development Tips

### Hot Reload

Both frontend and backend auto-reload when you save files:

- **Backend**: Uses `nodemon` (via `npm run dev`)
- **Frontend**: Uses Vite HMR (Hot Module Replacement)

### Debugging

**Backend logs:**
```bash
cd backend
npm run dev

# Logs appear in terminal:
# - HTTP requests (GET /api/time-cards)
# - Errors (console.error)
# - Debug (console.log)
```

**Frontend logs:**
```bash
# Open browser console (F12)
# Look for:
# - Debug log (green terminal-style panel in UI)
# - Console errors (red text in console)
# - Network requests (Network tab)
```

**Database queries:**
```bash
# View data in Supabase dashboard
# Table Editor → workers/worksites/time_cards
```

### Running Tests

```bash
# Backend - all tests
cd backend && npm test

# Backend - specific test
npm test tests/unit/extractionService.test.js

# Backend - watch mode (re-run on save)
npm test -- --watch

# Frontend - all tests
cd frontend && npm test

# Frontend - UI mode (interactive)
npm test -- --ui
```

### Code Style

The project uses:
- **ESLint** - JavaScript linting
- **Prettier** - Code formatting

**Auto-format on save:**
1. Install VS Code extensions (ESLint + Prettier)
2. VS Code Settings → Format On Save → ✓ Enable

---

## Next Steps

Now that your local environment is set up:

1. **Understand the architecture**: Read [Development Modes](development-modes.md)
2. **Learn testing**: See [Testing Guide](testing.md)
3. **Start developing**: Pick a task from [Phase 3 Plan](../phase3-plan.md)
4. **Need help?** Check [Debugging Guide](debugging.md)

---

## Quick Reference

### Common Commands

```bash
# Start development
cd backend && npm run dev     # Terminal 1
cd frontend && npm run dev    # Terminal 2

# Run tests
cd backend && npm test
cd frontend && npm test

# Seed database
cd backend && node src/db/seed.js

# Check environment
cat backend/.env
cat frontend/.env
```

### File Locations

```
.env files (not in git):
  backend/.env          Backend config
  frontend/.env         Frontend config

Database:
  backend/src/db/migrations/001_initial_schema.sql
  backend/src/db/seed.js

Tests:
  backend/tests/        Backend tests
  frontend/src/test/    Frontend tests
```

### URLs

- **Frontend (dev)**: http://localhost:5173
- **Backend (dev)**: http://localhost:3001
- **Backend API**: http://localhost:3001/api/time-cards
- **Supabase Dashboard**: https://supabase.com/dashboard

---

## Getting Help

If you're stuck:

1. Check [Troubleshooting](#troubleshooting) above
2. Read [Debugging Guide](debugging.md)
3. Search [GitHub Issues](https://github.com/nduchastel/time-reporting/issues)
4. Open a new issue with:
   - Error message
   - Steps to reproduce
   - Your environment (OS, Node version)
