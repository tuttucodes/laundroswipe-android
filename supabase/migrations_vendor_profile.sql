-- Vendor profile: name, brief, pricing (editable by admin; shown on user home).
CREATE TABLE IF NOT EXISTS vendor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brief TEXT,
  pricing_details TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- One row for Pro fab (pricing in ₹; dc = dry clean)
INSERT INTO vendor_profiles (slug, name, brief, pricing_details)
VALUES (
  'profab',
  'Pro Fab Power Launders',
  'Pro Fab Power Launders is our campus laundry partner. We pick up from your hostel, wash & iron, and deliver back on the same cycle. Service days: Tuesday, Saturday, Sunday.',
  E'Shirt ₹19\nT shirt ₹19\nWhite shirt ₹25\nWhite t shirt ₹25\nPant ₹22\nJean ₹22\nDry clean (shirt/T-shirt) ₹50\nDry clean (white/formal) ₹60\n\nService fee is added separately based on the final bill subtotal.\nService fee helps cover LaundroSwipe''s order support, pickup coordination, tracking, notifications, and billing management. Laundry charges are set separately by the vendor.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  brief = EXCLUDED.brief,
  pricing_details = EXCLUDED.pricing_details,
  updated_at = now();

ALTER TABLE public.vendor_profiles
ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE vendor_profiles ENABLE ROW LEVEL SECURITY;

-- Public can read (for user app)
CREATE POLICY "vendor_profiles_select_public" ON vendor_profiles FOR SELECT TO public USING (true);

-- Only service role can insert/update (admin API uses service role)
CREATE POLICY "vendor_profiles_service_all" ON vendor_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
