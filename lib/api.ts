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
  }): Promise<UserRow | null> {
    if (!supabase) return null;
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
        return null;
      }
      return data as UserRow;
    } catch (e) {
      console.error('Supabase createUser exception', e);
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
    const row = {
      id: authUser.id,
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
    try {
      const { data: upserted, error: upsertErr } = await supabase
        .from('users')
        .upsert(row, { onConflict: 'id' })
        .select()
        .single();
      if (!upsertErr && upserted) return upserted as UserRow;
      const { data: inserted, error: insertErr } = await supabase
        .from('users')
        .insert(row)
        .select()
        .single();
      if (!insertErr && inserted) return inserted as UserRow;
      const { data: existing } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      return (existing as UserRow) ?? null;
    } catch (e) {
      console.error('upsertUserFromAuth exception', e);
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
};
