# Technical Decisions

## Task 1: Project Setup

**Date:** 2026-05-23

### Decision 1: ES Modules over CommonJS
- **Choice:** Using ES modules (`"type": "module"` in package.json)
- **Rationale:** Modern Node.js standard, better for future compatibility, cleaner syntax
- **Alternative considered:** CommonJS (require/module.exports)

### Decision 2: Vitest over Jest
- **Choice:** Vitest for testing
- **Rationale:** Better ESM support, faster, designed for Vite ecosystem
- **Alternative considered:** Jest

### Decision 3: Express over Fastify
- **Choice:** Express for web framework
- **Rationale:** More mature ecosystem, better documentation, team familiarity
- **Alternative considered:** Fastify (faster but less ecosystem support)

### Decision 4: Port 3001 for backend
- **Choice:** Default port 3001
- **Rationale:** Avoid conflict with common frontend port 3000
- **Alternative considered:** Port 8080 (less conventional for Node apps)

### Decision 5: Express v5
- **Choice:** Using Express v5.2.1
- **Rationale:** Latest stable version with improved async/await support and better error handling
- **Alternative considered:** Express v4 (more widespread but older API)

### Decision 6: Node.js --watch flag
- **Choice:** Using Node.js native `--watch` flag for development
- **Rationale:** Built-in hot reload without external dependencies (nodemon)
- **Alternative considered:** nodemon (extra dependency, but more mature)

## Task 2: Database Schema

**Date:** 2026-05-23

### Decision 1: Manual Supabase migrations
- **Choice:** Manual SQL execution in Supabase dashboard
- **Rationale:** Simple for MVP, no migration tool overhead, Supabase UI makes this easy
- **Alternative considered:** Automated migrations with a tool like node-pg-migrate
- **Future:** Consider migration tool if team grows or deployments become frequent

### Decision 2: JSONB for flexible fields
- **Choice:** JSONB for disabled_range, custom_rules, extracted_data
- **Rationale:** Schema flexibility without migrations, good PostgreSQL support, queryable
- **Alternative considered:** Separate tables (over-engineering for MVP)

### Decision 3: UUID primary keys
- **Choice:** UUID over auto-increment integers
- **Rationale:** No collision risk, better for distributed systems, harder to enumerate
- **Alternative considered:** BIGSERIAL (simpler but exposes record count)

## Task 3: Mock Transcription Fixtures

**Date:** 2026-05-23

### Decision 1: Comprehensive test fixture strategy
- **Choice:** 17 test cases across 3 categories (good/bad/edge)
- **Rationale:** Test extraction logic without OpenAI costs, predictable test behavior, fast execution
- **Coverage:** High confidence (6), low/medium confidence (6), edge cases (5)

### Decision 2: Fixtures include expected output
- **Choice:** Each fixture has both input text and expected extraction
- **Rationale:** Makes test assertions clear, documents expected behavior, enables mock implementation
- **Alternative considered:** Only provide input text (harder to validate)

### Decision 3: Mock strategy cuts off voice-to-text
- **Choice:** Provide pre-transcribed text, skip Whisper API entirely in tests
- **Rationale:** Focus on extraction logic, avoid API costs in tests, deterministic results
- **Alternative considered:** Record actual audio files (expensive, slow, non-deterministic)

## Task 4: Extraction Service

**Date:** 2026-05-23

### Decision 1: GPT-4o-mini for extraction
- **Choice:** gpt-4o-mini model
- **Rationale:** Cheaper than GPT-4 ($0.15/$0.60 per 1M tokens), fast, sufficient for structured extraction
- **Alternative considered:** GPT-3.5-turbo (less capable), GPT-4 (overkill + expensive)

### Decision 2: JSON mode for structured output
- **Choice:** `response_format: { type: 'json_object' }`
- **Rationale:** Guarantees valid JSON response, reduces parsing errors
- **Alternative considered:** Parsing markdown code blocks (fragile)

### Decision 3: Low temperature (0.1) for consistency
- **Choice:** temperature = 0.1
- **Rationale:** Extraction should be deterministic, not creative
- **Alternative considered:** 0.0 (too rigid), 0.5 (too random)

### Decision 4: Complete OpenAI mocking in tests
- **Choice:** Mock entire OpenAI client, match transcription text to fixture expected output
- **Rationale:** Fast tests, no API costs, deterministic behavior, enables CI/CD
- **Alternative considered:** Real API calls in tests (slow, expensive, flaky)

## Task 5: Time Card Service

**Date:** 2026-05-23

### Decision 1: Supabase query builder over raw SQL
- **Choice:** Use Supabase JavaScript client query builder
- **Rationale:** Type-safe, chainable, handles parameterization, easier to mock in tests
- **Alternative considered:** Raw SQL queries (more control but less safe)

### Decision 2: Snake_case for database, camelCase for JavaScript
- **Choice:** Convert between naming conventions at service layer
- **Rationale:** Follow PostgreSQL conventions in DB, JavaScript conventions in code
- **Example:** `worker_id` in DB becomes `workerId` in function parameters

### Decision 3: Include related data in getTimeCards
- **Choice:** Select workers and worksites with join: `select('*, workers(name), worksites(name)')`
- **Rationale:** Reduce round trips, common use case is to display worker/site names
- **Alternative considered:** Separate queries (more round trips)

### Decision 4: Filter by query parameters, not body
- **Choice:** `getTimeCards({ workerId, status, ... })` as function params
- **Rationale:** RESTful pattern, easier to test, clear API contract
- **Alternative considered:** Single filter object (less explicit)

### Decision 5: Chainable mock pattern for Supabase queries
- **Choice:** Create a self-referencing chain object with a `then` method for promise resolution
- **Rationale:** Allows chaining multiple filter methods (eq, gte, lte) before resolution
- **Alternative considered:** Nested function returns (harder to read and maintain)

## Task 6: API Routes

**Date:** 2026-05-23

### Decision 1: Express Router for route organization
- **Choice:** Separate router file (`routes/timeCards.js`)
- **Rationale:** Better organization, easier to test, follows Express best practices
- **Alternative considered:** All routes in server.js (cluttered)

### Decision 2: Fuzzy worksite matching with ILIKE
- **Choice:** Use PostgreSQL `ILIKE` with wildcards: `ILIKE '%${extracted.worksite}%'`
- **Rationale:** Handles variations ("Simons" matches "Simons Property"), case-insensitive
- **Alternative considered:** Exact match (too strict), separate fuzzy matching service (over-engineering)

### Decision 3: 201 Created for POST, 200 OK for GET
- **Choice:** RESTful status codes
- **Rationale:** Standard HTTP semantics, clear intent
- **Alternative considered:** Always 200 (less semantic)

### Decision 4: Central error handler middleware
- **Choice:** Express error middleware at end of server.js
- **Rationale:** Consistent error responses, logging in one place, catch all errors
- **Alternative considered:** Try/catch in each route (repetitive)

### Decision 5: Integration tests mock services, not HTTP
- **Choice:** Tests still use mocked OpenAI/Supabase (via service layer)
- **Rationale:** Fast tests, no external dependencies, deterministic
- **Alternative considered:** Real database in tests (slow, needs setup)

### Decision 6: Global test setup file with vitest.config.js
- **Choice:** Central `tests/setup.js` loaded via vitest config
- **Rationale:** DRY - single mock definition for all tests, no duplication
- **Alternative considered:** Per-file mocks (repetitive, harder to maintain)

### Decision 7: Insert with select chaining pattern
- **Choice:** Mock must support `.insert(data).select().single()` chain
- **Rationale:** Matches Supabase's fluent API, returns inserted record
- **Implementation:** Insert saves data, subsequent select/single returns it with generated ID

## Task 7: Frontend Project Setup

**Date:** 2026-05-23

### Decision 1: Vite over Create React App
- **Choice:** Vite for build tooling
- **Rationale:** Much faster dev server, faster builds, modern ESM-based, better DX
- **Alternative considered:** Create React App (slower, deprecated), Next.js (overkill for PWA)

### Decision 2: Tailwind CSS for styling
- **Choice:** Tailwind utility-first CSS
- **Rationale:** Fast prototyping, consistent design, small bundle size, mobile-first
- **Alternative considered:** CSS-in-JS (runtime cost), Bootstrap (less flexible)

### Decision 3: Vitest over Jest for frontend
- **Choice:** Vitest for testing
- **Rationale:** Native Vite integration, faster, better ESM support, same API as Jest
- **Alternative considered:** Jest (requires complex config for Vite)

### Decision 4: Custom action type colors
- **Choice:** Defined 4 action colors in Tailwind config
- **Rationale:** Consistent with design mockups, easy to reference, semantic naming
- **Colors:**
  - IN: Teal (#00897b)
  - OUT: Green (#28a745)
  - HOURS: Blue (#0288d1)
  - OFF: Orange (#f57c00)

## Task 8: Worker UI Component

**Date:** 2026-05-23

### Decision 1: Component composition over monolithic UI
- **Choice:** Separate WorkerUI and RecordButton components
- **Rationale:** Better testability, reusability, single responsibility principle
- **Alternative considered:** Single giant component (hard to test/maintain)

### Decision 2: useState for local state management
- **Choice:** React useState hooks, no Redux/Zustand yet
- **Rationale:** Simple state, contained to one screen, no cross-component sharing needed
- **Alternative considered:** Context API (overkill), Redux (over-engineering for MVP)

### Decision 3: Mock recording for now
- **Choice:** RecordButton simulates with setTimeout, returns mock data
- **Rationale:** Focus on UI/UX first, real audio recording is Phase 2
- **Alternative considered:** Implement MediaRecorder now (scope creep)

### Decision 4: Swipe dots not swipe gesture
- **Choice:** Clickable dots for screen navigation
- **Rationale:** Easier to implement, works on desktop too, better accessibility
- **Alternative considered:** Touch swipe gestures (more complex, mobile-only, harder to test)

### Decision 5: Large touch targets for field use
- **Choice:** 80px (20x20) record button, large text (text-lg/text-base)
- **Rationale:** Easy to tap with gloves, readable in sunlight on construction sites
- **Alternative considered:** Smaller UI (harder to use in field conditions)

### Decision 6: Tailwind v4 with @tailwindcss/postcss
- **Choice:** Upgraded to Tailwind v4, installed separate PostCSS plugin
- **Rationale:** Tailwind v4 split PostCSS functionality into separate package
- **Alternative considered:** Downgrade to v3 (miss new features)
