import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// TEST_MODE=1 swaps the real Supabase client for the in-memory fake. Used by Playwright + smoke E2E
// when the server is started as a regular Node process. Refuses to mount in production.
const useTestFake = process.env.TEST_MODE === '1' && process.env.NODE_ENV !== 'production';

let supabase;
let supabaseAdmin;

if (useTestFake) {
  const fake = await import('../../tests/fakes/fakeSupabase.js');
  supabase = fake.supabase;
  supabaseAdmin = fake.supabaseAdmin;
} else {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase credentials in environment variables');
  }

  // The backend is a trusted server that performs its own authorization
  // (requireAuth + role checks). Phase 4 enables Supabase RLS as defense-in-depth:
  // tables are default-deny for the anon/authenticated roles, so a leaked anon key
  // is useless. The server therefore connects with the service-role key (which
  // bypasses RLS) for its primary client. If the service key is missing we fall
  // back to anon and warn — RLS must NOT be enabled in that configuration or the
  // app will be locked out of its own database.
  const primaryKey = supabaseServiceKey || supabaseAnonKey;
  if (!supabaseServiceKey) {
    console.warn('[supabase] SUPABASE_SERVICE_ROLE_KEY not set — using anon key. Do not enable RLS (migration 004) without the service-role key.');
  }
  supabase = createClient(supabaseUrl, primaryKey, { auth: { persistSession: false } });
  supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
    : supabase;
}

export { supabase, supabaseAdmin };
