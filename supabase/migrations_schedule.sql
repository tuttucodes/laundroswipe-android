-- Schedule config: slots (definitions) and dates (which dates + which slots per date).
-- Run in Supabase SQL Editor after master.sql. App reads these; admin writes via API (service role).

-- Slots: id, label, time range, order, active
CREATE TABLE IF NOT EXISTS schedule_slots (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  time_from TIME NOT NULL,
  time_to TIME NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Dates: which dates are bookable and which slot ids are available that day
CREATE TABLE IF NOT EXISTS schedule_dates (
  date DATE PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  slot_ids JSONB NOT NULL DEFAULT '[]',  -- e.g. ["evening"] or ["afternoon","evening"]
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_slots_active ON schedule_slots(active);
CREATE INDEX IF NOT EXISTS idx_schedule_dates_enabled ON schedule_dates(enabled) WHERE enabled = true;

-- RLS: public read (app + admin); write via service role only (admin API uses service role)
ALTER TABLE schedule_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule_slots_select" ON schedule_slots;
DROP POLICY IF EXISTS "schedule_dates_select" ON schedule_dates;

CREATE POLICY "schedule_slots_select" ON schedule_slots FOR SELECT TO public USING (true);
CREATE POLICY "schedule_dates_select" ON schedule_dates FOR SELECT TO public USING (true);

-- No INSERT/UPDATE/DELETE for anon/auth; admin uses service role in API route.

-- Updated_at trigger for schedule_dates
DROP TRIGGER IF EXISTS schedule_dates_updated_at ON schedule_dates;
CREATE TRIGGER schedule_dates_updated_at
  BEFORE UPDATE ON schedule_dates
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- Seed default slots (match current app: afternoon, evening)
INSERT INTO schedule_slots (id, label, time_from, time_to, sort_order, active) VALUES
  ('afternoon', 'Afternoon (12–4 PM)', '12:00', '16:00', 1, true),
  ('evening', 'Evening (4:45–5:45 PM)', '16:45', '17:45', 2, true)
ON CONFLICT (id) DO NOTHING;

-- Seed default dates: Mar 15 and 18 (current year), evening only
INSERT INTO schedule_dates (date, enabled, slot_ids)
SELECT d, true, '["evening"]'::jsonb
FROM generate_series(
  (date_trunc('year', current_date) + interval '2 months 14 days')::date,
  (date_trunc('year', current_date) + interval '2 months 17 days')::date,
  interval '3 days'
) AS t(d)
-- DO NOT use DO UPDATE here: re-running this script would replace vendor-shaped slot_ids (json object) with a flat array and break per-vendor booking.
ON CONFLICT (date) DO NOTHING;
