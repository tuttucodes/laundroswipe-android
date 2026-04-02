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

ALTER TABLE public.vendor_profiles
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Seed vendor profiles shown in the user app.
INSERT INTO vendor_profiles (slug, name, brief, pricing_details, logo_url)
VALUES (
  'profab',
  'Pro Fab Power Launders',
  'Pro Fab Power Launders is our campus laundry partner. We pick up from your hostel, wash & iron, and deliver back on the same cycle. Service days: Tuesday, Saturday, Sunday.',
  E'Item-wise Price List\n\nPant - ₹22\nPant DC - ₹50\nJeans - ₹22\nJeans DC - ₹50\nWhite Pant - ₹25\nWhite Pant DC - ₹60\nWhite Jeans - ₹25\nWhite Jeans DC - ₹60\nShirt - ₹22\nShirt DC - ₹50\nT-Shirt - ₹22\nT-Shirt DC - ₹50\nWhite Shirt - ₹25\nWhite Shirt DC - ₹60\nWhite T-Shirt - ₹25\nWhite T-Shirt DC - ₹60\nShorts - ₹16\nShorts DC - ₹40\nLungi - ₹20\nLungi DC - ₹50\nTowel - ₹18\nTowel DC - ₹40\nBed Sheet - ₹25\nBed Sheet DC - ₹60\nHand Towel - ₹8\nHand Towel DC - ₹20\nPillow Cover - ₹12\nPillow Cover DC - ₹30\nDhoti - ₹40\nDhoti DC - ₹60\nBlanket (Small) - ₹90\nBlanket (Small) DC - ₹110\nBlanket (Big) - ₹100\nBlanket (Big) DC - ₹120\nLab Coat - ₹25\nLab Coat DC - ₹60\nQuilt - ₹120\nQuilt DC - ₹150\nJacket - ₹50\nJacket DC - ₹100\nHoodie - ₹50\nHoodie DC - ₹100\nKurta - ₹50\nKurta DC - ₹100\nTrack Pant - ₹22\nTrack Pant DC - ₹40\nBag - ₹150\nShoe - ₹70\nShoe DC - ₹150\nOnly Iron - ₹10\nLadies Top - ₹25\nLadies Top DC - ₹60\nLadies Bottom - ₹22\nLadies Bottom DC - ₹50\nShawl - ₹18\nShawl DC - ₹40\nSaree - ₹70\nSaree DC - ₹150\nFancy Dress DC - ₹100\nBlazer DC - ₹150',
  '/profab-logo.png'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  brief = EXCLUDED.brief,
  pricing_details = EXCLUDED.pricing_details,
  logo_url = EXCLUDED.logo_url,
  updated_at = now();

INSERT INTO vendor_profiles (slug, name, brief, pricing_details, logo_url)
VALUES (
  'starwash',
  'Star Wash Power Launderers',
  'Star Wash serves VIT Chennai students in B, C, and E blocks with scheduled campus pickup and return.',
  E'Pricing is shared by the vendor at billing time.\n\nService fee is added separately based on the final bill subtotal.',
  NULL
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  brief = EXCLUDED.brief,
  pricing_details = EXCLUDED.pricing_details,
  logo_url = EXCLUDED.logo_url,
  updated_at = now();

ALTER TABLE vendor_profiles ENABLE ROW LEVEL SECURITY;

-- Public can read (for user app)
DROP POLICY IF EXISTS "vendor_profiles_select_public" ON vendor_profiles;
CREATE POLICY "vendor_profiles_select_public" ON vendor_profiles FOR SELECT TO public USING (true);

-- Only service role can insert/update (admin API uses service role)
DROP POLICY IF EXISTS "vendor_profiles_service_all" ON vendor_profiles;
CREATE POLICY "vendor_profiles_service_all" ON vendor_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
