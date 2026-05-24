# Database Setup

## Initial Setup

1. Create a Supabase project at https://supabase.com
2. Copy your project URL and anon key
3. Create `.env` file in backend/ directory:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```

## Run Migration

1. Log into Supabase dashboard
2. Go to SQL Editor
3. Copy/paste content from `migrations/001_initial_schema.sql`
4. Click "Run"
5. Verify tables in Table Editor

## Seed Database

```bash
cd backend
node src/db/seed.js
```

Expected output: "Database seeded successfully" with worker and worksites data
