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
