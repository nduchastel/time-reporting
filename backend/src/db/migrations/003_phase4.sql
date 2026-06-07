-- backend/src/db/migrations/003_phase4.sql
-- Phase 4 schema bundle: credential lifecycle, per-worker panel visibility, worksite archiving.
-- Apply after 002. All columns are additive with safe defaults so existing rows keep working.

-- Credential lifecycle (Group F): a user with this flag must replace their
-- temporary PIN/password on first login before doing anything else.
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS must_change_credential BOOLEAN NOT NULL DEFAULT false;

-- Per-worker panel visibility (Group D): which action panels a worker sees.
-- Defaults to all four; app-level validation enforces "at least one".
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS visible_panels TEXT[] NOT NULL DEFAULT '{IN,OUT,HOURS,OFF}';

-- Worksite archiving (Group G): worksites are referenced by time_cards, so we
-- archive instead of deleting. 001 already created worksites.status with a
-- CHECK of ('active','disabled'); Phase 4 standardizes on 'archived'. Widen the
-- CHECK to accept both 'disabled' (legacy) and 'archived' (new).
ALTER TABLE worksites
  DROP CONSTRAINT IF EXISTS worksites_status_check;
ALTER TABLE worksites
  ADD CONSTRAINT worksites_status_check CHECK (status IN ('active', 'archived', 'disabled'));
