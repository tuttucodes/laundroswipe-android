-- Run this in Supabase SQL Editor after master.sql (adds saved bills for vendor page)
CREATE TABLE IF NOT EXISTS vendor_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_token TEXT NOT NULL,
  order_number TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  line_items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  convenience_fee DECIMAL(12,2) NOT NULL DEFAULT 20,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_bills_created_at ON vendor_bills(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_bills_order_token ON vendor_bills(order_token);

ALTER TABLE vendor_bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendor_bills_insert" ON vendor_bills;
DROP POLICY IF EXISTS "vendor_bills_select" ON vendor_bills;
CREATE POLICY "vendor_bills_insert" ON vendor_bills FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "vendor_bills_select" ON vendor_bills FOR SELECT TO public USING (true);
