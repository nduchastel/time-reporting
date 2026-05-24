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
