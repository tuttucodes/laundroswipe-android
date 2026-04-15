import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { useAuth } from '@/contexts/AuthContext';
import { MobileApi } from '@/lib/mobile-api';
import type { OrderRow, VendorBillRow } from '@/lib/api-types';
import { customerFacingStatusLabel } from '@/lib/constants';

export default function OrdersScreen() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [bills, setBills] = useState<VendorBillRow[]>([]);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    const [o, b] = await Promise.all([MobileApi.fetchOrdersForUser(profile.id), MobileApi.fetchVendorBillsForUser(profile.id)]);
    setOrders(o ?? []);
    setBills(b ?? []);
  }, [profile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const billTokens = new Set(
    (bills ?? []).map((x) => String(x.order_token ?? '').replace(/^#/, '').trim().toLowerCase()),
  );

  return (
    <FlatList
      data={orders}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshing={false}
      onRefresh={load}
      ListEmptyComponent={<Text style={styles.empty}>No orders yet.</Text>}
      renderItem={({ item }) => {
        const hasBill = billTokens.has(String(item.token ?? '').replace(/^#/, '').trim().toLowerCase());
        const label = customerFacingStatusLabel(item.status, hasBill);
        return (
          <Card style={styles.card}>
            <Card.Title title={`#${item.token}`} subtitle={item.service_name} />
            <Card.Content>
              <Text variant="bodySmall">{item.service_name}</Text>
              <Text variant="bodySmall">
                {item.pickup_date} · {item.time_slot}
              </Text>
              <Text variant="labelLarge">{label}</Text>
            </Card.Content>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  card: { marginBottom: 12 },
  empty: { textAlign: 'center', marginTop: 32 },
});
