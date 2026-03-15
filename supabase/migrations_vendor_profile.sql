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

-- One row for Pro fab (pricing in ₹; dc = dry clean)
INSERT INTO vendor_profiles (slug, name, brief, pricing_details)
VALUES (
  'profab',
  'Pro Fab Power Launders',
  'Pro Fab Power Launders is our campus laundry partner. We pick up from your hostel, wash & iron, and deliver back on the same cycle. Service days: Tuesday, Saturday, Sunday.',
  E'Shirt ₹19\nT shirt ₹19\nWhite shirt ₹25\nWhite t shirt ₹25\nShirt dc ₹50\nT-shirts dc ₹50\nWhite shirt dc ₹60\nWhite t shirt dc ₹60\nWhite pants ₹25\nWhite pants dc ₹60\nWhite jean ₹25\nWhite jean dc ₹60\nPant ₹22\nPant dc ₹50\nJean ₹22\nJeans dc ₹50\nBedsheet ₹30\nBedsheet dc ₹60\nPillow cover ₹15\nPillow cover dc ₹30\nHoodie ₹50\nHoodie dc ₹80\nJacket ₹50\nJacket dc ₹80\nShorts ₹18\nShorts dc ₹40\nShoe wash ₹150\nBlanket big dc ₹110\nBlanket small dc ₹90\nQuilt dc ₹130\nTrack pant ₹19\nTrack pant dc ₹50\nWhite track pant ₹25\nWhite track pant dc ₹60\nTowel ₹20\nTowel dc ₹40\nTurkish towel ₹25\nTurkish towel dc ₹40\nHand towel ₹12\nHand towel dc ₹22\nDhoti ₹50\nDhoti dc ₹80\nKurtha ₹50\nKurtha dc ₹80\nOnly ironing ₹10\nLadies top ₹25\nLadies top dc ₹60\nLeggings ₹20\nLeggings dc ₹50\nBedsheet heavy ₹40\nWhite bedsheet ₹40\nDupatta ₹22\nDupatta dc ₹40\nCap ₹25\nCap dc ₹40\nBag wash ₹150\nJeans ₹22\n\nConvenience fee: ₹20 per order.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  brief = EXCLUDED.brief,
  pricing_details = EXCLUDED.pricing_details,
  updated_at = now();

ALTER TABLE vendor_profiles ENABLE ROW LEVEL SECURITY;

-- Public can read (for user app)
CREATE POLICY "vendor_profiles_select_public" ON vendor_profiles FOR SELECT TO public USING (true);

-- Only service role can insert/update (admin API uses service role)
CREATE POLICY "vendor_profiles_service_all" ON vendor_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
