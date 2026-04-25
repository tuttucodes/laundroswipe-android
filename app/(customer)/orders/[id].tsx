import { useMemo, useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, QrCode, Store } from 'lucide-react-native';
import {
  STATUSES,
  STATUS_LABELS,
  customerFacingStatusLabel,
  type OrderStatus,
} from '@/lib/constants';
import { stripLeadingHashesFromToken } from '@/lib/vendor-bill-token';
import { useAuth } from '@/store/auth';
import { DigitalHandshake, type HandshakeRef } from '@/components/user/DigitalHandshake';
import { useCachedOrderById } from '@/hooks/use-cached-orders';
import { useCachedMyBills } from '@/hooks/use-cached-bills';
import { Container } from '@/components/ui/Container';

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const profile = useAuth((s) => s.profile);
  const handshake = useRef<HandshakeRef>(null);

  const orderQuery = useCachedOrderById(profile?.id, id ? String(id) : null);
  const billsQuery = useCachedMyBills();

  const order = orderQuery.data ?? null;
  const showSkeleton = orderQuery.isPending && !orderQuery.data;
  const bill = useMemo(() => {
    if (!order) return null;
    const key = stripLeadingHashesFromToken(order.token).toLowerCase();
    return (
      (billsQuery.data ?? []).find(
        (b) => !b.cancelled_at && stripLeadingHashesFromToken(b.order_token).toLowerCase() === key,
      ) ?? null
    );
  }, [order, billsQuery.data]);

  if (showSkeleton) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color="#1746A2" />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg px-8">
        <Text className="text-center font-display text-lg font-semibold text-ink">
          Order not found
        </Text>
      </SafeAreaView>
    );
  }

  const currentIdx = STATUSES.indexOf(order.status as OrderStatus);
  const headerStatus = customerFacingStatusLabel(order.status, !!bill);

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3 px-5 pt-3">
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface"
        >
          <ChevronLeft color="#1A1D2E" size={22} />
        </Pressable>
        <Text className="font-display text-lg font-bold text-ink">
          Order #{stripLeadingHashesFromToken(order.token)}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <Container style={{ padding: 20 }}>
          <View className="rounded-lg bg-primary px-5 py-5">
            <Text className="text-xs font-semibold text-white/70">Status</Text>
            <Text className="mt-1 font-display text-2xl font-bold text-white">{headerStatus}</Text>
            <Text className="mt-1 text-sm text-white/80">
              {order.pickup_date} · {order.time_slot}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => handshake.current?.open()}
            className="mt-4 flex-row items-center gap-3 rounded-lg bg-surface p-4"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-light">
              <QrCode color="#1746A2" size={20} />
            </View>
            <View className="flex-1">
              <Text className="font-display text-base font-bold text-ink">
                Confirm pickup / delivery
              </Text>
              <Text className="text-xs text-ink-2">
                Show this QR to the laundry agent at pickup and at delivery.
              </Text>
            </View>
          </Pressable>

          <View className="mt-6">
            <Text className="mb-3 font-display text-base font-bold text-ink">Progress</Text>
            <View className="rounded-lg bg-surface p-4">
              {STATUSES.map((s, i) => {
                const done = i < currentIdx || (i === currentIdx && order.status === 'delivered');
                const active = i === currentIdx;
                return (
                  <View key={s} className="flex-row items-start gap-3 py-2">
                    <View
                      className={
                        done
                          ? 'mt-1 h-3 w-3 rounded-full bg-success'
                          : active
                            ? 'mt-1 h-3 w-3 rounded-full bg-primary'
                            : 'mt-1 h-3 w-3 rounded-full bg-border'
                      }
                    />
                    <View className="flex-1">
                      <Text
                        className={
                          active ? 'text-sm font-semibold text-primary' : 'text-sm text-ink'
                        }
                      >
                        {STATUS_LABELS[s]}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {bill ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/(customer)/profile/bills/[id]', params: { id: bill.id } })
              }
              className="mt-6 rounded-lg bg-surface p-4 active:opacity-80"
            >
              <Text className="font-display text-base font-bold text-ink">Bill ready</Text>
              <View className="mt-2 flex-row items-center justify-between">
                <Text className="text-sm text-ink-2">Tap to view</Text>
                <Text className="font-display text-xl font-bold text-ink">₹{bill.total}</Text>
              </View>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(customer)/vendor/profab')}
            className="mt-4 flex-row items-center gap-3 rounded-lg bg-surface p-4 active:opacity-80"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-light">
              <Store color="#1746A2" size={20} />
            </View>
            <View className="flex-1">
              <Text className="font-display text-base font-bold text-ink">
                About {order.vendor_name ?? 'your laundry partner'}
              </Text>
              <Text className="text-xs text-ink-2">Pricing · contact · service details</Text>
            </View>
          </Pressable>

          {order.instructions ? (
            <View className="mt-6 rounded-lg bg-surface p-4">
              <Text className="font-display text-sm font-bold text-ink">Your instructions</Text>
              <Text className="mt-2 text-sm text-ink-2">{order.instructions}</Text>
            </View>
          ) : null}
        </Container>
      </ScrollView>

      <DigitalHandshake
        ref={handshake}
        payload={
          profile
            ? {
                token: stripLeadingHashesFromToken(order.token),
                orderId: order.id,
                userId: profile.id,
                name: profile.full_name,
              }
            : null
        }
      />
    </SafeAreaView>
  );
}
