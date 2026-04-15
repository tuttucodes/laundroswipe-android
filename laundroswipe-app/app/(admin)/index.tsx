import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { api } from '@/lib/http';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminHomeScreen() {
  const router = useRouter();
  const { admin } = useAuth();
  const [payload, setPayload] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/admin/dashboard');
        if (!cancelled) setPayload(JSON.stringify(res.data, null, 2));
      } catch (e: unknown) {
        const msg = e as { message?: string };
        if (!cancelled) setErr(msg?.message ?? 'Request failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Signed in</Text>
          <Text variant="bodySmall">{admin?.role}</Text>
          {admin?.vendorId ? <Text variant="bodySmall">Vendor: {admin.vendorId}</Text> : null}
        </Card.Content>
      </Card>
      <Button mode="contained" onPress={() => router.push('/(admin)/bills')} style={styles.btn}>
        Vendor bills
      </Button>
      <Button mode="outlined" onPress={() => router.push('/(admin)/printer')} style={styles.btn}>
        Bluetooth printer
      </Button>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Text selectable variant="bodySmall" style={styles.mono}>
        {payload || 'Loading dashboard…'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 48 },
  card: { marginBottom: 16 },
  btn: { marginBottom: 8 },
  err: { color: '#b00020', marginBottom: 8 },
  mono: { fontFamily: 'monospace', marginTop: 12 },
});
