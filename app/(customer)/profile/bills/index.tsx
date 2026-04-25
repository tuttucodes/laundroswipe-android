import { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import { type VendorBillRow } from '@/lib/api';
import { useCachedMyBills } from '@/hooks/use-cached-bills';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { SkeletonRow } from '@/components/ui/Skeleton';

export default function MyBills() {
  const router = useRouter();
  const q = useCachedMyBills();
  const { isTablet } = useBreakpoint();
  const tabletStyle = isTablet
    ? { maxWidth: 720, alignSelf: 'center' as const, width: '100%' as const }
    : null;

  const rows = useMemo(() => (q.data ?? []).filter((b) => !b.cancelled_at), [q.data]);
  const showSkeleton = q.isPending && !q.data;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View style={tabletStyle} className="px-5 pt-3">
        <Text className="font-display text-3xl font-bold text-ink">My bills</Text>
      </View>
      {showSkeleton ? (
        <View style={tabletStyle} className="gap-2 px-5 pt-5">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(b) => b.id}
          contentContainerStyle={[{ padding: 20, gap: 10, paddingBottom: 48 }, tabletStyle]}
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching}
              onRefresh={() => q.refetch()}
              tintColor="#1746A2"
            />
          }
          ListEmptyComponent={
            <View className="mt-16 items-center px-8">
              <Text className="text-center font-display text-lg font-semibold text-ink">
                No bills yet
              </Text>
              <Text className="mt-1 text-center text-sm text-ink-2">
                Your vendor bills will show up here after pickup.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index * 30, 300)).springify()}>
              <BillCard
                bill={item}
                onPress={() =>
                  router.push({
                    pathname: '/(customer)/profile/bills/[id]',
                    params: { id: item.id },
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

function BillCard({ bill, onPress }: { bill: VendorBillRow; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center rounded-lg bg-surface p-4 active:opacity-80"
    >
      <View className="flex-1">
        <Text className="font-display text-base font-bold text-ink">#{bill.order_token}</Text>
        <Text className="text-xs text-ink-2">
          {bill.vendor_name ?? 'Partner'} · {new Date(bill.created_at).toLocaleDateString()}
        </Text>
      </View>
      <Text className="font-display text-lg font-bold text-ink">₹{bill.total}</Text>
      <ChevronRight color="#94A3B8" size={18} className="ml-2" />
    </Pressable>
  );
}
