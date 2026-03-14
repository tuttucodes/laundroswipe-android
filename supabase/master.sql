-- =============================================================================
-- LAUNDROSWIPE — MASTER SUPABASE SCHEMA
-- Run this once in Supabase SQL Editor (e.g. after a DB reset).
-- Column names match the Next.js app (users.*, orders.*) so the app works as-is.
--
-- To reset and re-run: Supabase Dashboard → SQL Editor → run this file.
-- If tables already exist, run as-is (IF NOT EXISTS / ON CONFLICT keep it safe).
-- To fully reset: Database → delete tables in reverse order, then run this file.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. COLLEGES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS colleges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_code TEXT UNIQUE NOT NULL,
  city TEXT,
  state TEXT,
  pickup_points JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. ADMINS (who can use /admin dashboard)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional: link to Supabase Auth
-- ALTER TABLE admins ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users (id);

-- -----------------------------------------------------------------------------
-- 3. USERS (app expects: full_name, email, phone, whatsapp, user_type, college_id, reg_no, hostel_block, year)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  user_type TEXT NOT NULL DEFAULT 'general' CHECK (user_type IN ('general', 'student')),
  college_id UUID REFERENCES colleges(id),
  reg_no TEXT,
  hostel_block TEXT,
  year SMALLINT CHECK (year IS NULL OR (year >= 1 AND year <= 5)),
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4. STUDENTS (optional extension; app can store student info on users for now)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  registration_number TEXT NOT NULL,
  college_id UUID REFERENCES colleges(id),
  hostel_block TEXT,
  room_number TEXT,
  year_of_study SMALLINT CHECK (year_of_study BETWEEN 1 AND 5),
  student_id_image_url TEXT,
  is_student_verified BOOLEAN DEFAULT false
);

-- -----------------------------------------------------------------------------
-- 5. ORDERS (app expects: order_number, token, service_id, service_name, pickup_date, time_slot, status, instructions, user_id)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  token TEXT NOT NULL,
  service_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  pickup_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  instructions TEXT,
  vendor_name TEXT DEFAULT 'Pro Fab Power Laundry Services',
  convenience_fee DECIMAL(10,2) DEFAULT 20.00,
  payment_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_token ON orders(token);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- -----------------------------------------------------------------------------
-- 6. ORDER STATUS HISTORY (optional audit trail)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 7. UPDATED_AT TRIGGERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. SEED DATA (run once; safe to re-run due to ON CONFLICT)
-- -----------------------------------------------------------------------------
INSERT INTO admins (email, display_name)
VALUES ('you@laundroswipe.com', 'Main Admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO colleges (name, short_code, city, state, is_active) VALUES
  ('VIT Chennai', 'VIT_CHN', 'Chennai', 'Tamil Nadu', true),
  ('VIT Vellore', 'VIT_VLR', 'Vellore', 'Tamil Nadu', false),
  ('VIT AP', 'VIT_AP', 'Amaravati', 'Andhra Pradesh', false),
  ('VIT Bhopal', 'VIT_BPL', 'Bhopal', 'Madhya Pradesh', false),
  ('SRM KTR', 'SRM_KTR', 'Kattankulathur', 'Tamil Nadu', false),
  ('SRM VDP', 'SRM_VDP', 'Vadapalani', 'Tamil Nadu', false),
  ('SRM Ramapuram', 'SRM_RMP', 'Chennai', 'Tamil Nadu', false),
  ('Tagore Medical College', 'TMC', 'Chennai', 'Tamil Nadu', false),
  ('Hindustan Engineering College', 'HEC', 'Chennai', 'Tamil Nadu', false)
ON CONFLICT (short_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS)
-- One consistent set: anon can insert/read for app + admin; auth users get own-data.
-- -----------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Drop any old policies that might conflict (run once if you had previous policies)
DROP POLICY IF EXISTS "Users read own data" ON users;
DROP POLICY IF EXISTS "Users update own data" ON users;
DROP POLICY IF EXISTS "Students read own data" ON students;
DROP POLICY IF EXISTS "Users read own orders" ON orders;
DROP POLICY IF EXISTS "Users create orders" ON orders;
DROP POLICY IF EXISTS "Anyone reads colleges" ON colleges;
DROP POLICY IF EXISTS "public_can_insert_users" ON users;
DROP POLICY IF EXISTS "public_can_insert_orders" ON orders;
DROP POLICY IF EXISTS "public_can_read_orders" ON orders;

-- Users: anon can insert (signup) and read all (admin dashboard); auth can read/update own
CREATE POLICY "users_insert" ON users FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "users_select_all" ON users FOR SELECT TO public USING (true);
CREATE POLICY "users_select_own" ON users FOR SELECT TO authenticated USING (auth.uid() = auth_id);
CREATE POLICY "users_update_own" ON users FOR UPDATE TO authenticated USING (auth.uid() = auth_id);

-- Students: anon can insert; auth can read own
CREATE POLICY "students_insert" ON students FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "students_select" ON students FOR SELECT TO public USING (
  id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR auth.uid() IS NULL
);

-- Orders: anon can insert and read all (admin); auth can read own
CREATE POLICY "orders_insert" ON orders FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "orders_select_all" ON orders FOR SELECT TO public USING (true);
CREATE POLICY "orders_select_own" ON orders FOR SELECT TO authenticated USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "orders_update" ON orders FOR UPDATE TO public USING (true);

-- Colleges: anyone can read
CREATE POLICY "colleges_select" ON colleges FOR SELECT TO public USING (true);

-- Admins: anyone can read (app checks email for admin login)
CREATE POLICY "admins_select" ON admins FOR SELECT TO public USING (true);

-- Order status history: allow insert and read for app/admin
CREATE POLICY "order_status_history_insert" ON order_status_history FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "order_status_history_select" ON order_status_history FOR SELECT TO public USING (true);

-- =============================================================================
-- AFTER RUNNING: Update admins seed email to your real admin email, then
-- set ADMIN_EMAIL and ADMIN_PASSWORD in Vercel/env for /admin login.
-- =============================================================================
