import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { ChevronLeft, Image as ImageIcon, Minus, Save } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { VendorApi, type VendorBillCatalog } from '@/lib/vendor-api';
import { queryClient } from '@/lib/query-client';

type Qty = Record<string, number>;

const GRID_GAP = 10;
const GRID_PAD = 16;

function pickCols(width: number): number {
  if (width >= 1024) return 6;
  if (width >= 768) return 5;
  if (width >= 480) return 4;
  return 3;
}

export default function BillBuilder() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [qty, setQty] = useState<Qty>({});
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);

  const catalogQuery = useQuery({
    queryKey: ['vendor-bill-catalog'],
    queryFn: () => VendorApi.billCatalog(),
    staleTime: 5 * 60_000,
  });

  const lookupQuery = useQuery({
    queryKey: ['vendor-lookup', token],
    enabled: !!token,
    queryFn: () => VendorApi.lookup(String(token)),
  });

  useEffect(() => {
    if (lookupQuery.data?.latest_bill?.line_items && Object.keys(qty).length === 0) {
      const next: Qty = {};
      for (const li of lookupQuery.data.latest_bill.line_items) {
        next[li.id] = Number(li.qty) || 0;
      }
      setQty(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupQuery.data?.latest_bill?.id]);

  const catalog: VendorBillCatalog['items'] = catalogQuery.data?.items ?? [];
  const filtered = useMemo(() => {
    if (!filter.trim()) return catalog;
    const q = filter.trim().toLowerCase();
    return catalog.filter((c) => c.label.toLowerCase().includes(q) || c.id.includes(q));
  }, [catalog, filter]);

  const totals = useMemo(() => {
    let count = 0;
    let sub = 0;
    for (const item of catalog) {
      const q = qty[item.id] ?? 0;
      if (q <= 0) continue;
      count += q;
      sub += q * item.price;
    }
    return { count, subtotal: sub };
  }, [catalog, qty]);

  const bump = useCallback((id: string, delta: number) => {
    Haptics.selectionAsync().catch(() => undefined);
    setQty((prev) => {
      const next = { ...prev };
      const curr = Math.max(0, (next[id] ?? 0) + delta);
      if (curr === 0) delete next[id];
      else next[id] = curr;
      return next;
    });
  }, []);

  const save = async () => {
    if (!token || saving) return;
    const lineItems = Object.entries(qty)
      .filter(([, v]) => v > 0)
      .map(([id, v]) => ({ id, qty: v }));
    if (lineItems.length === 0) {
      Alert.alert('Empty bill', 'Add at least one item.');
      return;
    }
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    try {
      await VendorApi.saveBill({ token: String(token), line_items: lineItems });
      await queryClient.invalidateQueries({ queryKey: ['vendor-bills-recent'] });
      await queryClient.invalidateQueries({ queryKey: ['vendor-revenue-today'] });
      await queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
      await queryClient.invalidateQueries({ queryKey: ['vendor-lookup', token] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      Alert.alert('Saved', 'Bill sent to customer.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      Alert.alert('Save failed', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const { width: screenW } = useWindowDimensions();
  const cols = pickCols(screenW);
  const cardW = Math.floor((screenW - GRID_PAD * 2 - GRID_GAP * (cols - 1)) / cols);

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
        <View className="flex-1">
          <Text className="font-display text-lg font-bold text-ink">Bill builder</Text>
          <Text className="text-xs text-ink-2">
            #{String(token ?? '')} · {lookupQuery.data?.user?.full_name ?? '—'}
          </Text>
        </View>
      </View>

      <View className="px-5 py-3">
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder="Search items..."
          placeholderTextColor="#94A3B8"
          className="min-h-[44px] rounded-sm border border-border bg-surface px-3 text-sm text-ink"
        />
      </View>

      {catalogQuery.isLoading ? (
        <ActivityIndicator color="#1746A2" className="mt-8" />
      ) : (
        <FlatList
          key={`grid-${cols}`}
          data={filtered}
          numColumns={cols}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: GRID_PAD, paddingBottom: 160, gap: GRID_GAP }}
          columnWrapperStyle={cols > 1 ? { gap: GRID_GAP } : undefined}
          renderItem={({ item, index }) => {
            const q = qty[item.id] ?? 0;
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index * 25, 300)).springify()}>
                <ItemCard
                  width={cardW}
                  label={item.label}
                  price={item.price}
                  imageUrl={item.image_url ?? null}
                  qty={q}
                  onAdd={() => bump(item.id, 1)}
                  onRemove={() => bump(item.id, -1)}
                />
              </Animated.View>
            );
          }}
        />
      )}

      <View className="absolute inset-x-0 bottom-0 border-t border-border bg-surface px-5 py-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xs text-ink-2">{totals.count} items</Text>
            <Text className="font-display text-2xl font-bold text-ink">₹{totals.subtotal}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={save}
            disabled={saving || totals.count === 0}
            className="flex-row items-center gap-2 rounded-lg bg-primary px-5 py-3 disabled:opacity-60"
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Save color="#fff" size={18} />}
            <Text className="text-base font-semibold text-white">Save bill</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function ItemCard({
  width,
  label,
  price,
  imageUrl,
  qty,
  onAdd,
  onRemove,
}: {
  width: number;
  label: string;
  price: number;
  imageUrl: string | null;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={{ width }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${label}`}
        onPress={onAdd}
        style={({ pressed }) => (pressed ? { transform: [{ scale: 0.96 }] } : null)}
        className={
          qty > 0
            ? 'overflow-hidden rounded-lg border-2 border-primary bg-primary-light'
            : 'overflow-hidden rounded-lg border border-border bg-surface'
        }
      >
        <View style={{ width, height: width }} className="items-center justify-center bg-bg">
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width, height: width }}
              contentFit="cover"
              transition={120}
            />
          ) : (
            <ImageIcon color="#94A3B8" size={28} />
          )}
          {qty > 0 ? (
            <Animated.View
              key={`badge-${qty}`}
              entering={ZoomIn.springify().damping(12)}
              className="absolute right-1 top-1 min-w-[26px] items-center justify-center rounded-full bg-primary px-2 py-1"
            >
              <Text className="text-xs font-bold text-white">{qty}</Text>
            </Animated.View>
          ) : null}
        </View>
        <View className="p-2">
          <Text numberOfLines={1} className="font-display text-xs font-bold text-ink">
            {label}
          </Text>
          <Text className="text-[11px] text-ink-2">₹{price}</Text>
        </View>
      </Pressable>
      {qty > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove one ${label}`}
          onPress={onRemove}
          className="mt-1 flex-row items-center justify-center gap-1 rounded-md border border-border bg-surface py-1.5"
        >
          <Minus color="#1A1D2E" size={14} />
          <Text className="text-[11px] font-semibold text-ink">1</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
