import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { api } from '@/lib/http';
import type { VendorBillRow } from '@/lib/api-types';

export default function AdminBillsScreen() {
  const [rows, setRows] = useState<VendorBillRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await api.get('/api/vendor/bills');
      const data = res.data as { bills?: VendorBillRow[]; error?: string };
      if (data.error) {
        setErr(data.error);
        setRows([]);
        return;
      }
      setRows(Array.isArray(data.bills) ? data.bills : []);
    } catch (e: unknown) {
      setErr(String((e as { message?: string })?.message ?? e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      onRefresh={load}
      refreshing={false}
      ListHeaderComponent={err ? <Text style={styles.err}>{err}</Text> : null}
      ListEmptyComponent={!err ? <Text style={styles.empty}>No bills.</Text> : null}
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <Card.Title title={`#${item.order_token}`} subtitle={item.customer_name ?? ''} />
          <Card.Content>
            <Text variant="bodyMedium">Rs.{Number(item.total).toFixed(2)}</Text>
          </Card.Content>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  card: { marginBottom: 12 },
  empty: { textAlign: 'center', marginTop: 24 },
  err: { color: '#b00020', marginBottom: 12 },
});
