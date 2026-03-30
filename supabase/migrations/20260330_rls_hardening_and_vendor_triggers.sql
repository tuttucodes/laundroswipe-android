-- =============================================================================
-- LaundroSwipe: RLS hardening + vendor_id triggers
-- Goal: prevent public/anon access to sensitive user/order/bill data.
-- Admin/vendor back-office now uses service-role API routes (bypassing RLS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- USERS: allow auth to read/update own; allow auth to insert its own row.
-- -----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_insert ON public.users;
DROP POLICY IF EXISTS users_select_all ON public.users;

DROP POLICY IF EXISTS users_select_own ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;

CREATE POLICY users_insert_authenticated ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = auth_id);

CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = auth_id);

CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

-- -----------------------------------------------------------------------------
-- STUDENTS: lock down (not used heavily by the current app)
-- -----------------------------------------------------------------------------
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS students_insert ON public.students;
DROP POLICY IF EXISTS students_select ON public.students;

CREATE POLICY students_select_own ON public.students
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- -----------------------------------------------------------------------------
-- ORDERS: allow insert/select/update only for the owning authenticated user.
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_insert ON public.orders;
DROP POLICY IF EXISTS orders_select_all ON public.orders;
DROP POLICY IF EXISTS orders_select_own ON public.orders;
DROP POLICY IF EXISTS orders_update ON public.orders;

CREATE POLICY orders_insert_authenticated ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY orders_select_own ON public.orders
  FOR SELECT TO authenticated
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY orders_update_own ON public.orders
  FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- ADMINS table: remove public visibility.
-- Back-office authentication uses admin_login RPC with service role.
-- -----------------------------------------------------------------------------
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admins_select ON public.admins;

-- -----------------------------------------------------------------------------
-- ORDER STATUS HISTORY: restrict (currently not heavily used by UI).
-- -----------------------------------------------------------------------------
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_status_history_insert ON public.order_status_history;
DROP POLICY IF EXISTS order_status_history_select ON public.order_status_history;

CREATE POLICY order_status_history_select_own ON public.order_status_history
  FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT o.id
      FROM public.orders o
      WHERE o.user_id IN (SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- VENDOR BILLS: allow authenticated users to read only their own bills.
-- -----------------------------------------------------------------------------
ALTER TABLE public.vendor_bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vendor_bills_insert ON public.vendor_bills;
DROP POLICY IF EXISTS vendor_bills_select ON public.vendor_bills;

CREATE POLICY vendor_bills_select_own ON public.vendor_bills
  FOR SELECT TO authenticated
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- Triggers: keep orders.vendor_id and vendor_bills.vendor_id populated.
-- These are best-effort to make vendor assignment consistent even for
-- future inserts.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_orders_vendor_id_from_vendor_name()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.vendor_id IS NULL THEN
    SELECT v.id
      INTO NEW.vendor_id
    FROM public.vendors v
    WHERE lower(COALESCE(NEW.vendor_name, '')) LIKE '%' || lower(v.name) || '%'
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_vendor_id ON public.orders;
CREATE TRIGGER trg_orders_vendor_id
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE PROCEDURE public.set_orders_vendor_id_from_vendor_name();

CREATE OR REPLACE FUNCTION public.set_vendor_bills_vendor_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  vid uuid;
BEGIN
  IF NEW.vendor_id IS NULL THEN
    IF NEW.order_id IS NOT NULL THEN
      SELECT o.vendor_id INTO vid
      FROM public.orders o
      WHERE o.id = NEW.order_id;
      NEW.vendor_id := vid;
    END IF;
  END IF;

  IF NEW.vendor_id IS NULL AND NEW.vendor_name IS NOT NULL THEN
    SELECT v.id INTO vid
    FROM public.vendors v
    WHERE lower(NEW.vendor_name) LIKE '%' || lower(v.name) || '%'
    LIMIT 1;
    NEW.vendor_id := vid;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_bills_vendor_id ON public.vendor_bills;
CREATE TRIGGER trg_vendor_bills_vendor_id
BEFORE INSERT ON public.vendor_bills
FOR EACH ROW
EXECUTE PROCEDURE public.set_vendor_bills_vendor_id();

