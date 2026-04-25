import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronRight, Search, Settings } from 'lucide-react-native';
import { VendorApi } from '@/lib/vendor-api';
import type { VendorBillRow } from '@/lib/api';

export default function VendorBillsList() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [query, setQuery] = useState('');

  const billsQuery = useQuery({
    queryKey: ['vendor-bills', query],
    queryFn: () => VendorApi.bills({ page: 1, limit: 50, token: query || undefined }),
    staleTime: 30_000,
  });

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-5 pt-3">
        <Text className="font-display text-3xl font-bold text-ink">All bills</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Printer settings"
          onPress={() => router.push('/(vendor)/printer')}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface"
        >
          <Settings color="#1A1D2E" size={20} />
        </Pressable>
      </View>

      <View className="px-5 py-3">
        <View className="flex-row items-center rounded-sm border border-border bg-surface px-3">
          <Search color="#94A3B8" size={18} />
          <TextInput
            value={token}
            onChangeText={setToken}
            onSubmitEditing={() => setQuery(token.trim())}
            placeholder="Filter by token..."
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
            className="ml-2 min-h-[44px] flex-1 text-sm text-ink"
          />
        </View>
      </View>

      {billsQuery.isLoading ? (
        <ActivityIndicator color="#1746A2" className="mt-8" />
      ) : (
        <FlatList
          data={billsQuery.data?.bills ?? []}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 48 }}
          refreshControl={
            <RefreshControl
              refreshing={billsQuery.isRefetching}
              onRefresh={() => billsQuery.refetch()}
              tintColor="#1746A2"
            />
          }
          ListEmptyComponent={
            <View className="mt-16 items-center px-8">
              <Text className="text-center font-display text-lg font-semibold text-ink">
                No bills
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index * 30, 300)).springify()}>
              <Row
                bill={item}
                onPress={() =>
                  router.push({
                    pathname: '/(vendor)/bills/[id]',
                    params: { id: item.id, token: item.order_token },
                  })
                }
              />
            </Animated.View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Row({ bill, onPress }: { bill: VendorBillRow; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center rounded-lg bg-surface p-4 active:opacity-80"
    >
      <View className="flex-1">
        <Text className="font-display text-base font-bold text-ink">#{bill.order_token}</Text>
        <Text className="text-xs text-ink-2">
          {bill.customer_name ?? 'Customer'} · {new Date(bill.created_at).toLocaleString()}
        </Text>
        {bill.cancelled_at ? (
          <Text className="mt-1 text-xs font-semibold text-error">Cancelled</Text>
        ) : null}
      </View>
      <Text className="font-display text-lg font-bold text-ink">₹{bill.total}</Text>
      <ChevronRight color="#94A3B8" size={18} className="ml-2" />
    </Pressable>
  );
}
