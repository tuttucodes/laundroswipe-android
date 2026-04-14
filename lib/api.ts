import { supabase, hasSupabase } from './supabase';
import { orderLookupTokenVariants, stripLeadingHashesFromToken } from './vendor-bill-token';

export type VendorCatalogRow = {
  slug: string;
  name: string;
  profile_name: string | null;
  logo_url: string | null;
  brief: string | null;
};

export type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  user_type: string | null;
  college_id: string | null;
  reg_no: string | null;
  hostel_block: string | null;
  room_number: string | null;
  year: number | null;
  display_id?: string | null;
  terms_accepted_at?: string | null;
  terms_version?: string | null;
};

export type OrderRow = {
  id: string;
  order_number: string;
  token: string;
  service_id: string;
  service_name: string;
  pickup_date: string;
  time_slot: string;
  status: string;
  instructions: string | null;
  user_id: string | null;
  vendor_name?: string | null;
  vendor_id?: string | null;
  created_at: string;
  delivery_confirmed_at?: string | null;
  delivery_comments?: string | null;
};

export type ScheduleSlotRow = {
  id: string;
  label: string;
  time_from: string;
  time_to: string;
  sort_order: number;
  active: boolean;
  created_at?: string;
};

export type ScheduleDateRow = {
  date: string;
  enabled: boolean;
  slot_ids: string[];
  enabled_by_vendor?: Record<string, boolean> | null;
  created_at?: string;
  updated_at?: string;
};

export type UserNotificationRow = {
  id: string;
  user_id: string | null;
  title: string;
  body: string | null;
  sent_at: string | null;
  scheduled_at: string | null;
  read_at: string | null;
  created_at: string;
};

export const LSApi = {
  hasSupabase,

  async createUser(user: {
    fn: string;
    em: string;
    ph: string;
    wa: string;
    ut: string;
    cid?: string | null;
    rn?: string | null;
    hos?: string | null;
    rm?: string | null;
    yr?: number | null;
  }): Promise<{ user: UserRow | null; error?: string }> {
    if (!supabase) return { user: null, error: 'Not connected' };
    try {
      const { data, error } = await supabase
        .from('users')
        .insert({
          full_name: user.fn,
          email: user.em,
          phone: user.ph,
          whatsapp: user.wa,
          user_type: user.ut,
          college_id: user.cid ?? null,
          reg_no: user.rn ?? null,
          hostel_block: user.hos ?? null,
          room_number: user.rm ?? null,
          year: user.yr ?? null,
        })
        .select()
        .single();
      if (error) {
        console.error('Supabase createUser error', error);
        const msg = error.code === '23505' ? 'Email or phone already registered' : error.message || 'Sign up failed';
        return { user: null, error: msg };
      }
      return { user: data as UserRow };
    } catch (e) {
      console.error('Supabase createUser exception', e);
      return { user: null, error: 'Sign up failed' };
    }
  },

  async updateUser(
    userId: string,
    updates: {
      full_name?: string;
      email?: string;
      phone?: string;
      whatsapp?: string;
      user_type?: string;
      college_id?: string | null;
      reg_no?: string | null;
      hostel_block?: string | null;
      room_number?: string | null;
      year?: number | null;
    }
  ): Promise<{ user: UserRow | null; error?: string }> {
    if (!supabase) return { user: null, error: 'Not connected' };
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      if (error) {
        console.error('Supabase updateUser error', error);
        return { user: null, error: error.message || 'Update failed' };
      }
      return { user: data as UserRow };
    } catch (e) {
      console.error('Supabase updateUser exception', e);
      return { user: null, error: (e as Error)?.message || 'Update failed' };
    }
  },

  async fetchVendorCatalog(campusId: string): Promise<VendorCatalogRow[] | null> {
    try {
      const res = await fetch(`/api/vendors/catalog?campus_id=${encodeURIComponent(campusId)}`);
      const data = (await res.json().catch(() => ({}))) as { vendors?: VendorCatalogRow[]; error?: string };
      if (!res.ok) return null;
      return Array.isArray(data.vendors) ? data.vendors : [];
    } catch (e) {
      console.error('fetchVendorCatalog exception', e);
      return null;
    }
  },

  async createOrder(
    order: {
      on: string;
      tk: string;
      svc: string;
      sl: string;
      pd: string;
      ts: string;
      status: string;
      ins?: string;
      vendorName?: string;
      vendorSlug?: string;
      campusId?: string;
    },
    userId: string
  ): Promise<{ order: OrderRow | null; error?: string; code?: string }> {
    if (!supabase) return { order: null, error: 'Not connected' };
    try {
      const session = await this.getAuthSession();
      const accessToken = (session as { access_token?: string } | null)?.access_token;
      if (!accessToken) return { order: null, error: 'Sign in required' };
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ...order,
          userId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        return {
          order: null,
          error: data?.error || 'Order failed',
          code: data?.code,
        };
      }
      return { order: data.order as OrderRow };
    } catch (e) {
      console.error('createOrder exception', e);
      return { order: null, error: (e as Error)?.message || 'Order failed' };
    }
  },

  async fetchOrders(): Promise<OrderRow[] | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, token, service_id, service_name, pickup_date, time_slot, status, instructions, user_id, vendor_name, vendor_id, created_at, delivery_confirmed_at, delivery_comments')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) {
        console.error('Supabase fetchOrders error', error);
        return null;
      }
      return (data ?? []) as OrderRow[];
    } catch (e) {
      console.error('Supabase fetchOrders exception', e);
      return null;
    }
  },

  async fetchOrdersForUser(userId: string): Promise<OrderRow[] | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, token, service_id, service_name, pickup_date, time_slot, status, instructions, user_id, vendor_name, vendor_id, created_at, delivery_confirmed_at, delivery_comments')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) {
        console.error('Supabase fetchOrdersForUser error', error);
        return null;
      }
      return (data ?? []) as OrderRow[];
    } catch (e) {
      console.error('Supabase fetchOrdersForUser exception', e);
      return null;
    }
  },

  async fetchOrderByToken(
    token: string
  ): Promise<{ order: OrderRow; user: UserRow | null } | null> {
    if (!supabase) return null;
    const t = String(token).replace(/^#/, '').trim();
    if (!t) return null;
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, token, service_id, service_name, pickup_date, time_slot, status, instructions, user_id, vendor_name, vendor_id, created_at, delivery_confirmed_at, delivery_comments')
        .eq('token', t)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error || !orders?.length) return null;
      const order = orders[0] as OrderRow;
      let user: UserRow | null = null;
      if (order.user_id) {
        const { data: u } = await supabase
          .from('users')
          .select('id, full_name, email, phone, whatsapp, user_type, college_id, reg_no, hostel_block, room_number, year, display_id, terms_accepted_at, terms_version')
          .eq('id', order.user_id)
          .single();
        user = u as UserRow | null;
      }
      return { order, user };
    } catch (e) {
      console.error('Supabase fetchOrderByToken exception', e);
      return null;
    }
  },

  async fetchUsers(): Promise<UserRow[] | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, phone, whatsapp, user_type, college_id, reg_no, hostel_block, room_number, year, display_id, terms_accepted_at, terms_version')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) {
        console.error('Supabase fetchUsers error', error);
        return null;
      }
      return (data ?? []) as UserRow[];
    } catch (e) {
      console.error('Supabase fetchUsers exception', e);
      return null;
    }
  },

  async fetchUserById(userId: string): Promise<UserRow | null> {
    if (!supabase || !userId) return null;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, phone, whatsapp, user_type, college_id, reg_no, hostel_block, room_number, year, display_id, terms_accepted_at, terms_version')
        .eq('id', userId)
        .maybeSingle();
      if (error) return null;
      return data as UserRow | null;
    } catch (e) {
      return null;
    }
  },

  async fetchUserByEmail(email: string): Promise<UserRow | null> {
    if (!supabase || !email?.trim()) return null;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, phone, whatsapp, user_type, college_id, reg_no, hostel_block, room_number, year, display_id, terms_accepted_at, terms_version')
        .ilike('email', email.trim().toLowerCase())
        .limit(1);
      const row = Array.isArray(data) ? data[0] : data;
      if (error) return null;
      return (row ?? null) as UserRow | null;
    } catch (e) {
      return null;
    }
  },

  async signUpWithEmail(
    email: string,
    password: string,
    profile: {
      full_name: string;
      phone: string;
      whatsapp: string;
      user_type: string;
      college_id?: string | null;
      reg_no?: string | null;
      hostel_block?: string | null;
      room_number?: string | null;
      year?: number | null;
    }
  ): Promise<{ user: UserRow | null; error?: string }> {
    void email;
    void password;
    void profile;
    return { user: null, error: 'Email/password signup is disabled. Please continue with Google.' };
  },

  async signInWithPassword(email: string, password: string): Promise<{ user: UserRow | null; error?: string }> {
    void email;
    void password;
    return { user: null, error: 'Email/password login is disabled. Please continue with Google.' };
  },

  async signInWithGoogle(redirectTo?: string): Promise<{ error?: { message: string }; data?: { url: string } }> {
    if (!supabase) return { error: { message: 'Sign-in not available' } };
    try {
      const base =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : '';
      // Default Google OAuth redirect should land users on the dashboard,
      // not the marketing homepage.
      const to = redirectTo || (base ? `${base}/dashboard` : '');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: to || undefined },
      });
      if (error) return { error };
      if (data?.url && typeof window !== 'undefined') {
        window.location.href = data.url;
        return { data };
      }
      return { error: { message: 'No redirect URL' } };
    } catch (e) {
      console.error('signInWithGoogle exception', e);
      return { error: { message: (e as Error)?.message } };
    }
  },

  async getAuthSession(): Promise<{ user: unknown } | null> {
    if (!supabase) return null;
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error || !session) return null;
      return session;
    } catch (e) {
      console.error('getAuthSession exception', e);
      return null;
    }
  },

  async getAccessToken(): Promise<string | null> {
    if (!supabase) return null;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.access_token ?? null;
    } catch (e) {
      console.error('getAccessToken exception', e);
      return null;
    }
  },

  async signOutAuth(): Promise<void> {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('signOutAuth exception', e);
    }
  },

  async resetPasswordForEmail(email: string): Promise<{ error?: string }> {
    void email;
    return { error: 'Password reset is disabled. Please continue with Google.' };
  },

  async updatePassword(newPassword: string): Promise<{ error?: string }> {
    void newPassword;
    return { error: 'Password updates are disabled for customer accounts.' };
  },

  async upsertUserFromAuth(authUser: {
    id: string;
    email?: string | null;
    user_metadata?: { full_name?: string; name?: string };
  }): Promise<UserRow | null> {
    if (!supabase || !authUser?.id) return null;
    const fullName =
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      (authUser.email ? authUser.email.split('@')[0] : '') ||
      'User';
    try {
      const { data: existing, error: selectError } = await supabase
        .from('users')
        .select('id, full_name, email, phone, whatsapp, user_type, college_id, reg_no, hostel_block, room_number, year, display_id, terms_accepted_at, terms_version')
        .eq('id', authUser.id)
        .maybeSingle();
      if (selectError) {
        console.error('upsertUserFromAuth select error', selectError);
        return null;
      }
      if (existing) {
        await supabase
          .from('users')
          .update({
            full_name: fullName,
            email: authUser.email ?? existing.email ?? '',
            auth_id: authUser.id,
          })
          .eq('id', authUser.id);
        const { data: refreshed } = await supabase
          .from('users')
          .select('id, full_name, email, phone, whatsapp, user_type, college_id, reg_no, hostel_block, room_number, year, display_id, terms_accepted_at, terms_version')
          .eq('id', authUser.id)
          .maybeSingle();
        return (refreshed ?? existing) as UserRow;
      }
      const row = {
        id: authUser.id,
        auth_id: authUser.id,
        full_name: fullName,
        email: authUser.email ?? '',
        phone: null,
        whatsapp: null,
        user_type: 'general',
        college_id: null,
        reg_no: null,
        hostel_block: null,
        room_number: null,
        year: null,
      };
      const { data: inserted, error: insertErr } = await supabase
        .from('users')
        .insert(row)
        .select()
        .single();
      if (!insertErr && inserted) return inserted as UserRow;
      return null;
    } catch (e) {
      console.error('upsertUserFromAuth exception', e);
      return null;
    }
  },

  async acceptLatestTerms(): Promise<{ user: UserRow | null; error?: string }> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) return { user: null, error: 'Sign in required' };
    try {
      const response = await fetch('/api/terms/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        return { user: null, error: data?.error || 'Could not save terms acceptance' };
      }
      return { user: data.user as UserRow };
    } catch (e) {
      console.error('acceptLatestTerms exception', e);
      return { user: null, error: (e as Error)?.message || 'Could not save terms acceptance' };
    }
  },

  async confirmDelivery(orderId: string, comments?: string | null): Promise<OrderRow | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({
          delivery_confirmed_at: new Date().toISOString(),
          delivery_comments: comments ?? null,
          status: 'delivered',
        })
        .eq('id', orderId)
        .select()
        .single();
      if (error) return null;
      return data as OrderRow;
    } catch (e) {
      console.error('confirmDelivery exception', e);
      return null;
    }
  },

  async advanceOrderStatus(orderId: string): Promise<OrderRow | null> {
    if (!supabase) return null;
    const STATUSES = [
      'scheduled',
      'agent_assigned',
      'picked_up',
      'processing',
      'ready',
      'out_for_delivery',
      'delivered',
    ];
    try {
      const { data: existing, error: getErr } = await supabase
        .from('orders')
        .select('id, order_number, token, service_id, service_name, pickup_date, time_slot, status, instructions, user_id, vendor_name, vendor_id, created_at, delivery_confirmed_at, delivery_comments')
        .eq('id', orderId)
        .single();
      if (getErr || !existing) return null;
      const currentIdx = STATUSES.indexOf((existing as OrderRow).status);
      if (currentIdx < 0 || currentIdx >= STATUSES.length - 1) return existing as OrderRow;
      const nextStatus = STATUSES[currentIdx + 1];
      const row = existing as OrderRow;
      const patch: { status: string; delivery_confirmed_at?: string } = { status: nextStatus };
      if (nextStatus === 'delivered' && !row.delivery_confirmed_at) {
        patch.delivery_confirmed_at = new Date().toISOString();
      }
      const { data, error } = await supabase
        .from('orders')
        .update(patch)
        .eq('id', orderId)
        .select()
        .single();
      if (error) return null;
      return data as OrderRow;
    } catch (e) {
      console.error('Supabase advanceOrderStatus exception', e);
      return null;
    }
  },

  async saveVendorBill(bill: {
    order_id?: string | null;
    order_token: string;
    order_number?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    user_id?: string | null;
    line_items: { id: string; label: string; price: number; qty: number; image_url?: string | null }[];
    subtotal: number;
    convenience_fee: number;
    total: number;
    vendor_name?: string | null;
  }): Promise<{ id: string } | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('vendor_bills')
        .insert({
          order_id: bill.order_id ?? null,
          order_token: bill.order_token,
          order_number: bill.order_number ?? null,
          customer_name: bill.customer_name ?? null,
          customer_phone: bill.customer_phone ?? null,
          user_id: bill.user_id ?? null,
          line_items: bill.line_items,
          subtotal: bill.subtotal,
          convenience_fee: bill.convenience_fee,
          total: bill.total,
          vendor_name: bill.vendor_name ?? null,
        })
        .select('id')
        .single();
      if (error) {
        console.error('Supabase saveVendorBill error', error);
        return null;
      }
      return data as { id: string };
    } catch (e) {
      console.error('Supabase saveVendorBill exception', e);
      return null;
    }
  },

  async fetchVendorBills(vendorName?: string): Promise<VendorBillRow[] | null> {
    if (!supabase) return null;
    try {
      let q = supabase
        .from('vendor_bills')
        .select('id, order_id, order_token, order_number, customer_name, customer_phone, customer_reg_no, customer_hostel_block, customer_room_number, user_id, subtotal, convenience_fee, total, vendor_name, vendor_id, vendor_slug, cancelled_at, cancelled_by_role, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (vendorName) q = q.eq('vendor_name', vendorName);
      const { data, error } = await q;
      if (error) {
        console.error('Supabase fetchVendorBills error', error);
        return null;
      }
      return (data ?? []) as VendorBillRow[];
    } catch (e) {
      console.error('Supabase fetchVendorBills exception', e);
      return null;
    }
  },

  async fetchVendorBillsForUser(userId: string): Promise<VendorBillRow[] | null> {
    const billSelect =
      'id, order_id, order_token, order_number, customer_name, customer_phone, customer_reg_no, customer_hostel_block, customer_room_number, user_id, line_items, subtotal, convenience_fee, total, vendor_name, vendor_id, cancelled_at, cancelled_by_role, created_at';

    const mergeByIdSort = (rows: VendorBillRow[]): VendorBillRow[] => {
      const byId = new Map<string, VendorBillRow>();
      for (const r of rows) {
        if (r && typeof (r as VendorBillRow).id === 'string') byId.set((r as VendorBillRow).id, r as VendorBillRow);
      }
      return [...byId.values()]
        .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
        .slice(0, 200);
    };

    /** Server route uses service role — works when Supabase RLS on vendor_bills blocks the anon client. */
    if (typeof window !== 'undefined' && userId) {
      const token = await this.getAccessToken();
      if (token) {
        try {
          // #region agent log
          fetch('http://127.0.0.1:7428/ingest/c02f407f-c764-45c0-ab87-69194259e7eb', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2ac42a' },
            body: JSON.stringify({
              sessionId: '2ac42a',
              runId: 'initial',
              hypothesisId: 'H6_CLIENT_NEVER_CALLS_ROUTE',
              location: 'lib/api.ts:fetchVendorBillsForUser-pre-route-call',
              message: 'Client attempting /api/me/vendor-bills request',
              data: { hasUserId: Boolean(userId), tokenLength: token.length },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          const res = await fetch('/api/me/vendor-bills', {
            method: 'GET',
            credentials: 'same-origin',
            headers: { Authorization: `Bearer ${token}` },
          });
          const payload = await res.json().catch(() => ({}));
          // #region agent log
          fetch('http://127.0.0.1:7428/ingest/c02f407f-c764-45c0-ab87-69194259e7eb', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2ac42a' },
            body: JSON.stringify({
              sessionId: '2ac42a',
              runId: 'initial',
              hypothesisId: 'H7_ROUTE_RESPONSE_NOT_OK',
              location: 'lib/api.ts:fetchVendorBillsForUser-post-route-call',
              message: 'Client received /api/me/vendor-bills response',
              data: {
                status: res.status,
                ok: res.ok,
                payloadOk: Boolean(payload?.ok),
                billsCount: Array.isArray(payload?.bills) ? payload.bills.length : null,
                error: typeof payload?.error === 'string' ? payload.error : null,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          if (res.ok && payload?.ok && Array.isArray(payload.bills)) {
            return payload.bills as VendorBillRow[];
          }
          if (!res.ok) {
            console.error('fetchVendorBillsForUser /api/me/vendor-bills', res.status, payload?.error ?? payload);
          }
        } catch (e) {
          console.error('fetchVendorBillsForUser API exception', e);
        }
      }
    }

    if (!supabase) return null;

    try {
      const [byUserRes, orders] = await Promise.all([
        supabase
          .from('vendor_bills')
          .select(billSelect)
          .eq('user_id', userId)
          .is('cancelled_at', null)
          .order('created_at', { ascending: false })
          .limit(200),
        this.fetchOrdersForUser(userId),
      ]);

      const collected: VendorBillRow[] = [];
      if (!byUserRes.error && byUserRes.data) collected.push(...(byUserRes.data as VendorBillRow[]));

      const orderIds = (orders ?? []).map((o) => String(o.id ?? '').trim()).filter(Boolean);
      if (orderIds.length) {
        const { data: byOrder, error: byOrderErr } = await supabase
          .from('vendor_bills')
          .select(billSelect)
          .in('order_id', orderIds)
          .is('cancelled_at', null)
          .order('created_at', { ascending: false })
          .limit(200);
        if (!byOrderErr && byOrder?.length) collected.push(...(byOrder as VendorBillRow[]));
      }

      const allowedTokens = new Set<string>();
      for (const o of orders ?? []) {
        const tk = stripLeadingHashesFromToken(String(o.token ?? '')).toLowerCase();
        if (tk) allowedTokens.add(tk);
      }
      for (const k of allowedTokens) {
        const tokenVariants = orderLookupTokenVariants(k);
        if (!tokenVariants.length) continue;
        const { data: byTok, error: tokErr } = await supabase
          .from('vendor_bills')
          .select(billSelect)
          .in('order_token', tokenVariants)
          .is('cancelled_at', null)
          .limit(50);
        if (tokErr || !byTok?.length) continue;
        for (const row of byTok as VendorBillRow[]) {
          const btok = stripLeadingHashesFromToken(String(row.order_token ?? '')).toLowerCase();
          if (!allowedTokens.has(btok)) continue;
          const uid = row.user_id != null && String(row.user_id) !== '' ? String(row.user_id) : '';
          if (uid && uid !== userId) continue;
          collected.push(row);
        }
      }

      if (byUserRes.error && collected.length === 0) {
        console.error('fetchVendorBillsForUser by user_id error', byUserRes.error);
        return null;
      }
      return mergeByIdSort(collected);
    } catch (e) {
      console.error('fetchVendorBillsForUser exception', e);
      return null;
    }
  },

  async countBillsForOrderToken(orderToken: string): Promise<number> {
    if (!supabase) return 0;
    try {
      const { count, error } = await supabase
        .from('vendor_bills')
        .select('*', { count: 'exact', head: true })
        .eq('order_token', orderToken.replace(/^#/, '').trim());
      if (error) return 0;
      return count ?? 0;
    } catch (e) {
      return 0;
    }
  },

  async confirmDeliveryByToken(token: string): Promise<OrderRow | null> {
    if (!supabase) return null;
    const t = String(token).replace(/^#/, '').trim();
    if (!t) return null;
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('token', t)
        .limit(1);
      if (!orders?.length) return null;
      return this.confirmDelivery(orders[0].id, 'Confirmed by admin (pickup/delivery)');
    } catch (e) {
      return null;
    }
  },

  async fetchScheduleSlots(): Promise<ScheduleSlotRow[] | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('schedule_slots')
        .select('id, label, time_from, time_to, sort_order, active, created_at')
        .order('sort_order', { ascending: true });
      if (error) {
        console.error('Supabase fetchScheduleSlots error', error);
        return null;
      }
      return (data ?? []) as ScheduleSlotRow[];
    } catch (e) {
      console.error('fetchScheduleSlots exception', e);
      return null;
    }
  },

  async fetchScheduleDates(): Promise<ScheduleDateRow[] | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('schedule_dates')
        .select('date, enabled, slot_ids, enabled_by_vendor, created_at, updated_at')
        .order('date', { ascending: true });
      if (error) {
        console.error('Supabase fetchScheduleDates error', error);
        return null;
      }
      const rows = (data ?? []) as (ScheduleDateRow & { slot_ids?: unknown })[];
      return rows.map((r) => ({
        ...r,
        slot_ids: Array.isArray(r.slot_ids)
          ? r.slot_ids.filter((s): s is string => typeof s === 'string')
          : r.slot_ids && typeof r.slot_ids === 'object'
            ? Object.values(r.slot_ids as Record<string, unknown>)
                .flatMap((v) => (Array.isArray(v) ? v : []))
                .filter((s): s is string => typeof s === 'string')
            : [],
        enabled_by_vendor:
          r.enabled_by_vendor && typeof r.enabled_by_vendor === 'object'
            ? (r.enabled_by_vendor as Record<string, boolean>)
            : null,
      }));
    } catch (e) {
      console.error('fetchScheduleDates exception', e);
      return null;
    }
  },

  async fetchNotifications(): Promise<UserNotificationRow[] | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('user_notifications')
        .select('id, user_id, title, body, sent_at, scheduled_at, read_at, created_at')
        .not('sent_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) {
        console.error('Supabase fetchNotifications error', error);
        return null;
      }
      return (data ?? []) as UserNotificationRow[];
    } catch (e) {
      console.error('fetchNotifications exception', e);
      return null;
    }
  },

  async markNotificationRead(notificationId: string): Promise<boolean> {
    if (!supabase) return false;
    try {
      const { error } = await supabase
        .from('user_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);
      return !error;
    } catch (e) {
      return false;
    }
  },

  async fetchVendorProfile(slug = 'profab'): Promise<VendorProfileRow | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select('id, slug, name, brief, pricing_details, logo_url, updated_at')
        .eq('slug', slug)
        .maybeSingle();
      if (error) return null;
      return data as VendorProfileRow | null;
    } catch (e) {
      return null;
    }
  },
};

export type VendorBillRow = {
  id: string;
  order_id: string | null;
  order_token: string;
  order_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_reg_no?: string | null;
  customer_hostel_block?: string | null;
  customer_room_number?: string | null;
  user_id: string | null;
  /** Present when API joins users (admin bills list). */
  user_email?: string | null;
  user_display_id?: string | null;
  line_items: { id: string; label: string; price: number; qty: number; image_url?: string | null }[];
  subtotal: number;
  convenience_fee: number;
  total: number;
  vendor_name?: string | null;
  vendor_id?: string | null;
  /** Set by GET /api/vendor/bills for catalog / edit UI */
  vendor_slug?: string | null;
  cancelled_at?: string | null;
  cancelled_by_role?: string | null;
  created_at: string;
  updated_at?: string;
};

export type VendorProfileRow = {
  id: string;
  slug: string;
  name: string;
  brief: string | null;
  pricing_details: string | null;
  logo_url?: string | null;
  updated_at?: string;
};
