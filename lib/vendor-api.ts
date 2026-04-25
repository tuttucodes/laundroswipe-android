import { apiFetch } from './api-client';
import type { VendorBillRow } from './api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type VendorOrderLookup = {
  ok: true;
  order: {
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
    delivery_confirmed_at: string | null;
    delivery_comments: string | null;
    vendor_name: string | null;
    vendor_id: string | null;
  };
  user: {
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
    display_id: string | null;
  } | null;
  existing_bills_count: number;
  latest_bill: {
    id: string;
    created_at: string;
    can_cancel: boolean;
    total_items: number;
    subtotal: number;
    total: number;
    line_items: Array<{
      id: string;
      label: string;
      price: number;
      qty: number;
      image_url?: string | null;
    }>;
  } | null;
};

export type VendorBillCatalog = {
  ok: true;
  slug: string;
  items: Array<{ id: string; label: string; price: number; image_url?: string | null }>;
  overrides: Record<string, { price?: number; label?: string; image_url?: string | null }>;
};

export type VendorBillsPage = {
  ok: true;
  bills: VendorBillRow[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type VendorRevenue = {
  ok: true;
  group_by_days: number;
  total_bills: number;
  grand_subtotal: number;
  grand_convenience_fee: number;
  grand_total: number;
  revenue: Array<{
    date_from: string;
    date_to: string;
    bill_count: number;
    subtotal: number;
    convenience_fee: number;
    total: number;
  }>;
};

// ─── Calls ───────────────────────────────────────────────────────────────────

export const VendorApi = {
  lookup: (token: string) =>
    apiFetch<VendorOrderLookup>('/api/vendor/orders/lookup', {
      method: 'POST',
      auth: 'admin',
      body: { token },
    }),

  confirmDelivery: (token: string, comments?: string) =>
    apiFetch<{ ok: boolean; order: Record<string, unknown> }>(
      '/api/vendor/orders/confirm-delivery',
      {
        method: 'POST',
        auth: 'admin',
        body: { token, comments: comments ?? null },
      },
    ),

  advanceOrder: (orderId: string) =>
    apiFetch<{ ok: boolean; order: Record<string, unknown> }>('/api/admin/orders/advance', {
      method: 'POST',
      auth: 'admin',
      body: { orderId },
    }),

  billCatalog: (slug?: string) =>
    apiFetch<VendorBillCatalog>('/api/vendor/bill-catalog', {
      auth: 'admin',
      query: slug ? { slug } : undefined,
    }),

  saveBill: (body: {
    token: string;
    line_items: Array<{
      id: string;
      qty: number;
      label?: string | null;
      price?: number | string | null;
      image_url?: string | null;
    }>;
    order_number?: string | null;
  }) =>
    apiFetch<{
      ok: boolean;
      billId: string;
      reused?: boolean;
      updated?: boolean;
      created?: boolean;
    }>('/api/vendor/bills/save', { method: 'POST', auth: 'admin', body }),

  updateBill: (billId: string, lineItems: Array<{ id: string; qty: number }>) =>
    apiFetch<{ ok: boolean; billId: string }>('/api/vendor/bills/update', {
      method: 'POST',
      auth: 'admin',
      body: { bill_id: billId, line_items: lineItems },
    }),

  cancelBill: (billId: string) =>
    apiFetch<{ ok: boolean; bill_id: string; cancelled_at: string }>('/api/vendor/bills/cancel', {
      method: 'POST',
      auth: 'admin',
      body: { bill_id: billId },
    }),

  bills: (opts?: {
    page?: number;
    limit?: number;
    token?: string;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    apiFetch<VendorBillsPage>('/api/vendor/bills', {
      auth: 'admin',
      query: {
        page: opts?.page ?? 1,
        limit: opts?.limit ?? 20,
        token: opts?.token,
        date_from: opts?.dateFrom,
        date_to: opts?.dateTo,
      },
    }),

  revenue: (opts?: { days?: number; from?: string; to?: string }) =>
    apiFetch<VendorRevenue>('/api/vendor/revenue', {
      auth: 'admin',
      query: { days: opts?.days ?? 1, from: opts?.from, to: opts?.to },
    }),

  updateBillCatalog: (
    slug: string,
    overrides: Record<string, { price?: number; label?: string; image_url?: string | null }>,
  ) =>
    apiFetch<VendorBillCatalog>('/api/vendor/bill-catalog', {
      method: 'PUT',
      auth: 'admin',
      body: { slug, overrides },
    }),
};
