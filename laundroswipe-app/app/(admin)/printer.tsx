import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import type { BtDeviceRow } from '@/lib/rn-bluetooth-print';
import {
  connectBluetoothPrinter,
  getPreferredPrinterAddress,
  printSelfTest,
  printVendorBillPlain,
  scanBluetoothDevices,
} from '@/lib/rn-bluetooth-print';
import type { VendorBillRow } from '@/lib/api-types';

const DEMO_BILL: VendorBillRow = {
  id: 'demo',
  order_id: null,
  order_token: 'DEMO1',
  order_number: 'ON-DEMO',
  customer_name: 'Demo Customer',
  customer_phone: '9000000000',
  user_display_id: 'DEMO',
  user_id: null,
  line_items: [
    { id: 'shirt', label: 'Shirt', price: 22, qty: 2 },
    { id: 'pant', label: 'Pant', price: 22, qty: 1 },
  ],
  subtotal: 66,
  convenience_fee: 0,
  total: 66,
  vendor_name: 'LaundroSwipe Demo',
  created_at: new Date().toISOString(),
};

export default function AdminPrinterScreen() {
  const [paired, setPaired] = useState<BtDeviceRow[]>([]);
  const [found, setFound] = useState<BtDeviceRow[]>([]);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const refreshSaved = useCallback(async () => {
    setSaved(await getPreferredPrinterAddress());
  }, []);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  const scan = async () => {
    setScanning(true);
    try {
      const { paired: p, found: f } = await scanBluetoothDevices();
      setPaired(p);
      setFound(f);
    } catch (e) {
      Alert.alert('Bluetooth', String(e));
    } finally {
      setScanning(false);
    }
  };

  const connect = async (address: string) => {
    setBusy(true);
    try {
      await connectBluetoothPrinter(address);
      await refreshSaved();
      Alert.alert('Bluetooth', 'Connected.');
    } catch (e) {
      Alert.alert('Bluetooth', String(e));
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      await printSelfTest();
    } catch (e) {
      Alert.alert('Print', String(e));
    } finally {
      setBusy(false);
    }
  };

  const demoBill = async () => {
    setBusy(true);
    try {
      await printVendorBillPlain(DEMO_BILL);
    } catch (e) {
      Alert.alert('Print', String(e));
    } finally {
      setBusy(false);
    }
  };

  const rows = [...paired, ...found].filter((d, i, a) => a.findIndex((x) => x.address === d.address) === i);

  return (
    <View style={styles.flex}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="bodyMedium">Saved printer: {saved ?? 'none'}</Text>
          <Text variant="bodySmall" style={styles.hint}>
            Requires a dev build (native module). Pair a classic Bluetooth ESC/POS printer first.
          </Text>
          <Button mode="contained" onPress={scan} loading={scanning} style={styles.mt}>
            Scan devices
          </Button>
          <Button mode="outlined" onPress={test} loading={busy} disabled={!saved} style={styles.mt}>
            Test print
          </Button>
          <Button mode="outlined" onPress={demoBill} loading={busy} disabled={!saved} style={styles.mt}>
            Print demo bill
          </Button>
        </Card.Content>
      </Card>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.address}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable onPress={() => connect(item.address)}>
            <Card style={styles.row}>
              <Card.Title title={item.name || 'Unknown'} subtitle={item.address} />
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { margin: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  row: { marginBottom: 8 },
  mt: { marginTop: 8 },
  hint: { marginTop: 8, opacity: 0.75 },
});
