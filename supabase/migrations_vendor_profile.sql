-- Vendor profile: name, brief, pricing (editable by admin; shown on user home).
CREATE TABLE IF NOT EXISTS vendor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brief TEXT,
  pricing_details TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- One row for Pro fab
INSERT INTO vendor_profiles (slug, name, brief, pricing_details)
VALUES (
  'profab',
  'Pro Fab Power Launders',
  'Pro Fab Power Launders is our campus laundry partner. We pick up from your hostel, wash & iron, and deliver back on the same cycle. Service days: Tuesday, Saturday, Sunday.',
  'Shirt / T-shirt: ₹19 | White shirt / White T-shirt: ₹25 | Pant / Jean: ₹22 | White pants / White jean: ₹25 | Dry clean (shirt/T-shirt): ₹50 | Dry clean (white/formal): ₹60. Convenience fee: ₹20 per order.'
)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE vendor_profiles ENABLE ROW LEVEL SECURITY;

-- Public can read (for user app)
CREATE POLICY "vendor_profiles_select_public" ON vendor_profiles FOR SELECT TO public USING (true);

-- Only service role can insert/update (admin API uses service role)
CREATE POLICY "vendor_profiles_service_all" ON vendor_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
