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

  supabase = createClient(supabaseUrl, supabaseAnonKey);
  supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
    : supabase;
}

export { supabase, supabaseAdmin };
