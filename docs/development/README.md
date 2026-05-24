# Development Guide

Complete guide for local development of the time reporting system.

## Quick Links

- **[Local Setup](local-setup.md)** - Installing dependencies and configuring environment
- **[Development Modes](development-modes.md)** - Real API vs Mock mode explained with diagrams
- **[Testing](testing.md)** - Running and writing tests
- **[Debugging](debugging.md)** - Tips for troubleshooting common issues

---

## Development Modes Overview

The system supports two development modes:

### 1. **Real API Mode** (Default)
Uses actual OpenAI services (Whisper + GPT). Best for integration testing and realistic development.

**Pros:**
- Realistic behavior
- Tests actual transcription quality
- Validates extraction accuracy

**Cons:**
- Costs money (~$0.01 per recording)
- Requires OpenAI API key
- Slower (network calls)

### 2. **Mock Mode** (Testing)
Uses pre-recorded transcriptions and mock responses. Best for unit tests and rapid iteration.

**Pros:**
- Free (no API costs)
- Fast (no network calls)
- Deterministic (same input = same output)

**Cons:**
- Doesn't test real transcription
- May miss edge cases

See [Development Modes](development-modes.md) for detailed architecture diagrams.

---

## Prerequisites

Before starting development:

- **Node.js 22.x** or higher ([download](https://nodejs.org/))
- **npm 10.x** or higher (comes with Node.js)
- **Git** ([download](https://git-scm.com/))
- **OpenAI API key** ([get key](https://platform.openai.com/api-keys)) - optional for mock mode
- **Supabase account** ([sign up](https://supabase.com)) - for database

---

## Quick Start

```bash
# Clone repository
git clone https://github.com/nduchastel/time-reporting.git
cd time-reporting

# Install dependencies
cd backend && npm install
cd ../frontend && npm install
```

**Next steps:**
1. Follow [Local Setup Guide](local-setup.md) to configure environment
2. Choose your [Development Mode](development-modes.md)
3. Start coding!

---

## Project Structure

```
time-reporting/
├── backend/               # Node.js + Express API
│   ├── src/
│   │   ├── db/           # Database (schema, migrations, seed)
│   │   ├── routes/       # REST endpoints
│   │   ├── services/     # Business logic
│   │   └── server.js     # Express app
│   ├── tests/            # Backend tests
│   │   ├── fixtures/     # Mock transcription data
│   │   ├── unit/         # Unit tests
│   │   └── integration/  # Integration tests
│   └── package.json
│
├── frontend/             # React PWA
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── test/         # Frontend tests
│   │   └── App.jsx       # Main entry point
│   └── package.json
│
├── docs/                 # Documentation
│   ├── development/      # This guide
│   ├── phase1-decisions.md
│   ├── phase2-*.md
│   └── phase3-plan.md
│
└── Design/               # Original design specs
```

---

## Development Workflow

### Typical development cycle:

1. **Start backend** (Terminal 1)
   ```bash
   cd backend
   npm run dev  # Runs on http://localhost:3001
   ```

2. **Start frontend** (Terminal 2)
   ```bash
   cd frontend
   npm run dev  # Runs on http://localhost:5173
   ```

3. **Make changes** to code

4. **Run tests**
   ```bash
   # Backend tests
   cd backend && npm test

   # Frontend tests
   cd frontend && npm test
   ```

5. **Test in browser** at http://localhost:5173

6. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: your change description"
   git push origin main
   ```

---

## Common Commands

### Backend

```bash
cd backend

# Development server (auto-reload)
npm run dev

# Run all tests
npm test

# Run specific test file
npm test tests/unit/extractionService.test.js

# Run tests in watch mode
npm test -- --watch

# Check for linting errors
npm run lint
```

### Frontend

```bash
cd frontend

# Development server (auto-reload)
npm run dev

# Run all tests
npm test

# Run tests in UI mode
npm test -- --ui

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Environment Variables

### Backend (.env)

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Required for Real API Mode
OPENAI_API_KEY=sk-your-key

# Optional
PORT=3001
NODE_ENV=development
```

### Frontend (.env)

```bash
# Required - points to backend
VITE_API_URL=http://localhost:3001
```

See [Local Setup](local-setup.md) for detailed configuration instructions.

---

## Troubleshooting

**Problem:** Backend won't start  
**Solution:** Check if port 3001 is already in use: `lsof -i :3001`

**Problem:** Frontend can't reach backend  
**Solution:** Verify `VITE_API_URL` in frontend/.env points to `http://localhost:3001`

**Problem:** Database connection fails  
**Solution:** Verify Supabase credentials in backend/.env

**Problem:** OpenAI API errors  
**Solution:** Check API key is valid and has credits

See [Debugging Guide](debugging.md) for more troubleshooting tips.

---

## Contributing

Before submitting a PR:

1. Run all tests: `cd backend && npm test && cd ../frontend && npm test`
2. Ensure code follows existing style
3. Update documentation if needed
4. Test locally in both Real API and Mock modes

---

## Getting Help

- **Documentation issues:** Open GitHub issue with `docs` label
- **Bug reports:** Open GitHub issue with `bug` label
- **Feature requests:** Open GitHub issue with `enhancement` label
- **Questions:** Open GitHub discussion

---

## Next Steps

- **New to the project?** Start with [Local Setup](local-setup.md)
- **Want to understand architecture?** Read [Development Modes](development-modes.md)
- **Ready to write tests?** See [Testing Guide](testing.md)
- **Having issues?** Check [Debugging Guide](debugging.md)
