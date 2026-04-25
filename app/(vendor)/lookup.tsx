import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScanQrCode, Search } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { VendorApi, type VendorOrderLookup } from '@/lib/vendor-api';
import { stripLeadingHashesFromToken } from '@/lib/vendor-bill-token';
import { ApiError } from '@/lib/api-client';

type LookupState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'success'; data: VendorOrderLookup }
  | { state: 'error'; error: string };

export default function VendorLookup() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [scanOn, setScanOn] = useState(false);
  const [perm, requestPerm] = useCameraPermissions();
  const [lookup, setLookup] = useState<LookupState>({ state: 'idle' });
  const lastScan = useRef<{ token: string; at: number } | null>(null);

  const run = async (raw: string) => {
    const cleaned = stripLeadingHashesFromToken(raw);
    if (!cleaned) return;
    setToken(cleaned);
    setLookup({ state: 'loading' });
    try {
      const res = await VendorApi.lookup(cleaned);
      setLookup({ state: 'success', data: res });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setLookup({ state: 'error', error: msg });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    }
  };

  const onScan = ({ data }: { data: string }) => {
    const now = Date.now();
    if (lastScan.current && lastScan.current.token === data && now - lastScan.current.at < 2000)
      return;
    lastScan.current = { token: data, at: now };
    let payload = data;
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed?.t === 'string') payload = parsed.t;
    } catch {
      /* raw token string */
    }
    setScanOn(false);
    run(payload);
  };

  const advance = async (orderId: string) => {
    try {
      await VendorApi.advanceOrder(orderId);
      Alert.alert('Updated', 'Order status advanced.');
      if (lookup.state === 'success') run(lookup.data.order.token);
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    }
  };

  const confirmDelivery = async () => {
    if (lookup.state !== 'success') return;
    try {
      await VendorApi.confirmDelivery(lookup.data.order.token);
      Alert.alert('Delivered', 'Marked as delivered.');
      run(lookup.data.order.token);
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <Text className="font-display text-3xl font-bold text-ink">Token lookup</Text>

        <View className="mt-6 flex-row gap-2">
          <View className="flex-1 flex-row items-center rounded-sm border border-border bg-surface px-3">
            <Search color="#94A3B8" size={18} />
            <TextInput
              value={token}
              onChangeText={setToken}
              onSubmitEditing={() => run(token)}
              placeholder="Enter or paste token"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              className="ml-2 min-h-[48px] flex-1 text-base text-ink"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              if (!perm?.granted) {
                const r = await requestPerm();
                if (!r.granted) return;
              }
              setScanOn(true);
            }}
            className="h-12 w-12 items-center justify-center rounded-sm bg-primary"
          >
            <ScanQrCode color="#fff" size={22} />
          </Pressable>
        </View>

        {scanOn ? (
          <View className="mt-4 aspect-square overflow-hidden rounded-lg">
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={onScan}
            />
            <Pressable
              onPress={() => setScanOn(false)}
              className="absolute inset-x-0 bottom-4 mx-auto w-32 items-center justify-center rounded-full bg-black/70 py-2"
            >
              <Text className="text-sm font-semibold text-white">Cancel</Text>
            </Pressable>
          </View>
        ) : null}

        {lookup.state === 'loading' ? (
          <ActivityIndicator color="#1746A2" className="mt-8" />
        ) : lookup.state === 'error' ? (
          <Text className="mt-6 text-sm text-error">{lookup.error}</Text>
        ) : lookup.state === 'success' ? (
          <LookupResult
            data={lookup.data}
            onAdvance={advance}
            onConfirmDelivery={confirmDelivery}
            onOpenBuilder={() =>
              router.push({
                pathname: '/(vendor)/bill-builder',
                params: { token: lookup.data.order.token },
              })
            }
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function LookupResult({
  data,
  onAdvance,
  onConfirmDelivery,
  onOpenBuilder,
}: {
  data: VendorOrderLookup;
  onAdvance: (orderId: string) => void;
  onConfirmDelivery: () => void;
  onOpenBuilder: () => void;
}) {
  const u = data.user;
  const o = data.order;
  const bill = data.latest_bill;
  return (
    <View className="mt-6 gap-3">
      <View className="rounded-lg bg-surface p-4">
        <Text className="font-display text-sm font-bold text-ink-2">Customer</Text>
        <Text className="mt-1 font-display text-lg font-bold text-ink">{u?.full_name ?? '—'}</Text>
        <Text className="text-xs text-ink-2">
          {u?.phone ?? '—'} · {u?.email ?? '—'}
        </Text>
        {u?.reg_no ? <Text className="mt-1 text-xs text-ink-2">Reg: {u.reg_no}</Text> : null}
        {u?.hostel_block || u?.room_number ? (
          <Text className="mt-1 text-xs text-ink-2">
            Block {u?.hostel_block ?? '—'} · Room {u?.room_number ?? '—'}
          </Text>
        ) : null}
      </View>

      <View className="rounded-lg bg-surface p-4">
        <Text className="font-display text-sm font-bold text-ink-2">Order</Text>
        <Text className="mt-1 font-display text-base font-bold text-ink">#{o.token}</Text>
        <Text className="text-xs text-ink-2">
          {o.service_name} · {o.pickup_date} · {o.time_slot}
        </Text>
        <Text className="mt-1 text-xs font-semibold text-primary">
          {o.status.replace(/_/g, ' ')}
        </Text>
        {o.instructions ? (
          <Text className="mt-2 text-xs text-ink-2">"{o.instructions}"</Text>
        ) : null}
      </View>

      {bill ? (
        <View className="rounded-lg bg-surface p-4">
          <Text className="font-display text-sm font-bold text-ink-2">Latest bill</Text>
          <View className="mt-1 flex-row items-center justify-between">
            <Text className="text-sm text-ink">{bill.total_items} items</Text>
            <Text className="font-display text-lg font-bold text-ink">₹{bill.total}</Text>
          </View>
          {bill.can_cancel ? (
            <Text className="mt-1 text-xs text-ink-2">Can edit / cancel within window.</Text>
          ) : null}
        </View>
      ) : (
        <Text className="text-sm text-ink-2">No bill yet.</Text>
      )}

      <View className="mt-4 gap-2">
        <Pressable
          accessibilityRole="button"
          onPress={onOpenBuilder}
          className="min-h-[52px] items-center justify-center rounded-lg bg-primary"
        >
          <Text className="text-base font-semibold text-white">
            {bill ? 'Edit bill' : 'Create bill'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onAdvance(o.id)}
          className="min-h-[48px] items-center justify-center rounded-lg border border-border bg-surface"
        >
          <Text className="text-base font-semibold text-ink">Advance status</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onConfirmDelivery}
          className="min-h-[48px] items-center justify-center rounded-lg border border-border bg-surface"
        >
          <Text className="text-base font-semibold text-ink">Confirm delivery</Text>
        </Pressable>
      </View>
    </View>
  );
}
