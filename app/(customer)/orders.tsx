import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { type OrderRow, type VendorBillRow } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { customerFacingStatusLabel } from '@/lib/constants';
import { stripLeadingHashesFromToken } from '@/lib/vendor-bill-token';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useCachedOrders } from '@/hooks/use-cached-orders';
import { useCachedMyBills } from '@/hooks/use-cached-bills';

export default function OrdersList() {
  const profile = useAuth((s) => s.profile);
  const { isTablet } = useBreakpoint();
  const tabletStyle = isTablet
    ? { maxWidth: 720, alignSelf: 'center' as const, width: '100%' as const }
    : null;

  const ordersQuery = useCachedOrders(profile?.id);
  const billsQuery = useCachedMyBills();

  const rows = ordersQuery.data ?? [];
  const bills = billsQuery.data ?? [];
  const showSkeleton = ordersQuery.isPending && !ordersQuery.data;

  const billsByToken = useMemo(() => {
    const m = new Map<string, VendorBillRow>();
    for (const b of bills) {
      if (b.cancelled_at) continue;
      const k = stripLeadingHashesFromToken(b.order_token).toLowerCase();
      if (!m.has(k)) m.set(k, b);
    }
    return m;
  }, [bills]);

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View style={tabletStyle} className="px-5 pt-3">
        <Text className="font-display text-3xl font-bold text-ink">Orders</Text>
      </View>
      {showSkeleton ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1746A2" />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(o) => o.id}
          contentContainerStyle={[{ padding: 20, paddingBottom: 48, gap: 10 }, tabletStyle]}
          refreshControl={
            <RefreshControl
              refreshing={ordersQuery.isRefetching}
              onRefresh={() => {
                ordersQuery.refetch();
                billsQuery.refetch();
              }}
              tintColor="#1746A2"
            />
          }
          ListEmptyComponent={
            <View className="mt-16 items-center justify-center px-8">
              <Text className="text-center font-display text-lg font-semibold text-ink">
                No orders yet
              </Text>
              <Text className="mt-1 text-center text-sm text-ink-2">
                Book your first pickup from the home tab.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <OrderRowCard
              order={item}
              bill={billsByToken.get(stripLeadingHashesFromToken(item.token).toLowerCase())}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function OrderRowCard({ order, bill }: { order: OrderRow; bill: VendorBillRow | undefined }) {
  const status = customerFacingStatusLabel(order.status, !!bill);
  return (
    <Link href={{ pathname: '/(customer)/orders/[id]', params: { id: order.id } }} asChild>
      <Pressable accessibilityRole="button" className="rounded-lg bg-surface p-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="font-display text-base font-bold text-ink">{order.service_name}</Text>
            <Text className="text-xs text-ink-2">
              #{order.token} · {order.pickup_date} · {order.time_slot}
            </Text>
            {order.vendor_name ? (
              <Text className="mt-1 text-xs text-ink-2">{order.vendor_name}</Text>
            ) : null}
          </View>
          <View className="rounded-full bg-primary-light px-3 py-1">
            <Text className="text-xs font-semibold text-primary">{status}</Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
