-- backend/src/db/migrations/004_phase4_rls.sql
-- Phase 4 (A5): Row-Level Security as defense-in-depth.
--
-- The backend authorizes every request itself (requireAuth + role checks) and
-- connects to Supabase with the SERVICE-ROLE key, which BYPASSES RLS. Enabling
-- RLS here therefore does NOT change how the API behaves — it locks out the
-- anon/authenticated roles so that a leaked anon key (e.g. shipped in a client
-- bundle) cannot read or write these tables directly.
--
-- ⚠️ DEPLOY ORDER MATTERS: set SUPABASE_SERVICE_ROLE_KEY in the backend BEFORE
-- applying this migration. With RLS on and no service-role key, the API (running
-- as anon) would be denied access to its own database. See docs/database-schema.md.

ALTER TABLE workers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE worksites  ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_cards ENABLE ROW LEVEL SECURITY;

-- No policies are defined for the anon/authenticated roles. With RLS enabled and
-- no permissive policy, those roles are denied by default — exactly what we want.
-- The service_role used by the backend has the BYPASSRLS attribute, so it is
-- unaffected. If a future feature lets browsers talk to Supabase directly with a
-- user JWT, add scoped policies (e.g. workers may select their own time_cards)
-- here at that time.
