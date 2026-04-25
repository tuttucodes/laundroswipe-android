import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  ScanQrCode,
  ReceiptText,
  PackageCheck,
  Truck,
  Settings,
  ListChecks,
  Menu,
  TrendingUp,
} from 'lucide-react-native';
import { VendorApi } from '@/lib/vendor-api';
import { useAuth } from '@/store/auth';
import { stripLeadingHashesFromToken } from '@/lib/vendor-bill-token';
import { Logo } from '@/components/ui/Logo';
import { Container } from '@/components/ui/Container';

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function VendorPos() {
  const router = useRouter();
  const admin = useAuth((s) => s.admin);
  const today = todayYmd();
  const [quickToken, setQuickToken] = useState('');
  const [quickLoading, setQuickLoading] = useState<null | 'pickup' | 'delivery'>(null);

  const runQuick = async (action: 'pickup' | 'delivery') => {
    const t = stripLeadingHashesFromToken(quickToken);
    if (!t) {
      Alert.alert('Token required', 'Enter or scan a token first.');
      return;
    }
    setQuickLoading(action);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    try {
      if (action === 'delivery') {
        await VendorApi.confirmDelivery(t);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        Alert.alert('Delivered', `Order #${t} marked delivered.`);
      } else {
        const lookup = await VendorApi.lookup(t);
        await VendorApi.advanceOrder(lookup.order.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        Alert.alert('Pickup confirmed', `Order #${t} status advanced.`);
      }
      setQuickToken('');
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      Alert.alert('Failed', (e as Error).message);
    } finally {
      setQuickLoading(null);
    }
  };

  const revenueQuery = useQuery({
    queryKey: ['vendor-revenue-today'],
    queryFn: () => VendorApi.revenue({ days: 1, from: today, to: today }),
    staleTime: 60_000,
  });

  const billsQuery = useQuery({
    queryKey: ['vendor-bills-recent'],
    queryFn: () => VendorApi.bills({ page: 1, limit: 10 }),
    staleTime: 60_000,
  });

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={revenueQuery.isRefetching || billsQuery.isRefetching}
            onRefresh={() => {
              revenueQuery.refetch();
              billsQuery.refetch();
            }}
            tintColor="#1746A2"
          />
        }
      >
        <Container style={{ padding: 20 }}>
          <Animated.View
            entering={FadeInDown.springify()}
            className="flex-row items-start justify-between"
          >
            <View className="flex-row items-center gap-3">
              <Logo size={36} variant="mark" />
              <View>
                <Text className="text-xs font-semibold text-ink-2">Vendor POS</Text>
                <Text className="mt-1 font-display text-3xl font-bold text-ink">
                  {admin?.vendorId ?? 'Staff'}
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Printer settings"
                onPress={() => router.push('/(vendor)/printer')}
                className="h-10 w-10 items-center justify-center rounded-full bg-surface"
              >
                <Settings color="#1A1D2E" size={20} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Menu"
                onPress={() => router.push('/(vendor)/menu')}
                className="h-10 w-10 items-center justify-center rounded-full bg-surface"
              >
                <Menu color="#1A1D2E" size={20} />
              </Pressable>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(80).springify()}
            className="mt-6 flex-row gap-3"
          >
            <StatCard
              label="Bills today"
              value={String(revenueQuery.data?.total_bills ?? 0)}
              loading={revenueQuery.isLoading}
            />
            <StatCard
              label="Revenue today"
              value={`₹${revenueQuery.data?.grand_total ?? 0}`}
              loading={revenueQuery.isLoading}
            />
          </Animated.View>

          <View className="mt-6 gap-3">
            <Link href="/(vendor)/lookup" asChild>
              <Pressable
                accessibilityRole="button"
                className="flex-row items-center gap-3 rounded-lg bg-primary px-5 py-4"
              >
                <View className="h-11 w-11 items-center justify-center rounded-full bg-white/15">
                  <ScanQrCode color="#fff" size={22} />
                </View>
                <View className="flex-1">
                  <Text className="font-display text-base font-bold text-white">Token lookup</Text>
                  <Text className="text-xs text-white/80">Scan QR or enter token</Text>
                </View>
              </Pressable>
            </Link>
            <View className="rounded-lg bg-surface p-4">
              <Text className="font-display text-sm font-bold text-ink-2">Quick confirm</Text>
              <TextInput
                value={quickToken}
                onChangeText={setQuickToken}
                placeholder="Enter or paste token"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                className="mt-2 min-h-[44px] rounded-sm border border-border bg-bg px-3 text-sm text-ink"
              />
              <View className="mt-3 flex-row gap-2">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => runQuick('pickup')}
                  disabled={quickLoading !== null}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-border bg-bg py-3 disabled:opacity-50"
                >
                  {quickLoading === 'pickup' ? (
                    <ActivityIndicator color="#1746A2" />
                  ) : (
                    <PackageCheck color="#1A1D2E" size={18} />
                  )}
                  <Text className="text-sm font-semibold text-ink">Confirm pickup</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => runQuick('delivery')}
                  disabled={quickLoading !== null}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-success py-3 disabled:opacity-50"
                >
                  {quickLoading === 'delivery' ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Truck color="#fff" size={18} />
                  )}
                  <Text className="text-sm font-semibold text-white">Confirm delivery</Text>
                </Pressable>
              </View>
            </View>

            <Link href="/(vendor)/bills" asChild>
              <Pressable
                accessibilityRole="button"
                className="flex-row items-center gap-3 rounded-lg bg-surface px-5 py-4"
              >
                <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-light">
                  <ReceiptText color="#1746A2" size={22} />
                </View>
                <View className="flex-1">
                  <Text className="font-display text-base font-bold text-ink">All bills</Text>
                  <Text className="text-xs text-ink-2">Filter + export history</Text>
                </View>
              </Pressable>
            </Link>
            <Link href="/(vendor)/catalog" asChild>
              <Pressable
                accessibilityRole="button"
                className="flex-row items-center gap-3 rounded-lg bg-surface px-5 py-4"
              >
                <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-light">
                  <ListChecks color="#1746A2" size={22} />
                </View>
                <View className="flex-1">
                  <Text className="font-display text-base font-bold text-ink">Catalog editor</Text>
                  <Text className="text-xs text-ink-2">Edit item label, price, image</Text>
                </View>
              </Pressable>
            </Link>
            <Link href="/(vendor)/revenue" asChild>
              <Pressable
                accessibilityRole="button"
                className="flex-row items-center gap-3 rounded-lg bg-surface px-5 py-4"
              >
                <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-light">
                  <TrendingUp color="#1746A2" size={22} />
                </View>
                <View className="flex-1">
                  <Text className="font-display text-base font-bold text-ink">
                    Revenue dashboard
                  </Text>
                  <Text className="text-xs text-ink-2">Today · 7d · 30d breakdown</Text>
                </View>
              </Pressable>
            </Link>
          </View>

          <View className="mt-8">
            <Text className="font-display text-base font-bold text-ink">Recent bills</Text>
            {billsQuery.isLoading ? (
              <ActivityIndicator color="#1746A2" className="mt-4" />
            ) : billsQuery.data?.bills.length === 0 ? (
              <Text className="mt-4 text-sm text-ink-2">No bills yet.</Text>
            ) : (
              <View className="mt-3 gap-2">
                {billsQuery.data?.bills.slice(0, 10).map((b) => (
                  <View
                    key={b.id}
                    className="flex-row items-center justify-between rounded-lg bg-surface p-4"
                  >
                    <View className="flex-1">
                      <Text className="font-display text-sm font-bold text-ink">
                        #{b.order_token}
                      </Text>
                      <Text className="text-xs text-ink-2">
                        {b.customer_name ?? 'Customer'} ·{' '}
                        {new Date(b.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <Text className="font-display text-base font-bold text-ink">₹{b.total}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Container>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <View className="flex-1 rounded-lg bg-surface p-4">
      <Text className="text-xs text-ink-2">{label}</Text>
      {loading ? (
        <ActivityIndicator color="#1746A2" className="mt-2" />
      ) : (
        <Text className="mt-1 font-display text-2xl font-bold text-ink">{value}</Text>
      )}
    </View>
  );
}
