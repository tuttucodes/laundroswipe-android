-- Run after master.sql and vendor_bills.sql
-- Adds: user display_id, order delivery confirmation, vendor_bills.user_id, unique token

-- 1. User display ID (unique number for bills and admin lookup)
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_id TEXT UNIQUE;
CREATE SEQUENCE IF NOT EXISTS user_display_id_seq START 1001;
-- Backfill: assign LS-1001, LS-1002, ... by created_at
DO $$
DECLARE
  r RECORD;
  n INT := 1000;
BEGIN
  FOR r IN (SELECT id FROM users ORDER BY created_at) LOOP
    n := n + 1;
    UPDATE users SET display_id = 'LS-' || n::TEXT WHERE id = r.id AND (display_id IS NULL OR display_id = '');
  END LOOP;
  PERFORM setval('user_display_id_seq', n + 1);
END $$;
CREATE OR REPLACE FUNCTION set_user_display_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.display_id IS NULL OR NEW.display_id = '' THEN
    NEW.display_id := 'LS-' || nextval('user_display_id_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS set_user_display_id_trigger ON users;
CREATE TRIGGER set_user_display_id_trigger BEFORE INSERT ON users
  FOR EACH ROW EXECUTE PROCEDURE set_user_display_id();

-- 2. Order delivery confirmation (user confirms they received items)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_comments TEXT;

-- 3. Unique token per order (prevents duplicate tokens)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_token_unique ON orders(token);

-- 4. Link bills to user for "My bills"
ALTER TABLE vendor_bills ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_bills_user_id ON vendor_bills(user_id);
