-- =============================================================================
-- LaundroSwipe: waitlist table
-- app/api/waitlist/route.ts inserts into `waitlist`
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT,
  email TEXT NOT NULL,
  city TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_city ON public.waitlist(city);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS waitlist_insert_public ON public.waitlist;

CREATE POLICY waitlist_insert_public ON public.waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

