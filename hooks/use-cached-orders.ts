import { useQuery } from '@tanstack/react-query';
import { LSApi, type OrderRow } from '@/lib/api';
import { queryClient } from '@/lib/query-client';

export const ORDERS_KEY = (userId: string | null | undefined) =>
  ['orders', userId ?? null] as const;

export function useCachedOrders(userId: string | null | undefined) {
  return useQuery({
    queryKey: ORDERS_KEY(userId),
    enabled: !!userId,
    queryFn: () => (userId ? LSApi.fetchOrdersForUser(userId) : Promise.resolve(null)),
    staleTime: 30_000,
    networkMode: 'offlineFirst',
  });
}

/**
 * Order detail: hydrates from the list snapshot first, then refetches the
 * full record (which may include extra fields like instructions / comments).
 */
export function useCachedOrderById(
  userId: string | null | undefined,
  orderId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['order', orderId ?? null],
    enabled: !!orderId,
    queryFn: () => (orderId ? LSApi.fetchOrderFullById(orderId) : Promise.resolve(null)),
    staleTime: 30_000,
    placeholderData: () => {
      if (!orderId) return undefined;
      const snap = queryClient.getQueryData<OrderRow[] | null>(ORDERS_KEY(userId));
      if (!snap) return undefined;
      return snap.find((o) => o.id === orderId) ?? undefined;
    },
  });
}
