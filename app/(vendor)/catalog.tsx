import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Image as ImageIcon, RotateCcw, Save } from 'lucide-react-native';
import { VendorApi } from '@/lib/vendor-api';
import { useAuth } from '@/store/auth';
import { queryClient } from '@/lib/query-client';

type RowState = { label: string; price: string; image_url: string };

export default function VendorCatalogEditor() {
  const router = useRouter();
  const admin = useAuth((s) => s.admin);
  const slug = admin?.vendorId ?? '';
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const catalogQuery = useQuery({
    queryKey: ['vendor-bill-catalog'],
    queryFn: () => VendorApi.billCatalog(),
  });

  useEffect(() => {
    if (!catalogQuery.data) return;
    const next: Record<string, RowState> = {};
    for (const i of catalogQuery.data.items) {
      next[i.id] = {
        label: i.label,
        price: String(i.price ?? ''),
        image_url: i.image_url ?? '',
      };
    }
    setRows(next);
    setDirty(false);
  }, [catalogQuery.data]);

  const setRow = (id: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    setDirty(true);
  };

  const reset = () => {
    if (!catalogQuery.data) return;
    const next: Record<string, RowState> = {};
    for (const i of catalogQuery.data.items) {
      next[i.id] = {
        label: i.label,
        price: String(i.price ?? ''),
        image_url: i.image_url ?? '',
      };
    }
    setRows(next);
    setDirty(false);
  };

  const save = async () => {
    if (!slug) {
      Alert.alert('Vendor scope missing', 'Sign in as a vendor account to edit the catalog.');
      return;
    }
    if (saving) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    const overrides: Record<string, { label?: string; price?: number; image_url?: string | null }> =
      {};
    for (const [id, r] of Object.entries(rows)) {
      const p = Number(r.price);
      if (!Number.isFinite(p) || p <= 0) continue;
      overrides[id] = {
        label: r.label.trim(),
        price: p,
        image_url: r.image_url.trim() ? r.image_url.trim() : null,
      };
    }
    try {
      await VendorApi.updateBillCatalog(slug, overrides);
      await queryClient.invalidateQueries({ queryKey: ['vendor-bill-catalog'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      Alert.alert('Saved', 'Catalog updated.');
      setDirty(false);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      Alert.alert('Save failed', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const items = catalogQuery.data?.items ?? [];
  const filtered = filter.trim()
    ? items.filter(
        (i) =>
          i.label.toLowerCase().includes(filter.trim().toLowerCase()) ||
          i.id.includes(filter.trim()),
      )
    : items;

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
          <Text className="font-display text-lg font-bold text-ink">Catalog editor</Text>
          <Text className="text-xs text-ink-2">{slug || 'No vendor scope'}</Text>
        </View>
        {dirty ? (
          <Pressable
            accessibilityRole="button"
            onPress={reset}
            className="h-10 w-10 items-center justify-center rounded-full bg-surface"
          >
            <RotateCcw color="#1A1D2E" size={18} />
          </Pressable>
        ) : null}
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
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 140 }}
          renderItem={({ item, index }) => {
            const r = rows[item.id] ?? {
              label: item.label,
              price: String(item.price ?? ''),
              image_url: item.image_url ?? '',
            };
            return (
              <Animated.View
                entering={FadeInDown.delay(Math.min(index * 25, 300)).springify()}
                className="flex-row gap-3 rounded-lg bg-surface p-3"
              >
                <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-md bg-bg">
                  {r.image_url ? (
                    <Image
                      source={{ uri: r.image_url }}
                      style={{ width: 64, height: 64 }}
                      contentFit="cover"
                    />
                  ) : (
                    <ImageIcon color="#94A3B8" size={22} />
                  )}
                </View>
                <View className="flex-1 gap-2">
                  <TextInput
                    value={r.label}
                    onChangeText={(v) => setRow(item.id, { label: v })}
                    placeholder="Label"
                    placeholderTextColor="#94A3B8"
                    className="min-h-[36px] rounded-sm border border-border bg-bg px-2 text-sm text-ink"
                  />
                  <View className="flex-row gap-2">
                    <TextInput
                      value={r.price}
                      onChangeText={(v) => setRow(item.id, { price: v.replace(/[^\d.]/g, '') })}
                      placeholder="Price"
                      placeholderTextColor="#94A3B8"
                      keyboardType="decimal-pad"
                      className="min-h-[36px] w-24 rounded-sm border border-border bg-bg px-2 text-sm text-ink"
                    />
                    <TextInput
                      value={r.image_url}
                      onChangeText={(v) => setRow(item.id, { image_url: v })}
                      placeholder="Image URL (https://…)"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="min-h-[36px] flex-1 rounded-sm border border-border bg-bg px-2 text-sm text-ink"
                    />
                  </View>
                </View>
              </Animated.View>
            );
          }}
        />
      )}

      <View className="absolute inset-x-0 bottom-0 border-t border-border bg-surface px-5 py-4">
        <Pressable
          accessibilityRole="button"
          onPress={save}
          disabled={saving || !dirty}
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
          className="flex-row items-center justify-center gap-2 rounded-lg bg-primary py-3 disabled:opacity-60"
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Save color="#fff" size={18} />}
          <Text className="text-base font-semibold text-white">
            {dirty ? 'Save changes' : 'No changes'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
