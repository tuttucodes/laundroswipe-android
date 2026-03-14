import { supabase, hasSupabase } from './supabase';

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
  year: number | null;
  display_id?: string | null;
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
  created_at: string;
  delivery_confirmed_at?: string | null;
  delivery_comments?: string | null;
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
    updates: { full_name?: string; email?: string; phone?: string; whatsapp?: string; user_type?: string; college_id?: string | null; reg_no?: string | null; hostel_block?: string | null; year?: number | null }
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
    },
    userId: string
  ): Promise<OrderRow | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('orders')
        .insert({
          order_number: order.on,
          token: order.tk,
          service_id: order.svc,
          service_name: order.sl,
          pickup_date: order.pd,
          time_slot: order.ts,
          status: order.status,
          instructions: order.ins ?? null,
          user_id: userId,
        })
        .select()
        .single();
      if (error) {
        console.error('Supabase createOrder error', error);
        return null;
      }
      return data as OrderRow;
    } catch (e) {
      console.error('Supabase createOrder exception', e);
      return null;
    }
  },

  async fetchOrders(): Promise<OrderRow[] | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
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
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
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
        .select('*')
        .eq('token', t)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error || !orders?.length) return null;
      const order = orders[0] as OrderRow;
      let user: UserRow | null = null;
      if (order.user_id) {
        const { data: u } = await supabase
          .from('users')
          .select('*')
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
        .select('*')
        .order('created_at', { ascending: false });
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
      year?: number | null;
    }
  ): Promise<{ user: UserRow | null; error?: string }> {
    if (!supabase) return { user: null, error: 'Not connected' };
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: profile.full_name } },
      });
      if (authErr) {
        const msg = authErr.message?.includes('already registered') ? 'Email already registered' : authErr.message || 'Sign up failed';
        return { user: null, error: msg };
      }
      const authUser = authData?.user;
      if (!authUser?.id) return { user: null, error: 'Sign up failed' };
      const row = {
        id: authUser.id,
        auth_id: authUser.id,
        full_name: profile.full_name,
        email: authUser.email ?? email,
        phone: profile.phone,
        whatsapp: profile.whatsapp,
        user_type: profile.user_type,
        college_id: profile.college_id ?? null,
        reg_no: profile.reg_no ?? null,
        hostel_block: profile.hostel_block ?? null,
        year: profile.year ?? null,
      };
      const { data: inserted, error: insertErr } = await supabase
        .from('users')
        .insert(row)
        .select()
        .single();
      if (insertErr) {
        console.error('Supabase signUpWithEmail insert error', insertErr);
        return { user: null, error: insertErr.message || 'Profile creation failed' };
      }
      return { user: inserted as UserRow };
    } catch (e) {
      console.error('signUpWithEmail exception', e);
      return { user: null, error: (e as Error)?.message || 'Sign up failed' };
    }
  },

  async signInWithPassword(email: string, password: string): Promise<{ user: UserRow | null; error?: string }> {
    if (!supabase) return { user: null, error: 'Not connected' };
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) return { user: null, error: error.message || 'Invalid email or password' };
      const authUser = data?.user;
      if (!authUser?.id) return { user: null, error: 'Sign in failed' };
      const { data: profile, error: profileErr } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authUser.id)
        .maybeSingle();
      if (profileErr || !profile) return { user: null, error: 'Profile not found' };
      return { user: profile as UserRow };
    } catch (e) {
      console.error('signInWithPassword exception', e);
      return { user: null, error: (e as Error)?.message || 'Sign in failed' };
    }
  },

  async signInWithGoogle(redirectTo?: string): Promise<{ error?: { message: string }; data?: { url: string } }> {
    if (!supabase) return { error: { message: 'Supabase not configured' } };
    try {
      const base =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : '';
      const to = redirectTo || (base ? base + (base.endsWith('/') ? '' : '/') : '');
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

  async signOutAuth(): Promise<void> {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('signOutAuth exception', e);
    }
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
      const { data: existing } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      if (existing) {
        await supabase
          .from('users')
          .update({
            full_name: fullName,
            email: authUser.email ?? existing.email ?? '',
            auth_id: authUser.id,
          })
          .eq('id', authUser.id);
        return existing as UserRow;
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
        .select('*')
        .eq('id', orderId)
        .single();
      if (getErr || !existing) return null;
      const currentIdx = STATUSES.indexOf((existing as OrderRow).status);
      if (currentIdx < 0 || currentIdx >= STATUSES.length - 1) return existing as OrderRow;
      const nextStatus = STATUSES[currentIdx + 1];
      const { data, error } = await supabase
        .from('orders')
        .update({ status: nextStatus })
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
    line_items: { id: string; label: string; price: number; qty: number }[];
    subtotal: number;
    convenience_fee: number;
    total: number;
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

  async fetchVendorBills(): Promise<VendorBillRow[] | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('vendor_bills')
        .select('*')
        .order('created_at', { ascending: false });
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
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('vendor_bills')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) return null;
      return (data ?? []) as VendorBillRow[];
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
};

export type VendorBillRow = {
  id: string;
  order_id: string | null;
  order_token: string;
  order_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  user_id: string | null;
  line_items: { id: string; label: string; price: number; qty: number }[];
  subtotal: number;
  convenience_fee: number;
  total: number;
  created_at: string;
};
