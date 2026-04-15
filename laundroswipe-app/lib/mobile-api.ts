import { supabase, hasSupabase } from './supabase';
import { api } from './http';
import { normalizeScheduleDateRowsFromDb, type RawDbScheduleDateRow } from './schedule-normalize';
import type {
  OrderRow,
  ScheduleDateRow,
  ScheduleSlotRow,
  UserNotificationRow,
  UserRow,
  VendorBillRow,
  VendorCatalogRow,
} from './api-types';

export const MobileApi = {
  hasSupabase,

  async getAccessToken(): Promise<string | null> {
    if (!supabase) return null;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  },

  async fetchVendorCatalog(campusId: string): Promise<VendorCatalogRow[] | null> {
    try {
      const res = await api.get('/api/vendors/catalog', { params: { campus_id: campusId } });
      const data = res.data as { vendors?: VendorCatalogRow[] };
      return Array.isArray(data.vendors) ? data.vendors : [];
    } catch {
      return null;
    }
  },

  async fetchPublicSchedule(): Promise<{ slots: ScheduleSlotRow[]; dates: ScheduleDateRow[] } | null> {
    try {
      const res = await api.get('/api/schedule', { params: { t: String(Date.now()) } });
      const data = res.data as { slots?: ScheduleSlotRow[]; dates?: ScheduleDateRow[] };
      if (Array.isArray(data.slots) && Array.isArray(data.dates)) {
        return { slots: data.slots, dates: data.dates };
      }
    } catch {
      /* fall through */
    }
    if (!supabase) return null;
    const [slotsRes, datesRes] = await Promise.all([
      supabase
        .from('schedule_slots')
        .select('id, label, time_from, time_to, sort_order, active, created_at')
        .order('sort_order', { ascending: true }),
      supabase
        .from('schedule_dates')
        .select('date, enabled, slot_ids, enabled_by_vendor, created_at, updated_at')
        .order('date', { ascending: true }),
    ]);
    if (slotsRes.error || datesRes.error) return null;
    const dates = normalizeScheduleDateRowsFromDb((datesRes.data ?? []) as RawDbScheduleDateRow[]) as ScheduleDateRow[];
    return { slots: (slotsRes.data ?? []) as ScheduleSlotRow[], dates };
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
    userId: string,
  ): Promise<{ order: OrderRow | null; error?: string; code?: string }> {
    if (!supabase) return { order: null, error: 'Not connected' };
    const accessToken = await this.getAccessToken();
    if (!accessToken) return { order: null, error: 'Sign in required' };
    try {
      const res = await api.post(
        '/api/orders/create',
        { ...order, userId },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const data = res.data as { ok?: boolean; order?: OrderRow; error?: string; code?: string };
      if (!res.status.toString().startsWith('2') || !data?.ok) {
        return { order: null, error: data?.error || 'Order failed', code: data?.code };
      }
      return { order: data.order as OrderRow };
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; code?: string } } };
      return {
        order: null,
        error: err?.response?.data?.error || 'Order failed',
        code: err?.response?.data?.code,
      };
    }
  },

  async fetchOrdersForUser(userId: string): Promise<OrderRow[] | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('orders')
      .select(
        'id, order_number, token, service_id, service_name, pickup_date, time_slot, status, instructions, user_id, vendor_name, vendor_id, created_at, delivery_confirmed_at, delivery_comments',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return null;
    return (data ?? []) as OrderRow[];
  },

  async fetchUserById(userId: string): Promise<UserRow | null> {
    if (!supabase || !userId) return null;
    const { data, error } = await supabase
      .from('users')
      .select(
        'id, full_name, email, phone, whatsapp, user_type, college_id, reg_no, hostel_block, room_number, year, display_id, terms_accepted_at, terms_version',
      )
      .eq('id', userId)
      .maybeSingle();
    if (error) return null;
    return data as UserRow | null;
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
    const { data: existing } = await supabase
      .from('users')
      .select(
        'id, full_name, email, phone, whatsapp, user_type, college_id, reg_no, hostel_block, room_number, year, display_id, terms_accepted_at, terms_version',
      )
      .eq('id', authUser.id)
      .maybeSingle();
    if (existing) {
      await supabase
        .from('users')
        .update({
          full_name: fullName,
          email: authUser.email ?? (existing as UserRow).email ?? '',
          auth_id: authUser.id,
        })
        .eq('id', authUser.id);
      const { data: refreshed } = await supabase
        .from('users')
        .select(
          'id, full_name, email, phone, whatsapp, user_type, college_id, reg_no, hostel_block, room_number, year, display_id, terms_accepted_at, terms_version',
        )
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
    const { data: inserted, error: insertErr } = await supabase.from('users').insert(row).select().single();
    if (!insertErr && inserted) return inserted as UserRow;
    return null;
  },

  async acceptLatestTerms(): Promise<{ user: UserRow | null; error?: string }> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) return { user: null, error: 'Sign in required' };
    try {
      const res = await api.post('/api/terms/accept', {}, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = res.data as { ok?: boolean; user?: UserRow; error?: string };
      if (!data?.ok) return { user: null, error: data?.error || 'Could not save terms acceptance' };
      return { user: data.user as UserRow };
    } catch {
      return { user: null, error: 'Could not save terms acceptance' };
    }
  },

  async fetchVendorBillsForUser(userId: string): Promise<VendorBillRow[] | null> {
    const token = await this.getAccessToken();
    if (token) {
      try {
        const res = await api.get('/api/me/vendor-bills', { headers: { Authorization: `Bearer ${token}` } });
        const payload = res.data as { ok?: boolean; bills?: VendorBillRow[] };
        if (res.status === 200 && payload?.ok && Array.isArray(payload.bills)) {
          return payload.bills;
        }
      } catch {
        /* fall through */
      }
    }
    if (!supabase) return null;
    const billSelect =
      'id, order_id, order_token, order_number, customer_name, customer_phone, customer_reg_no, customer_hostel_block, customer_room_number, user_id, line_items, subtotal, convenience_fee, total, vendor_name, vendor_id, cancelled_at, cancelled_by_role, created_at';
    const { data, error } = await supabase
      .from('vendor_bills')
      .select(billSelect)
      .eq('user_id', userId)
      .is('cancelled_at', null)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return null;
    return (data ?? []) as VendorBillRow[];
  },

  async fetchNotifications(): Promise<UserNotificationRow[] | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('user_notifications')
      .select('id, user_id, title, body, sent_at, scheduled_at, read_at, created_at')
      .not('sent_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return null;
    return (data ?? []) as UserNotificationRow[];
  },

  async updateUser(userId: string, updates: Partial<UserRow>): Promise<{ user: UserRow | null; error?: string }> {
    if (!supabase) return { user: null, error: 'Not connected' };
    const { data, error } = await supabase.from('users').update(updates).eq('id', userId).select().single();
    if (error) return { user: null, error: error.message };
    return { user: data as UserRow };
  },
};
