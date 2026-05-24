-- backend/src/db/migrations/002_phase3_auth_and_indexes.sql

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS role          TEXT NOT NULL DEFAULT 'worker'
    CHECK (role IN ('worker', 'manager', 'admin')),
  ADD COLUMN IF NOT EXISTS username      TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS pin           TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workers_username ON workers(username) WHERE username IS NOT NULL;
CREATE INDEX        IF NOT EXISTS idx_workers_role     ON workers(role);
CREATE INDEX        IF NOT EXISTS idx_workers_phone    ON workers(phone)    WHERE phone IS NOT NULL;

-- Composite index for "pending queue" manager dashboard query
CREATE INDEX IF NOT EXISTS idx_time_cards_status_created_at
  ON time_cards(status, created_at DESC);
