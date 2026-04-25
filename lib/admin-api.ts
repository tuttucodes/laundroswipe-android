import { apiFetch } from './api-client';
import type { OrderRow, UserRow, VendorBillRow } from './api';

type AdminOverviewResponse = {
  ok: true;
  orders: Array<OrderRow & { vendor_slug: string | null }>;
  users: UserRow[];
  vendor_bills: VendorBillRow[];
  vendors: Array<{ id: string; slug: string; name: string }>;
  pagination: {
    orders: { page: number; limit: number; total: number };
    bills: { page: number; limit: number; total: number };
  };
};

export const AdminApi = {
  overview: (opts?: {
    ordersPage?: number;
    ordersLimit?: number;
    billsPage?: number;
    billsLimit?: number;
  }) =>
    apiFetch<AdminOverviewResponse>('/api/admin/overview', {
      auth: 'admin',
      query: {
        orders_page: opts?.ordersPage ?? 1,
        orders_limit: opts?.ordersLimit ?? 100,
        bills_page: opts?.billsPage ?? 1,
        bills_limit: opts?.billsLimit ?? 50,
      },
    }),

  advanceOrder: (orderId: string) =>
    apiFetch<{ ok: boolean; order: Record<string, unknown> }>('/api/admin/orders/advance', {
      method: 'POST',
      auth: 'admin',
      body: { orderId },
    }),
};
