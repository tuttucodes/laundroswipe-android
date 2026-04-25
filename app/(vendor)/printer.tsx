import { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bluetooth, ChevronLeft, Check, Printer, RefreshCw } from 'lucide-react-native';
import { useBluetoothPrinter } from '@/hooks/use-bluetooth-printer';
import { Container } from '@/components/ui/Container';
import { buildVendorReceiptEscPos } from '@/lib/printing/receipt/vendorReceipt';
import type { PaperSize } from '@/lib/printing/escpos/ESCPOSBuilder';
import type { PrintDensity } from '@/lib/printing/printer-prefs';

const PAPER_OPTIONS: PaperSize[] = ['58mm', '76mm', '78mm', '80mm'];
const DENSITY_OPTIONS: PrintDensity[] = ['light', 'medium', 'dark'];

export default function PrinterSettings() {
  const router = useRouter();
  const printer = useBluetoothPrinter();

  useEffect(() => {
    printer.refresh().catch((e) => Alert.alert('Bluetooth', (e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const testPrint = async () => {
    if (!printer.prefs?.mac) {
      Alert.alert('No printer', 'Pick a paired printer first.');
      return;
    }
    const bytes = buildVendorReceiptEscPos(printer.prefs.paper, {
      vendorName: 'LaundroSwipe Test',
      tokenLabel: 'TEST123',
      orderLabel: 'TEST',
      customerLabel: 'Test customer',
      phoneLabel: '+91 00000 00000',
      customerDisplayId: 'TEST',
      dateStr: new Date().toLocaleString(),
      lineItems: [
        { label: 'Shirt', qty: 2, price: 30 },
        { label: 'Trouser', qty: 1, price: 40 },
      ],
      totalItems: 3,
      subtotal: 100,
      serviceFeeLine: 'Convenience: Rs.10.00',
      total: 110,
      footer: 'Test print — receipt OK!',
    });
    const r = await printer.print(bytes);
    if (!r.ok) Alert.alert('Print failed', r.error);
    else Alert.alert('Sent', 'Test receipt sent to printer.');
  };

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
        <Text className="font-display text-lg font-bold text-ink">Printer settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <Container style={{ padding: 20 }}>
          <View className="rounded-lg bg-surface p-4">
            <View className="flex-row items-center gap-2">
              <Bluetooth color={printer.btOn ? '#1746A2' : '#94A3B8'} size={18} />
              <Text className="font-display text-sm font-bold text-ink">
                Bluetooth: {printer.btOn === null ? '…' : printer.btOn ? 'On' : 'Off'}
              </Text>
            </View>
            {printer.prefs?.mac ? (
              <Text className="mt-2 text-xs text-ink-2">
                Selected: {printer.prefs.name ?? 'Unknown'} — {printer.prefs.mac}
              </Text>
            ) : (
              <Text className="mt-2 text-xs text-ink-2">No printer selected.</Text>
            )}
          </View>

          <View className="mt-6 flex-row items-center justify-between">
            <Text className="font-display text-base font-bold text-ink">
              {Platform.OS === 'ios' ? 'Nearby printers' : 'Paired devices'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                printer.refresh().catch((e) => Alert.alert('Bluetooth', (e as Error).message))
              }
              className="h-9 w-9 items-center justify-center rounded-full bg-surface"
            >
              {printer.refreshing ? (
                <ActivityIndicator color="#1746A2" />
              ) : (
                <RefreshCw color="#1A1D2E" size={16} />
              )}
            </Pressable>
          </View>

          <View className="mt-2 gap-2">
            {printer.paired.length === 0 ? (
              <Text className="rounded-lg bg-surface p-4 text-xs text-ink-2">
                {Platform.OS === 'ios'
                  ? 'No printers found yet. Power on your BLE thermal printer and tap refresh — scanning takes ~6 seconds.'
                  : 'No paired devices. Pair your thermal printer in Android Settings → Bluetooth, then tap refresh.'}
              </Text>
            ) : (
              printer.paired.map((d) => {
                const selected = printer.prefs?.mac === d.address;
                return (
                  <Pressable
                    key={d.address}
                    accessibilityRole="button"
                    onPress={() => printer.selectPrinter(d)}
                    className={
                      selected
                        ? 'flex-row items-center justify-between rounded-lg border-2 border-primary bg-primary-light p-4'
                        : 'flex-row items-center justify-between rounded-lg bg-surface p-4'
                    }
                  >
                    <View className="flex-1">
                      <Text className="font-display text-sm font-bold text-ink">
                        {d.name ?? 'Unknown'}
                      </Text>
                      <Text className="text-xs text-ink-2">{d.address}</Text>
                    </View>
                    {selected ? <Check color="#1746A2" size={20} /> : null}
                  </Pressable>
                );
              })
            )}
          </View>

          <Text className="mt-6 font-display text-base font-bold text-ink">Paper size</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {PAPER_OPTIONS.map((p) => {
              const sel = printer.prefs?.paper === p;
              return (
                <Pressable
                  key={p}
                  accessibilityRole="button"
                  onPress={() => printer.setPaper(p)}
                  className={
                    sel
                      ? 'rounded-full bg-primary px-4 py-2'
                      : 'rounded-full border border-border bg-surface px-4 py-2'
                  }
                >
                  <Text
                    className={
                      sel ? 'text-xs font-semibold text-white' : 'text-xs font-semibold text-ink'
                    }
                  >
                    {p}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="mt-6 font-display text-base font-bold text-ink">Print density</Text>
          <View className="mt-2 flex-row gap-2">
            {DENSITY_OPTIONS.map((d) => {
              const sel = printer.prefs?.printDensity === d;
              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  onPress={() => printer.setDensity(d)}
                  className={
                    sel
                      ? 'flex-1 rounded-lg bg-primary py-3'
                      : 'flex-1 rounded-lg border border-border bg-surface py-3'
                  }
                >
                  <Text
                    className={
                      sel
                        ? 'text-center text-xs font-semibold text-white'
                        : 'text-center text-xs font-semibold text-ink'
                    }
                  >
                    {d}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={testPrint}
            disabled={printer.printing}
            className="mt-8 flex-row items-center justify-center gap-2 rounded-lg bg-primary py-4 disabled:opacity-60"
          >
            {printer.printing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Printer color="#fff" size={20} />
            )}
            <Text className="text-base font-semibold text-white">Print test receipt</Text>
          </Pressable>
        </Container>
      </ScrollView>
    </SafeAreaView>
  );
}
