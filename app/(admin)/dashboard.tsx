import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { AdminApi } from '@/lib/admin-api';
import { clearAdminSession } from '@/lib/admin-auth';
import { useAuth } from '@/store/auth';
import { queryClient } from '@/lib/query-client';
import { Container } from '@/components/ui/Container';
import { Logo } from '@/components/ui/Logo';

export default function AdminDashboard() {
  const router = useRouter();
  const admin = useAuth((s) => s.admin);
  const setAdmin = useAuth((s) => s.setAdmin);

  const q = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => AdminApi.overview(),
    staleTime: 60_000,
  });

  const signOut = async () => {
    await clearAdminSession();
    setAdmin(null);
    router.replace('/(auth)/login');
  };

  const advance = async (orderId: string) => {
    try {
      await AdminApi.advanceOrder(orderId);
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    }
  };

  const grandTotal = (q.data?.vendor_bills ?? []).reduce((s, b) => s + (Number(b.total) || 0), 0);
  const activeOrders = (q.data?.orders ?? []).filter((o) => o.status !== 'delivered').length;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => q.refetch()}
            tintColor="#1746A2"
          />
        }
      >
        <Container style={{ padding: 20 }}>
          <View className="flex-row items-start justify-between">
            <View className="flex-row items-center gap-3">
              <Logo size={36} variant="mark" />
              <View>
                <Text className="text-xs font-semibold text-ink-2">Admin</Text>
                <Text className="mt-1 font-display text-3xl font-bold text-ink">Overview</Text>
                <Text className="text-xs text-ink-2">
                  {admin?.vendorId ? `Scoped to ${admin.vendorId}` : 'All vendors'}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={signOut}
              accessibilityRole="button"
              className="h-10 w-10 items-center justify-center rounded-full bg-surface"
            >
              <LogOut color="#DC2626" size={20} />
            </Pressable>
          </View>

          {q.isLoading ? (
            <ActivityIndicator color="#1746A2" className="mt-6" />
          ) : (
            <>
              <View className="mt-6 flex-row gap-3">
                <Stat label="Active orders" value={String(activeOrders)} />
                <Stat label="Total bills" value={String(q.data?.vendor_bills.length ?? 0)} />
                <Stat label="Revenue" value={`₹${grandTotal}`} />
              </View>

              <View className="mt-8">
                <Text className="font-display text-base font-bold text-ink">Recent orders</Text>
                <FlatList
                  scrollEnabled={false}
                  data={(q.data?.orders ?? []).slice(0, 20)}
                  keyExtractor={(o) => o.id}
                  contentContainerStyle={{ marginTop: 10, gap: 8 }}
                  renderItem={({ item }) => (
                    <View className="rounded-lg bg-surface p-4">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text className="font-display text-sm font-bold text-ink">
                            #{item.token}
                          </Text>
                          <Text className="text-xs text-ink-2">
                            {item.service_name} · {item.pickup_date} · {item.vendor_name ?? '—'}
                          </Text>
                        </View>
                        <Text className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
                          {item.status}
                        </Text>
                      </View>
                      {item.status !== 'delivered' ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => advance(item.id)}
                          className="mt-2 items-center justify-center rounded-sm border border-primary bg-primary-light px-3 py-2"
                        >
                          <Text className="text-xs font-semibold text-primary">Advance →</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  )}
                />
              </View>
            </>
          )}
        </Container>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-lg bg-surface p-4">
      <Text className="text-xs text-ink-2">{label}</Text>
      <Text className="mt-1 font-display text-xl font-bold text-ink">{value}</Text>
    </View>
  );
}
