import { useQuery } from '@tanstack/react-query';
import { ScrollView, Text, View, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LSApi, type BootstrapPayload, type OrderRow } from '@/lib/api';
import { customerFacingStatusLabel } from '@/lib/constants';
import { useAuth } from '@/store/auth';
import { stripLeadingHashesFromToken } from '@/lib/vendor-bill-token';
import { useRegisterPush } from '@/hooks/use-register-push';
import { Logo } from '@/components/ui/Logo';
import { Container } from '@/components/ui/Container';
import { SkeletonRow } from '@/components/ui/Skeleton';

function firstName(full: string | null | undefined): string {
  const s = String(full ?? '').trim();
  if (!s) return 'there';
  return s.split(/\s+/)[0];
}

function activeOrders(payload: BootstrapPayload | null | undefined): OrderRow[] {
  if (!payload) return [];
  return (payload.orders ?? []).filter((o) => o.status !== 'delivered').slice(0, 5);
}

export default function CustomerHome() {
  const profile = useAuth((s) => s.profile);
  useRegisterPush();

  const query = useQuery({
    queryKey: ['bootstrap'],
    queryFn: () => LSApi.fetchBootstrap(),
    staleTime: 30_000,
    networkMode: 'offlineFirst',
  });

  const bootstrap = query.data ?? null;
  const active = activeOrders(bootstrap);
  const showSkeleton = query.isPending && !query.data;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => query.refetch()}
            tintColor="#1746A2"
          />
        }
      >
        <Container style={{ padding: 20 }}>
          <Animated.View
            entering={FadeInDown.springify()}
            className="flex-row items-center justify-between"
          >
            <View className="flex-1">
              <Text className="font-display text-sm text-ink-2">
                Hey {firstName(profile?.full_name ?? bootstrap?.user?.full_name)},
              </Text>
              <Text className="mt-1 font-display text-3xl font-bold text-ink">
                Fresh laundry, one swipe away.
              </Text>
            </View>
            <Logo size={36} variant="mark" />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Link href="/(customer)/schedule" asChild>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
                className="mt-6 min-h-[56px] flex-row items-center justify-between rounded-lg bg-primary px-5"
              >
                <View>
                  <Text className="text-sm font-semibold text-white/80">Book a pickup</Text>
                  <Text className="text-lg font-bold text-white">Schedule in 30 sec</Text>
                </View>
                <View className="h-10 w-10 items-center justify-center rounded-lg bg-white/15">
                  <Text className="text-lg text-white">→</Text>
                </View>
              </Pressable>
            </Link>
          </Animated.View>

          <View className="mt-8 flex-row items-center justify-between">
            <Text className="font-display text-lg font-bold text-ink">Active orders</Text>
            <Link href="/(customer)/orders" className="text-sm text-primary">
              See all
            </Link>
          </View>

          {showSkeleton ? (
            <View className="mt-3 gap-2">
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : active.length === 0 ? (
            <View className="mt-4 items-center justify-center rounded-lg border border-dashed border-border bg-surface px-6 py-10">
              <Text className="text-center font-display text-base font-semibold text-ink">
                No active pickups
              </Text>
              <Text className="mt-1 text-center text-sm text-ink-2">
                Book one above and track it in real time.
              </Text>
            </View>
          ) : (
            <View className="mt-3 gap-2">
              {active.map((o, i) => (
                <Animated.View key={o.id} entering={FadeInDown.delay(150 + i * 60).springify()}>
                  <OrderCard order={o} bills={bootstrap?.bills ?? []} />
                </Animated.View>
              ))}
            </View>
          )}

          <Animated.View
            entering={FadeIn.delay(400)}
            className="mt-10 rounded-lg bg-teal-light px-5 py-6"
          >
            <Text className="font-display text-base font-bold text-ink">Green mode</Text>
            <Text className="mt-1 text-sm text-ink-2">
              Low-emission wash cycles. Save water, save clothes.
            </Text>
          </Animated.View>
        </Container>
      </ScrollView>
    </SafeAreaView>
  );
}

function OrderCard({ order, bills }: { order: OrderRow; bills: BootstrapPayload['bills'] }) {
  const tokenKey = stripLeadingHashesFromToken(order.token).toLowerCase();
  const hasBill = bills.some(
    (b) => stripLeadingHashesFromToken(b.order_token).toLowerCase() === tokenKey && !b.cancelled_at,
  );
  const status = customerFacingStatusLabel(order.status, hasBill);
  return (
    <Link href={{ pathname: '/(customer)/orders/[id]', params: { id: order.id } } as any} asChild>
      <Pressable
        accessibilityRole="button"
        className="flex-row items-center gap-3 rounded-lg bg-surface p-4 shadow"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-light">
          <Text className="font-display text-base font-bold text-primary">#</Text>
        </View>
        <View className="flex-1">
          <Text className="font-display text-base font-bold text-ink">{order.service_name}</Text>
          <Text className="text-xs text-ink-2" numberOfLines={1}>
            {order.pickup_date} · {order.time_slot} · {order.vendor_name ?? 'Partner'}
          </Text>
        </View>
        <View className="rounded-full bg-primary-light px-3 py-1">
          <Text className="text-xs font-semibold text-primary">{status}</Text>
        </View>
      </Pressable>
    </Link>
  );
}
