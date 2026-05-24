-- Workers table
CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'fr', 'es')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  disabled_range JSONB,
  custom_rules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Worksites table
CREATE TABLE worksites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  client TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  disabled_range JSONB,
  custom_rules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Time cards table
CREATE TABLE time_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id),
  worksite_id UUID REFERENCES worksites(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('IN', 'OUT', 'HOURS', 'OFF')),
  date DATE NOT NULL,
  hours NUMERIC(5,2),
  start_time TIME,
  end_time TIME,
  transcription TEXT NOT NULL,
  audio_url TEXT,
  extracted_data JSONB NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'edited', 'flagged')),
  notes TEXT,
  approved_by UUID REFERENCES workers(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_time_cards_worker_id ON time_cards(worker_id);
CREATE INDEX idx_time_cards_worksite_id ON time_cards(worksite_id);
CREATE INDEX idx_time_cards_date ON time_cards(date);
CREATE INDEX idx_time_cards_status ON time_cards(status);
CREATE INDEX idx_time_cards_created_at ON time_cards(created_at);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_worksites_updated_at BEFORE UPDATE ON worksites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_cards_updated_at BEFORE UPDATE ON time_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
