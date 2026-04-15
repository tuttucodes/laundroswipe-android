import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { useAuth } from '@/contexts/AuthContext';
import { MobileApi } from '@/lib/mobile-api';
import type { VendorBillRow } from '@/lib/api-types';

export default function BillsScreen() {
  const { profile } = useAuth();
  const [bills, setBills] = useState<VendorBillRow[]>([]);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    const b = await MobileApi.fetchVendorBillsForUser(profile.id);
    setBills(b ?? []);
  }, [profile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <FlatList
      data={bills}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      onRefresh={load}
      refreshing={false}
      ListEmptyComponent={<Text style={styles.empty}>No bills yet.</Text>}
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <Card.Title title={`Bill #${item.order_token}`} subtitle={item.vendor_name ?? ''} />
          <Card.Content>
            <Text variant="bodyMedium">Total Rs.{Number(item.total).toFixed(2)}</Text>
            <Text variant="bodySmall">{item.created_at}</Text>
          </Card.Content>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  card: { marginBottom: 12 },
  empty: { textAlign: 'center', marginTop: 32 },
});
