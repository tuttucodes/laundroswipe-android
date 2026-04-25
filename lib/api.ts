import { supabase } from './supabase';
import { apiFetch, ApiError } from './api-client';
import {
  normalizeScheduleDateRowsFromDb,
  type RawDbScheduleDateRow,
  type NormalizedScheduleDateRow,
} from './schedule-normalize';

// ─── Types mirrored from the web app's lib/api.ts ────────────────────────────

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

export type ScheduleDateRow = NormalizedScheduleDateRow;

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

export type VendorBillLineItem = {
  id: string;
  label: string;
  price: number;
  qty: number;
  image_url?: string | null;
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
  user_email?: string | null;
  user_display_id?: string | null;
  line_items?: VendorBillLineItem[];
  subtotal: number;
  convenience_fee: number;
  total: number;
  vendor_name?: string | null;
  vendor_id?: string | null;
  vendor_slug?: string | null;
  cancelled_at?: string | null;
  cancelled_by_role?: string | null;
  created_at: string;
  updated_at?: string;
};

export type BootstrapPayload = {
  user: UserRow | null;
  orders: OrderRow[];
  bills: VendorBillRow[];
  unread_count: number;
  server_time: string;
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

// ─── Mobile data client ──────────────────────────────────────────────────────

const USER_SELECT =
  'id, full_name, email, phone, whatsapp, user_type, college_id, reg_no, hostel_block, room_number, year, display_id, terms_accepted_at, terms_version';

const ORDER_LIST_SELECT =
  'id, order_number, token, service_id, service_name, pickup_date, time_slot, status, user_id, vendor_name, vendor_id, created_at, delivery_confirmed_at';

const ORDER_DETAIL_SELECT =
  'id, order_number, token, service_id, service_name, pickup_date, time_slot, status, instructions, user_id, vendor_name, vendor_id, created_at, delivery_confirmed_at, delivery_comments';

const BILL_LIST_SELECT =
  'id, order_id, order_token, order_number, customer_name, customer_phone, customer_reg_no, customer_hostel_block, customer_room_number, user_id, subtotal, convenience_fee, total, vendor_name, vendor_id, cancelled_at, cancelled_by_role, created_at';

const BILL_DETAIL_SELECT =
  'id, order_id, order_token, order_number, customer_name, customer_phone, customer_reg_no, customer_hostel_block, customer_room_number, user_id, line_items, subtotal, convenience_fee, total, vendor_name, vendor_id, cancelled_at, cancelled_by_role, created_at, updated_at';

export const LSApi = {
  // ── Auth ─────────────────────────────────────────────────────────────────
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  // ── Session bootstrap (server-side egress-optimized) ────────────────────
  async fetchBootstrap(): Promise<BootstrapPayload | null> {
    try {
      const res = await apiFetch<{ ok: boolean; payload: BootstrapPayload }>('/api/me/bootstrap');
      return res.payload ?? null;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },

  // ── Schedule (public) ───────────────────────────────────────────────────
  async fetchPublicSchedule(): Promise<{
    slots: ScheduleSlotRow[];
    dates: ScheduleDateRow[];
  } | null> {
    try {
      const res = await apiFetch<{ slots: ScheduleSlotRow[]; dates: RawDbScheduleDateRow[] }>(
        '/api/schedule',
        { auth: 'none' },
      );
      const slots = res.slots ?? [];
      const dates = normalizeScheduleDateRowsFromDb(res.dates ?? []);
      return { slots, dates };
    } catch (e) {
      console.error('fetchPublicSchedule', e);
      return null;
    }
  },

  // ── Vendor catalog (public) ─────────────────────────────────────────────
  async fetchVendorCatalog(campusId: string): Promise<VendorCatalogRow[] | null> {
    try {
      const res = await apiFetch<{ vendors: VendorCatalogRow[] }>('/api/vendors/catalog', {
        auth: 'none',
        query: { campus_id: campusId },
      });
      return res.vendors ?? [];
    } catch (e) {
      console.error('fetchVendorCatalog', e);
      return null;
    }
  },

  // ── Order create (server-authoritative: schedule + campus + terms guard) ─
  async createOrder(order: {
    on: string;
    tk: string;
    svc: string;
    sl: string;
    pd: string;
    ts: string;
    status?: string;
    ins?: string;
    vendorName?: string;
    vendorSlug?: string;
    campusId?: string;
  }): Promise<{ order: OrderRow | null; error?: string; code?: string }> {
    try {
      const res = await apiFetch<{ ok: boolean; order: OrderRow }>('/api/orders/create', {
        method: 'POST',
        body: order,
      });
      return { order: res.order };
    } catch (e) {
      if (e instanceof ApiError) {
        return { order: null, error: e.message, code: e.code };
      }
      return { order: null, error: (e as Error).message };
    }
  },

  // ── Terms ────────────────────────────────────────────────────────────────
  async acceptLatestTerms(): Promise<{ user: UserRow | null; error?: string }> {
    try {
      const res = await apiFetch<{ ok: boolean; user: UserRow }>('/api/terms/accept', {
        method: 'POST',
      });
      return { user: res.user };
    } catch (e) {
      if (e instanceof ApiError) return { user: null, error: e.message };
      return { user: null, error: (e as Error).message };
    }
  },

  // ── Users (direct Supabase via RLS) ─────────────────────────────────────
  async fetchUserById(userId: string): Promise<UserRow | null> {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('users')
      .select(USER_SELECT)
      .eq('id', userId)
      .maybeSingle();
    if (error) return null;
    return (data as UserRow) ?? null;
  },

  async updateUser(
    userId: string,
    updates: Partial<
      Pick<
        UserRow,
        | 'full_name'
        | 'email'
        | 'phone'
        | 'whatsapp'
        | 'user_type'
        | 'college_id'
        | 'reg_no'
        | 'hostel_block'
        | 'room_number'
        | 'year'
      >
    >,
  ): Promise<{ user: UserRow | null; error?: string }> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select(USER_SELECT)
      .single();
    if (error) return { user: null, error: error.message };
    return { user: data as UserRow };
  },

  // ── Orders (direct Supabase reads — RLS enforces user scope) ────────────
  async fetchOrdersForUser(userId: string): Promise<OrderRow[] | null> {
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_LIST_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return null;
    return (data ?? []) as OrderRow[];
  },

  async fetchOrderFullById(orderId: string): Promise<OrderRow | null> {
    if (!orderId) return null;
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_DETAIL_SELECT)
      .eq('id', orderId)
      .maybeSingle();
    if (error) return null;
    return (data as OrderRow) ?? null;
  },

  // ── Bills ────────────────────────────────────────────────────────────────
  /** Uses server RPC get_my_bills via /api/me/vendor-bills (slim, ETag-cached). */
  async fetchVendorBillsForUser(): Promise<VendorBillRow[] | null> {
    try {
      const res = await apiFetch<{ ok: boolean; bills: VendorBillRow[] }>('/api/me/vendor-bills');
      return res.bills ?? [];
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },

  /** Full bill incl. line_items — call only when opening the viewer. */
  async fetchVendorBillById(billId: string): Promise<VendorBillRow | null> {
    if (!billId) return null;
    const { data, error } = await supabase
      .from('vendor_bills')
      .select(BILL_DETAIL_SELECT)
      .eq('id', billId)
      .maybeSingle();
    if (error) return null;
    return (data as VendorBillRow) ?? null;
  },

  // ── Vendor profiles ─────────────────────────────────────────────────────
  async fetchVendorProfile(slug = 'profab'): Promise<VendorProfileRow | null> {
    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('id, slug, name, brief, pricing_details, logo_url, updated_at')
      .eq('slug', slug)
      .maybeSingle();
    if (error) return null;
    return (data as VendorProfileRow) ?? null;
  },

  async fetchVendorProfiles(slugs: string[]): Promise<VendorProfileRow[]> {
    const list = Array.from(
      new Set((slugs ?? []).map((s) => String(s ?? '').trim()).filter(Boolean)),
    );
    if (list.length === 0) return [];
    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('id, slug, name, brief, pricing_details, logo_url, updated_at')
      .in('slug', list);
    if (error) return [];
    return (data ?? []) as VendorProfileRow[];
  },

  // ── Notifications ───────────────────────────────────────────────────────
  async fetchNotifications(): Promise<UserNotificationRow[] | null> {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('id, user_id, title, body, sent_at, scheduled_at, read_at, created_at')
      .not('sent_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) return null;
    return (data ?? []) as UserNotificationRow[];
  },

  async fetchUnreadNotificationCount(): Promise<number> {
    const { count, error } = await supabase
      .from('user_notifications')
      .select('id', { count: 'exact', head: true })
      .not('sent_at', 'is', null)
      .is('read_at', null);
    if (error) return 0;
    return typeof count === 'number' ? count : 0;
  },

  async markNotificationRead(notificationId: string): Promise<boolean> {
    const { error } = await supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);
    return !error;
  },
} as const;
