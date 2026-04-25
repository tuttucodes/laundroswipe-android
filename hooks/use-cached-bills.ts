import { useQuery } from '@tanstack/react-query';
import { LSApi, type VendorBillRow } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { stripLeadingHashesFromToken } from '@/lib/vendor-bill-token';

export const MY_BILLS_KEY = ['my-bills'] as const;

/**
 * Bills list with offline-first hydration.
 * Returns persisted snapshot immediately; revalidates in the background.
 */
export function useCachedMyBills() {
  return useQuery({
    queryKey: MY_BILLS_KEY,
    queryFn: () => LSApi.fetchVendorBillsForUser(),
    staleTime: 60_000,
    networkMode: 'offlineFirst',
  });
}

/**
 * Bill detail: reuses the list snapshot as placeholderData so the viewer
 * paints instantly with no fetch flash, then refreshes the full row.
 */
export function useCachedBillById(billId: string | null | undefined) {
  return useQuery({
    queryKey: ['vendor-bill', billId ?? null],
    enabled: !!billId,
    queryFn: () => (billId ? LSApi.fetchVendorBillById(billId) : Promise.resolve(null)),
    staleTime: 60_000,
    placeholderData: () => {
      if (!billId) return null;
      const snap = queryClient.getQueryData<VendorBillRow[] | null>(MY_BILLS_KEY);
      if (!snap) return null;
      return snap.find((b) => b.id === billId) ?? null;
    },
  });
}

export function findCachedBillByOrderToken(token: string): VendorBillRow | null {
  const snap = queryClient.getQueryData<VendorBillRow[] | null>(MY_BILLS_KEY);
  if (!snap) return null;
  const k = stripLeadingHashesFromToken(token).toLowerCase();
  return snap.find((b) => stripLeadingHashesFromToken(b.order_token).toLowerCase() === k) ?? null;
}
